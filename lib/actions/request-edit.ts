'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { db, getBuildTiers, getFinanceContext } from '@/lib/supabase/server'
import { buildCost, tierByKey } from '@/lib/pricing'
import { requestSchema } from '@/lib/schema'
import { computeScore } from '@/lib/scoring'
import { phoneMatches } from '@/lib/public-state'
import { sendRequestEdited } from '@/lib/sms/winsms'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n'
import { OWNER_COOKIE, OWNER_TTL_MS, issueOwnerToken, readOwnerToken } from '@/lib/owner-session'
import { writeClientAnswers } from '@/lib/actions/client-answers'
import {
  OWNER_FIELDS,
  changedLabels,
  diffValues,
  toFormValues,
  touchesScore,
  type ConfigRow,
  type FinanceRow,
  type HomeRow, LandRow,
  type RequestRow,
  type SocialRow,
} from '@/lib/owner-edit'

export type OpenState = { error?: 'notFound' | 'rateLimited' | 'noInput' }
export type EditState = {
  ok: boolean
  error?: 'banner' | 'rateLimited' | 'server' | 'expired' | 'noChange'
  fields?: string[]
}

// ---------------------------------------------------------------- الحدود

const opens = new Map<string, number[]>()
const edits = new Map<string, number[]>()

function hits(map: Map<string, number[]>, key: string, windowMs: number, max: number): boolean {
  const now = Date.now()
  const list = (map.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  map.set(key, list)
  return list.length > max
}

const clientIp = async () =>
  (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'

// ------------------------------------------------------------ فتح الجلسة

/**
 * التحقّق من ملكيّة المطلب ثمّ فتح جلسة قصيرة.
 *
 * الرمز والهاتف معاً كما في صفحة المتابعة: الرمز وحده متسلسل يمكن
 * تجريبه، والهاتف وحده يعرفه من يعرف صاحبه. بعد التحقّق لا يعودان
 * يمرّان في أيّ رابط — الكوكي الموقّع يحمل معرّف المطلب وحده.
 *
 * حدّ خمس محاولات في عشر دقائق: أقسى من حدّ الاطّلاع (عشرون)، لأنّ
 * هذا الباب يفتح على التعديل لا على القراءة.
 */
export async function openOwnerSession(_prev: unknown, formData: FormData): Promise<OpenState> {
  const ref = String(formData.get('ref') ?? '').trim().toUpperCase()
  const phone = String(formData.get('phone') ?? '').trim()
  const rawLocale = String(formData.get('locale') ?? '')
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE

  if (!ref || !phone) return { error: 'noInput' }
  if (hits(opens, await clientIp(), 10 * 60 * 1000, 5)) return { error: 'rateLimited' }

  const { data } = await db
    .from('housing_requests')
    .select('id, phone, status')
    .eq('ref_code', ref)
    .maybeSingle()

  // نفس الجواب في الحالتين: «ما لقيناش» لا يكشف إن كان الرمز موجوداً
  if (!data || !phoneMatches(String(data.phone), phone)) return { error: 'notFound' }

  const store = await cookies()
  store.set(OWNER_COOKIE, issueOwnerToken(String(data.id)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(OWNER_TTL_MS / 1000),
  })

  redirect(`/${locale}/suivi/modifier`)
}

export async function closeOwnerSession(formData: FormData) {
  const rawLocale = String(formData.get('locale') ?? '')
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  ;(await cookies()).delete(OWNER_COOKIE)
  redirect(`/${locale}/suivi`)
}

// ------------------------------------------------------------- قراءة الملفّ

const REQUEST_COLUMNS =
  'id, ref_code, full_name, phone, email, gov_code, delegation_id, imada_id, land_location, ' +
  'request_type, desired_area_m2, desired_land_m2, bedrooms, horizon, standing, urgency, urgency_note, ' +
  'flexibility, problem_note, foprolos_interest, is_first_home, has_social_housing, ' +
  'cnss_affiliated, cnss_number_years, problem_type, financing_state, cash_ready, ' +
  'lang, status, owner_updated_at'

export type OwnRequest = {
  id: string
  refCode: string
  lang: Locale
  values: Record<string, string | boolean>
  ownerUpdatedAt: string | null
}

/** الملفّ كما تفهمه الاستمارة، أو null إن انتهت الجلسة. */
export async function loadOwnRequest(): Promise<OwnRequest | null> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value
  const id = readOwnerToken(token)
  if (!id) return null

  const { data: r } = await db.from('housing_requests').select(REQUEST_COLUMNS).eq('id', id).maybeSingle()
  if (!r) return null

  const [{ data: fin }, { data: land }, { data: cfg }, { data: social }, { data: docs }, { data: home }] =
    await Promise.all([
    db
      .from('financial_profiles')
      .select(
        'monthly_income_tnd, spouse_income_tnd, other_income_tnd, existing_loans_tnd, ' +
          'down_payment_tnd, max_monthly_tnd, employment, seniority_months, is_expat, expat_country'
      )
      .eq('request_id', id)
      .maybeSingle(),
    db
      .from('request_land')
      .select('area_m2, title_status, has_water, has_power, has_road, has_permit, in_urban_plan, existing_building, has_plans')
      .eq('request_id', id)
      .maybeSingle(),
    db
      .from('project_configs')
      .select('levels, bathrooms, living_rooms, kitchens, garage, terrasse, jardin, cloture, majel, piscine, annexe, solar, ascenseur')
      .eq('request_id', id)
      .maybeSingle(),
    db
      .from('social_assessments')
      .select(
        'household_size, dependents, has_disability, housing_condition, income_stability, ' +
          'is_renting, rent_tnd, housing_problems'
      )
      .eq('request_id', id)
      .maybeSingle(),
    db
      .from('request_documents')
      .select('doc_code')
      .eq('request_id', id)
      .eq('declared', true),
    db
      .from('request_home')
      .select('ownership, building_age_years, title_status, has_permit')
      .eq('request_id', id)
      .maybeSingle(),
  ])

  const row = r as unknown as RequestRow & {
    id: string
    ref_code: string
    lang: string
    owner_updated_at: string | null
  }

  return {
    id: row.id,
    refCode: row.ref_code,
    lang: isLocale(row.lang) ? row.lang : DEFAULT_LOCALE,
    values: toFormValues(
      row,
      (fin as FinanceRow | null) ?? null,
      (land as LandRow | null) ?? null,
      (cfg as ConfigRow | null) ?? null,
      (social as SocialRow | null) ?? null,
      ((docs ?? []) as { doc_code: string | null }[])
        .map((x) => x.doc_code)
        .filter((c): c is string => Boolean(c)),
      (home as HomeRow | null) ?? null
    ),
    ownerUpdatedAt: row.owner_updated_at,
  }
}

// -------------------------------------------------------------- التعديل

/**
 * حفظ تعديل صاحب المطلب.
 *
 * نفس مخطّط الإنشاء: من يقدر يكتب قيمة في مطلب جديد يقدر يصلّحها في
 * مطلبه. ما لا يمسّه: الرمز، الولاية (المرحلة التجريبية صفاقس)،
 * الحالة، ملاحظات الفريق، وكلّ ما تكتبه الإدارة.
 *
 * التنقيط يُعاد حسابه إن تبدّل معطى يدخل فيه — وإلّا يبقى صنف الملفّ
 * محسوباً على أرقام ما عادتش صحيحة.
 */
export async function updateOwnRequest(_prev: unknown, formData: FormData): Promise<EditState> {
  if ((formData.get('website') as string)?.length) return { ok: false, error: 'server' }

  const current = await loadOwnRequest()
  if (!current) return { ok: false, error: 'expired' }

  if (hits(edits, current.id, 60 * 60 * 1000, 5)) return { ok: false, error: 'rateLimited' }

  /**
   * الحقول متعدّدة القيم تُقرأ بـgetAll لا بـfromEntries.
   *
   * fromEntries تحتفظ بآخر قيمة لكلّ مفتاح: خانتان مؤشّرتان باسم واحد
   * تعطيان واحدة. «مستعدّ يتنازل على» كان يخسر كلّ اختيار إلّا الأخير
   * منذ أن شُحن، بلا خطأ ولا أثر — الحقل يُملأ والقاعدة تستقبل واحداً.
   */
  const raw = Object.fromEntries(formData.entries())
  const parsed = requestSchema.safeParse({
    ...raw,
    flexibility: formData.getAll('flexibility'),
    documents: formData.getAll('documents'),
    govCode: current.values.govCode,
    hasWater: raw.hasWater === 'on',
    hasPower: raw.hasPower === 'on',
    hasRoad: raw.hasRoad === 'on',
    hasPermit: raw.hasPermit === 'on',
    isExpat: raw.isExpat === 'on',
    consent: 'on', // الموافقة أُعطيت وقت الإرسال الأوّل ولا تُسحب بتعديل
  })

  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(Boolean)
    console.error('owner edit validation failed:', fields.join(', '))
    return { ok: false, error: 'banner', fields }
  }

  const d = parsed.data
  const next: Record<string, unknown> = { ...d, flexibility: d.flexibility.join(',') }
  const changes = diffValues(current.values, next, OWNER_FIELDS)

  if (Object.keys(changes).length === 0) return { ok: false, error: 'noChange' }

  const seniorityMonths = Math.round((d.seniorityYears || 0) * 12)
  const now = new Date().toISOString()

  const { error: reqErr } = await db
    .from('housing_requests')
    .update({
      full_name: d.fullName,
      phone: d.phone,
      email: d.email || null,
      delegation_id: d.delegationId,
      imada_id: d.imadaId,
      land_location: d.landLocation || null,
      request_type: d.requestType,
      desired_area_m2: d.desiredAreaM2,
      desired_land_m2: d.desiredLandM2,
      bedrooms: d.bedrooms,
      horizon: d.horizon,
      standing: d.standing,
      urgency: d.urgency,
      urgency_note: d.urgencyNote || null,
      flexibility: d.flexibility.length ? d.flexibility : null,
      problem_note: d.problemNote || null,
      foprolos_interest: d.foprolosInterest,
      is_first_home: d.isFirstHome,
      has_social_housing: d.hasSocialHousing,
      cnss_affiliated: d.cnssAffiliated,
      cnss_number_years: d.cnssYears,
      problem_type: d.problemType,
      apartment_state: d.apartmentState,
      floor_pref: d.floorPref,
      elevator_needed: d.elevatorNeeded,
      parking_needed: d.parkingNeeded,
      renovation_works: d.works.length ? d.works : null,
      current_area_m2: d.currentAreaM2,
      extension_area_m2: d.extensionAreaM2,
      financing_state: d.cashReady ? 'self_funded' : d.financingState ?? 'not_started',
      cash_ready: d.cashReady,
      owns_land: d.requestType === 'build_on_land',
      owner_updated_at: now,
      updated_at: now,
    })
    .eq('id', current.id)

  if (reqErr) {
    console.error('owner edit: housing_requests', reqErr)
    return { ok: false, error: 'server' }
  }

  // بلا وظيفة لا سطر مالي — «مشكل آخر» قد يطوي الخطوة المالية
  if (d.employment) {
    const { error: finErr } = await db.from('financial_profiles').upsert(
      {
        request_id: current.id,
        monthly_income_tnd: d.monthlyIncome,
        spouse_income_tnd: d.spouseIncome,
        other_income_tnd: d.otherIncome,
        existing_loans_tnd: d.existingLoans,
        down_payment_tnd: d.downPayment,
        max_monthly_tnd: d.maxMonthly || null,
        employment: d.employment,
        seniority_months: seniorityMonths,
        is_expat: d.isExpat,
        expat_country: d.expatCountry || null,
      },
      { onConflict: 'request_id' }
    )
    if (finErr) console.error('owner edit: financial_profiles', finErr)
  }

  // الأرض تُحذف إن بدّل المسار: بقاؤها يعطي الإدارة معطى لا يخصّ المطلب
  if (d.requestType === 'build_on_land' && d.landAreaM2) {
    const { error: landErr } = await db.from('request_land').upsert(
      {
        request_id: current.id,
        area_m2: d.landAreaM2,
        title_status: d.titleStatus,
        has_water: d.hasWater,
        has_power: d.hasPower,
        has_road: d.hasRoad,
        has_permit: d.hasPermit,
      in_urban_plan: d.inUrbanPlan,
      existing_building: d.existingBuilding,
      has_plans: d.hasPlans,
      },
      { onConflict: 'request_id' }
    )
    if (landErr) console.error('owner edit: request_land', landErr)
  } else if (d.requestType !== 'build_on_land') {
    await db.from('request_land').delete().eq('request_id', current.id)
  }

  if (d.requestType === 'renovation') {
    const { error: homeErr } = await db.from('request_home').upsert(
      {
        request_id: current.id,
        ownership: d.ownership,
        building_age_years: d.buildingAge,
        title_status: d.homeTitleStatus,
        has_permit: d.homePermit,
      },
      { onConflict: 'request_id' }
    )
    if (homeErr) console.error('owner edit: request_home', homeErr)
  } else {
    await db.from('request_home').delete().eq('request_id', current.id)
  }

  // نفس ما يكتبه الإنشاء: المواصفات والوضع العائلي والوثائق المصرَّح بها
  await writeClientAnswers(current.id, d)

  // ---- التنقيط
  let scoreBefore: { total: number; band: string } | null = null
  let scoreAfter: { total: number; band: string } | null = null

  if (touchesScore(changes)) {
    const { data: prev } = await db
      .from('scores')
      .select('total, band')
      .eq('request_id', current.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    scoreBefore = prev ? { total: Number(prev.total), band: String(prev.band) } : null

    const { assumptions } = await getFinanceContext()
    const { tiers } = await getBuildTiers(String(current.values.govCode || 'SFX'))
    const tier = tierByKey(tiers, d.standing ?? '')
    const targetBudget = tier && d.desiredAreaM2 ? buildCost(d.desiredAreaM2, tier.price) : null

    const optional = [
      d.delegationId,
      d.desiredAreaM2,
      d.bedrooms,
      d.standing,
      d.spouseIncome || null,
      d.otherIncome || null,
      d.downPayment || null,
      d.maxMonthly || null,
      d.seniorityYears || null,
      d.email || null,
    ]

    const score = computeScore({
      monthlyIncome: d.monthlyIncome,
      spouseIncome: d.spouseIncome,
      otherIncome: d.otherIncome,
      existingLoans: d.existingLoans,
      downPayment: d.downPayment,
      maxMonthly: d.maxMonthly,
      // الشغل صار اختيارياً في المخطّط؛ التنقيط ينتظر نصّاً
      employment: d.employment ?? '',
      seniorityMonths,
      horizon: d.horizon,
      ownsLand: d.requestType === 'build_on_land' || Boolean(d.landAreaM2),
      landTitleStatus: d.titleStatus,
      desiredAreaM2: d.desiredAreaM2,
      targetBudget,
      filledFields: optional.filter(Boolean).length,
      totalFields: optional.length,
      settings: assumptions,
    })

    // إضافة لا استبدال: scores جدول تاريخ، وكلّ الشاشات تقرا الأحدث
    // بـcomputed_at. الاستبدال كان يمحو تنقيط ما قبل التعديل.
    const { error: scoreErr } = await db.from('scores').insert({
      request_id: current.id,
      total: score.total,
      band: score.band,
      breakdown: { criteria: score.criteria, maxPayment: score.maxPayment },
      max_loan_tnd: score.maxLoan,
      max_budget_tnd: score.maxBudget,
      algo_version: score.algoVersion,
    })
    if (scoreErr) console.error('owner edit: scores', scoreErr)
    scoreAfter = { total: score.total, band: score.band }
  }

  const { error: logErr } = await db.from('request_edits').insert({
    request_id: current.id,
    changes,
    score_before: scoreBefore?.total ?? null,
    score_after: scoreAfter?.total ?? null,
    band_before: scoreBefore?.band ?? null,
    band_after: scoreAfter?.band ?? null,
  })
  if (logErr) console.error('owner edit: request_edits', logErr)

  // خطّ زمن الملفّ في اللوحة: بلا هذا يجد الفريق أرقاماً تبدّلت بلا خبر
  const { error: evErr } = await db.from('request_events').insert({
    request_id: current.id,
    event_type: 'owner_edit',
    note: `صاحب المطلب عدّل: ${changedLabels(changes)}`.slice(0, 500),
  })
  if (evErr) console.error('owner edit: request_events', evErr)

  // الرسالة تروح للرقم الجديد إن تبدّل: هو الرقم الذي يتابع به من الآن
  after(() => sendRequestEdited(current.id, current.refCode, d.phone, current.lang))

  redirect(`/${current.lang}/suivi/modifier?saved=1`)
}
