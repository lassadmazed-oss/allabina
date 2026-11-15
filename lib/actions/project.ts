'use server'

import { redirect } from 'next/navigation'
import { recordEvent } from '@/lib/analytics-server'
import { db } from '@/lib/supabase/server'
import { sendAccountOtp } from '@/lib/sms/winsms'
import {
  canReceiveSms,
  canSendOtp,
  canVerifyOtp,
  hashOtp,
  isOtpShape,
  nameCheck,
  newOtpCode,
  otpExpiryFrom,
  otpMatches,
  parsePhone,
  phoneVariants,
} from '@/lib/account'
import { getOtpPolicy, startUserSession } from '@/lib/user-session'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n'
import { configFromParams } from '@/lib/budget-reach'

/**
 * بعث المشروع من المكوّن — الخطوة الرابعة.
 *
 * قرار 15/11/2026: «يدخل، يعمّر، **يشوف**، يختار — وفي آخر مرحلة يعطي
 * اسمه ورقمه ويبعث». فلا حاجز قبل الرسم ولا قبل التقدير: الحاجز في
 * النصّ يخسر من لم يرَ بعدُ قيمةً، والرسالة لا تُدفع إلّا عند مطلبٍ
 * حقيقي.
 *
 * والرقم يبقى متثبَّتاً: الرمز يُطلب ويُفحص هنا، في نفس الخطوة. لا
 * مطلب برقمٍ لا صاحب له — القسم 02 من الكرّاس باقٍ، انتقل موضعه فقط.
 */

export type SendState = {
  step: 'form' | 'code'
  phone: string
  fullName: string
  error?: string
  retryAfter?: number
  /** على قاعدة التطوير: لا مزوّد، والرمز في سجلّ الخادم */
  notSent?: boolean
}

const localeOf = (f: FormData): Locale => {
  const raw = String(f.get('locale') ?? '')
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

/** القاعدة المحلّية — وحدها تسمح بطباعة الرمز في السجلّ */
function isDevDatabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  return url.includes('127.0.0.1') || url.includes('localhost')
}

/** أنواع المكوّن ← أنواع القاعدة. المجهول يصير «أخرى» لا يُسقط البعث */
const TO_REQUEST: Record<string, string> = {
  maison: 'build_on_land',
  immobilier: 'apartment',
  usine: 'other',
  commerce: 'other',
  renovation: 'renovation',
  autre: 'other',
}

/** مواصفات المشروع كما حملها العنوان — تمرّ في النموذج حقولاً مخفيّة */
function specsOf(f: FormData) {
  const get = (k: string) => {
    const v = f.get(k)
    return v == null ? undefined : String(v)
  }
  const config = configFromParams({
    s: get('s'),
    l: get('l'),
    ch: get('ch'),
    sa: get('sa'),
    cu: get('cu'),
    sdb: get('sdb'),
  })
  // الغرف تُكتب لمن سُئل عنها: مشروعٌ بلا غرف لا يُسجَّل بغرفتين افتراضيتين
  const hasRooms = get('ch') !== undefined
  const budgetRaw = String(f.get('b') ?? '').replace(/[^\d]/g, '')
  return {
    config,
    hasRooms,
    type: String(f.get('type') ?? ''),
    delegationId: Number(String(f.get('del') ?? '')) || null,
    systemCode: String(f.get('sys') ?? '').trim() || null,
    kind: String(f.get('k') ?? '').trim() || null,
    units: Number(String(f.get('u') ?? '').replace(/[^\d]/g, '')) || null,
    heightM: Number(String(f.get('h') ?? '').replace(',', '.')) || null,
    spanM: Number(String(f.get('sp') ?? '').replace(',', '.')) || null,
    terrain: String(f.get('tr') ?? '').trim() || null,
    budget: budgetRaw ? Number(budgetRaw) : null,
  }
}

// ───────────────────────────────────────────── 1 · طلب الرمز

export async function sendProjectCodeAction(
  _prev: SendState,
  formData: FormData
): Promise<SendState> {
  const locale = localeOf(formData)
  const fullName = String(formData.get('full_name') ?? '').trim()
  const parsed = parsePhone(String(formData.get('phone') ?? ''))
  if (!parsed.ok) return { step: 'form', phone: '', fullName, error: parsed.reason }

  // الاسم يُفحص قبل الرمز: رمز يُستهلك ثمّ يُرفض الاسم يعني رسالة ثانية
  const named = nameCheck(null, fullName)
  if (!named.ok) return { step: 'form', phone: parsed.phone, fullName, error: 'name_required' }

  const { phone } = parsed
  const policy = await getOtpPolicy()

  const dayAgo = new Date(Date.now() - 86400_000).toISOString()
  const { data: recent } = await db
    .from('phone_verifications')
    .select('sent_at')
    .eq('phone', phone)
    .gte('sent_at', dayAgo)
    .order('sent_at', { ascending: false })

  const decision = canSendOtp(
    { lastSentAt: recent?.[0]?.sent_at ?? null, sentLastDay: recent?.length ?? 0 },
    policy
  )
  if (!decision.ok) {
    return {
      step: 'form',
      phone,
      fullName,
      error: decision.reason,
      retryAfter: Math.ceil(decision.retryAfterMs / 1000),
    }
  }

  const { data: existing } = await db
    .from('app_users')
    .select('id, status')
    .eq('phone', phone)
    .maybeSingle()
  if (existing?.status === 'blocked') {
    return { step: 'form', phone, fullName, error: 'blocked' }
  }

  const code = newOtpCode()
  const { error } = await db.from('phone_verifications').insert({
    phone,
    purpose: existing ? 'login' : 'signup',
    code_hash: hashOtp(phone, code),
    expires_at: otpExpiryFrom(policy).toISOString(),
    user_id: existing?.id ?? null,
  })
  if (error) {
    console.error('otp insert', error.message)
    return { step: 'form', phone, fullName, error: 'failed' }
  }

  if (!canReceiveSms(phone)) {
    return {
      step: 'code',
      phone,
      fullName,
      notSent: true,
      retryAfter: policy.resendCooldownSeconds,
    }
  }

  const outcome = await sendAccountOtp(phone, code, locale)
  if (outcome.status !== 'sent') {
    if (isDevDatabase()) {
      console.log(`\n  ⟨تطوير⟩ رمز ${phone}: ${code}\n`)
      return { step: 'code', phone, fullName, retryAfter: policy.resendCooldownSeconds }
    }
    return { step: 'form', phone, fullName, error: 'failed' }
  }

  await recordEvent('account_requested')
  return { step: 'code', phone, fullName, retryAfter: policy.resendCooldownSeconds }
}

// ───────────────────────────────────────────── 2 · التثبّت والبعث

export async function submitProjectAction(
  _prev: SendState,
  formData: FormData
): Promise<SendState> {
  const locale = localeOf(formData)
  const fullName = String(formData.get('full_name') ?? '').trim()
  const parsed = parsePhone(String(formData.get('phone') ?? ''))
  if (!parsed.ok) return { step: 'form', phone: '', fullName, error: parsed.reason }
  const { phone } = parsed

  const named = nameCheck(null, fullName)
  if (!named.ok) return { step: 'code', phone, fullName, error: 'name_required' }

  const code = String(formData.get('code') ?? '').replace(/\D/g, '')
  const policy = await getOtpPolicy()

  const { data: row } = await db
    .from('phone_verifications')
    .select('id, code_hash, attempts, expires_at, consumed_at, purpose')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const gate = canVerifyOtp(row, policy)
  if (!gate.ok) return { step: 'code', phone, fullName, error: gate.reason }

  // المحاولة تُحتسب قبل المقارنة: الخروج لا يُلغي محاولة خاطئة
  await db
    .from('phone_verifications')
    .update({ attempts: (row!.attempts ?? 0) + 1 })
    .eq('id', row!.id)

  if (!isOtpShape(code) || !otpMatches(String(row!.code_hash), phone, code)) {
    return { step: 'code', phone, fullName, error: 'wrong_code' }
  }

  await db
    .from('phone_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row!.id)

  const name = named.name.slice(0, 120)
  const user = await findOrCreateUser(phone, name)
  if (!user) return { step: 'code', phone, fullName, error: 'failed' }
  if (user.blocked) return { step: 'form', phone, fullName, error: 'blocked' }

  const ref = await createFromComposer(user.id, phone, name, locale, specsOf(formData))
  if (!ref) return { step: 'code', phone, fullName, error: 'failed' }

  await startUserSession(user.id)
  await recordEvent('project_saved')
  redirect(`/${locale}/merci/${encodeURIComponent(ref)}`)
}

// ───────────────────────────────────────────── المطلب نفسه

async function createFromComposer(
  userId: string,
  phone: string,
  fullName: string,
  locale: Locale,
  s: ReturnType<typeof specsOf>
): Promise<string | null> {
  const { data, error } = await db
    .from('housing_requests')
    .insert({
      user_id: userId,
      full_name: fullName,
      phone,
      gov_code: 'SFX',
      delegation_id: s.delegationId,
      request_type: TO_REQUEST[s.type] ?? 'other',
      desired_area_m2: s.config.surface || null,
      bedrooms: s.hasRooms ? s.config.bedrooms || null : null,
      owns_land: s.terrain !== null && s.terrain !== 'none',
      lang: locale,
      consent_at: new Date().toISOString(),
    })
    .select('id, ref_code')
    .maybeSingle()

  if (error || !data) {
    console.error('insert housing_requests', error?.message)
    return null
  }

  const requestId = String(data.id)

  /*
   * رمز نظام مجهول يكسر المفتاح الخارجي، فيُسقط سطر المواصفات كلّه لا
   * الرمز وحده. نُسقط الرمز ونحتفظ بالمساحة والطوابق والغرف.
   */
  let systemCode = s.systemCode
  if (systemCode) {
    const { data: sys } = await db
      .from('construction_systems')
      .select('code')
      .eq('code', systemCode)
      .eq('is_active', true)
      .maybeSingle()
    if (!sys) {
      console.warn('طريقة بناء مجهولة، أُسقطت:', systemCode)
      systemCode = null
    }
  }

  const { error: cfgErr } = await db.from('project_configs').upsert(
    {
      request_id: requestId,
      surface_m2: s.config.surface || null,
      levels: s.config.levels || 1,
      bedrooms: s.hasRooms ? s.config.bedrooms || null : null,
      living_rooms: s.hasRooms ? s.config.livingRooms || null : null,
      kitchens: s.hasRooms ? s.config.kitchens || null : null,
      bathrooms: s.hasRooms ? s.config.bathrooms || null : null,
      system_code: systemCode,
      // الميزانية التي صرّح بها في المكوّن — تُحفظ نصّاً في الملاحظات
      // لأنّ القاعدة لا تحمل خانة «ميزانية مصرَّح بها» بعد
      /*
       * ما لا خانة له في القاعدة يُكتب نصّاً في الملاحظات بدل أن يُرمى:
       * الصنف والوحدات والارتفاع والبحر سُئل عنها الحريف وأجاب، ورميُ
       * جوابٍ أسوأ من عدم السؤال.
       */
      notes:
        [
          s.kind ? `الصنف: ${s.kind === 'pro' ? 'محترف' : 'فرد'}` : '',
          s.budget ? `ميزانية مصرَّح بها من المكوّن: ${s.budget} د.ت` : '',
          s.units ? `عدد الوحدات: ${s.units}` : '',
          s.heightM ? `الارتفاع: ${s.heightM} م` : '',
          s.spanM ? `أكبر بحر: ${s.spanM} م` : '',
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    { onConflict: 'request_id' }
  )
  if (cfgErr) console.error('upsert project_configs', cfgErr.message)

  await db
    .from('request_events')
    .insert({
      request_id: requestId,
      event_type: 'note',
      note: 'وصل من «كوّن مشروعك» — المواصفات مكتوبة من اختيارات الحريف.',
    })
    .then(({ error: e }) => e && console.warn('request_events', e.message))

  return String(data.ref_code)
}

async function findOrCreateUser(
  phone: string,
  fullName: string
): Promise<{ id: string; blocked: boolean } | null> {
  const { data: found } = await db
    .from('app_users')
    .select('id, status, full_name')
    .eq('phone', phone)
    .maybeSingle()

  if (found) {
    if (fullName && !String(found.full_name ?? '').trim()) {
      await db.from('app_users').update({ full_name: fullName }).eq('id', found.id)
    }
    return { id: String(found.id), blocked: found.status === 'blocked' }
  }

  const { data: created, error } = await db
    .from('app_users')
    .insert({ phone, full_name: fullName })
    .select('id')
    .maybeSingle()
  if (error || !created) {
    console.error('app_users insert', error?.message)
    return null
  }

  await db
    .from('user_consents')
    .insert({ user_id: created.id, kind: 'service', granted: true })
    .then(({ error: e }) => e && console.warn('user_consents', e.message))

  // ملفّات قديمة بنفس الرقم تلتحق بالحساب — القسم 09
  for (const table of ['housing_requests', 'properties'] as const) {
    await db
      .from(table)
      .update({ user_id: created.id })
      .is('user_id', null)
      .in('phone_digits', phoneVariants(phone))
      .then(({ error: e }) => e && console.warn(`claim ${table}`, e.message))
  }

  return { id: String(created.id), blocked: false }
}
