'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { sendAccountOtp } from '@/lib/sms/winsms'
import {
  canReceiveSms,
  canSendOtp,
  canVerifyOtp,
  hashOtp,
  isOtpShape,
  newOtpCode,
  parsePhone,
  otpExpiryFrom,
  otpMatches,
  phoneVariants,
} from '@/lib/account'
import type { GateState } from '@/lib/gate-state'
import { endUserSession, getOtpPolicy, startUserSession } from '@/lib/user-session'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n'

/**
 * بوّابة الحساب: رقم ← رمز ← خلاص.
 *
 * شاشتان لا أربع. لا قوقل ولا فيسبوك: هما يعطيان بريداً، والخدمة كلّها
 * على التليفون — فبعد الدخول بهما يبقى الرقم مطلوباً والتحقّق مطلوباً،
 * أي خطوتان زائدتان لا ناقصتان.
 *
 * والأفعال ترجع رموز أخطاء لا نصوصاً: الترجمة في lib/i18n.ts حيث
 * تُراجَع، لا مبعثرة في الخادم.
 */
const localeOf = (f: FormData): Locale => {
  const raw = String(f.get('locale') ?? '')
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

/** الوجهة بعد الدخول — مسار داخلي فقط: قيمة من النموذج لا تُفتح على الخارج */
function safeNext(raw: unknown, locale: Locale): string {
  const s = String(raw ?? '')
  return /^\/[a-z0-9/_-]*$/i.test(s) && !s.startsWith('//') ? s : `/${locale}/compte`
}

// ───────────────────────────────────────────────── طلب الرمز

export async function requestCodeAction(
  _prev: GateState,
  formData: FormData
): Promise<GateState> {
  const locale = localeOf(formData)
  const parsed = parsePhone(String(formData.get('phone') ?? ''))
  if (!parsed.ok) return { step: 'phone', phone: '', error: parsed.reason }

  const { phone, tn } = parsed
  const policy = await getOtpPolicy()

  // السقوف تُقرأ من السجلّ لا من الذاكرة: خادم آخر أو تبويب آخر يُحتسب
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
      step: 'phone',
      phone,
      error: decision.reason,
      retryAfter: Math.ceil(decision.retryAfterMs / 1000),
    }
  }

  const { data: existing } = await db
    .from('app_users')
    .select('id, status')
    .eq('phone', phone)
    .maybeSingle()
  if (existing?.status === 'blocked') return { step: 'phone', phone, error: 'blocked' }

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
    return { step: 'phone', phone, error: 'failed' }
  }

  // رقم غير تونسي: الحساب يُنشأ لكن المزوّد لا يبلغه. نقولها بدل أن
  // نتركه ينتظر رمزاً لن يصل.
  if (!canReceiveSms(phone)) {
    return { step: 'code', phone, notSent: true, retryAfter: policy.resendCooldownSeconds }
  }

  const outcome = await sendAccountOtp(phone, code, locale)

  if (outcome.status !== 'sent') {
    // على قاعدة التطوير لا مزوّد ولا مفتاح: الرمز يُطبع في سجلّ الخادم
    // حتّى يُجرَّب المسار. الشرط معلّق بعنوان القاعدة لا بـNODE_ENV،
    // لأنّ `next build` محلّياً يجعل NODE_ENV إنتاجاً.
    if (isDevDatabase()) {
      console.log(`\n  ⟨تطوير⟩ رمز ${phone}: ${code}\n`)
      return { step: 'code', phone, retryAfter: policy.resendCooldownSeconds }
    }
    return { step: 'phone', phone, error: 'failed' }
  }

  return { step: 'code', phone, retryAfter: policy.resendCooldownSeconds }
}

/** القاعدة المحلّية — وحدها تسمح بطباعة الرمز في السجلّ */
function isDevDatabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  return url.includes('127.0.0.1') || url.includes('localhost')
}

// ───────────────────────────────────────────────── التثبّت

export async function verifyCodeAction(
  _prev: GateState,
  formData: FormData
): Promise<GateState> {
  const locale = localeOf(formData)
  const parsed = parsePhone(String(formData.get('phone') ?? ''))
  if (!parsed.ok) return { step: 'phone', phone: '', error: parsed.reason }
  const { phone } = parsed

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
  if (!gate.ok) return { step: 'code', phone, error: gate.reason }

  // المحاولة تُحتسب قبل المقارنة: الخروج من الصفحة لا يُلغي محاولة خاطئة
  await db
    .from('phone_verifications')
    .update({ attempts: (row!.attempts ?? 0) + 1 })
    .eq('id', row!.id)

  if (!isOtpShape(code) || !otpMatches(String(row!.code_hash), phone, code)) {
    return { step: 'code', phone, error: 'wrong_code' }
  }

  await db
    .from('phone_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row!.id)

  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 120)
  const user = await findOrCreateUser(phone, fullName)
  if (!user) return { step: 'code', phone, error: 'failed' }
  if (user.blocked) return { step: 'phone', phone, error: 'blocked' }

  const claimed = await claimExisting(user.id, phone, fullName)
  await startUserSession(user.id)

  const next = safeNext(formData.get('next'), locale)
  redirect(`${next}${next.includes('?') ? '&' : '?'}claimed=${claimed}`)
}

// ───────────────────────────────────────────────── الخروج

export async function signOutUserAction(formData: FormData) {
  const locale = localeOf(formData)
  await endUserSession()
  redirect(`/${locale}`)
}

// ───────────────────────────────────────────────── مساعدات

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
    // اسم فارغ من تسجيل سابق يُستكمل، واسم موجود لا يُدهَس
    if (fullName && !String(found.full_name ?? '').trim()) {
      await db.from('app_users').update({ full_name: fullName }).eq('id', found.id)
    }
    return { id: String(found.id), blocked: found.status === 'blocked' }
  }

  const { data: created, error } = await db
    .from('app_users')
    .insert({ phone, full_name: fullName || '' })
    .select('id')
    .maybeSingle()
  if (error || !created) {
    console.error('app_users insert', error?.message)
    return null
  }

  // موافقة الخدمة تُسجَّل عند الإنشاء. التسويق لا: اختياري وغير محدَّد
  // مسبقاً، كما يشترط القسم 02 من الكرّاس.
  await db
    .from('user_consents')
    .insert({ user_id: created.id, kind: 'service', granted: true })
    .then(({ error: e }) => e && console.warn('user_consents', e.message))

  return { id: String(created.id), blocked: false }
}

/**
 * مطالبة الحريف بملفّاته القديمة.
 *
 * القسم 09: «الطلبات القديمة دون حساب لا تضيع ولا تصبح ملكاً لمن يعرف
 * رقمها». فالربط يقع بعد تحقّق الرقم لا قبله، وعلى الملفّات التي لا
 * صاحب لها بعد — ملفّ رُبط بحساب آخر لا يُنتزع منه.
 */
async function claimExisting(userId: string, phone: string, fullName: string): Promise<number> {
  const variants = phoneVariants(phone)
  let claimed = 0

  for (const table of ['housing_requests', 'properties'] as const) {
    const { data, error } = await db
      .from(table)
      .update({ user_id: userId })
      .is('user_id', null)
      .in('phone_digits', variants)
      .select('id')
    if (error) {
      console.warn(`claim ${table}`, error.message)
      continue
    }
    claimed += data?.length ?? 0
  }

  // الاسم من ملفّ قديم أفضل من حساب بلا اسم
  if (!fullName) {
    const { data } = await db
      .from('housing_requests')
      .select('full_name')
      .eq('user_id', userId)
      .not('full_name', 'is', null)
      .limit(1)
      .maybeSingle()
    const fromFile = String(data?.full_name ?? '').trim()
    if (fromFile) await db.from('app_users').update({ full_name: fromFile }).eq('id', userId)
  }

  return claimed
}
