'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { sendRequestConfirmation } from '@/lib/sms/winsms'
import { headers } from 'next/headers'
import { db, getBuildTiers, getFinanceContext } from '@/lib/supabase/server'
import { buildCost, tierByKey } from '@/lib/pricing'
import { requestSchema } from '@/lib/schema'
import { computeScore } from '@/lib/scoring'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'

export type SubmitState = {
  ok: boolean
  /** مفتاح رسالة عامّة: banner | rateLimited | server */
  error?: 'banner' | 'rateLimited' | 'server'
  /** أسماء الحقول الخاطئة — تُترجم في الواجهة */
  fields?: string[]
}

// تحديد بسيط لمعدّل الإرسال (في الذاكرة — يكفي للنسخة التجريبية)
const recent = new Map<string, number[]>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > MAX_PER_WINDOW
}

export async function submitRequest(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  // فخّ للإرسال الآلي: حقل مخفي لازم يبقى فارغ
  if ((formData.get('website') as string)?.length) {
    return { ok: false, error: 'server' }
  }

  const raw = Object.fromEntries(formData.entries())
  const parsed = requestSchema.safeParse({
    ...raw,
    hasWater: raw.hasWater === 'on',
    hasPower: raw.hasPower === 'on',
    hasRoad: raw.hasRoad === 'on',
    hasPermit: raw.hasPermit === 'on',
    isExpat: raw.isExpat === 'on',
    consent: raw.consent === 'on',
  })

  if (!parsed.success) {
    // أسماء الحقول فقط — بلا قيم، حتى ما نسجّلوش معطيات شخصية في السجلّ
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(
      Boolean
    )
    console.error('validation failed:', fields.join(', '))
    return { ok: false, error: 'banner', fields }
  }

  const d = parsed.data

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip) || rateLimited(d.phone)) {
    return { ok: false, error: 'rateLimited' }
  }

  // الحريف يدخل الأقدمية بالسنين، والقاعدة والتنقيط يشتغلان بالأشهر
  const seniorityMonths = Math.round((d.seniorityYears || 0) * 12)

  const { assumptions } = await getFinanceContext()
  const { tiers } = await getBuildTiers(d.govCode)

  // الميزانية المستهدفة: المساحة × سعر المتر حسب مستوى التشطيب (HT)
  const tier = tierByKey(tiers, d.standing)
  const targetBudget =
    tier && d.desiredAreaM2 ? buildCost(d.desiredAreaM2, tier.price) : null

  // اكتمال الملفّ: عدد المعطيات الاختيارية المعبّأة
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
  const filledFields = optional.filter(Boolean).length

  const score = computeScore({
    monthlyIncome: d.monthlyIncome,
    spouseIncome: d.spouseIncome,
    otherIncome: d.otherIncome,
    existingLoans: d.existingLoans,
    downPayment: d.downPayment,
    maxMonthly: d.maxMonthly,
    employment: d.employment,
    seniorityMonths,
    horizon: d.horizon,
    ownsLand: d.requestType === 'build_on_land' || Boolean(d.landAreaM2),
    landTitleStatus: d.titleStatus,
    desiredAreaM2: d.desiredAreaM2,
    targetBudget,
    filledFields,
    totalFields: optional.length,
    settings: assumptions,
  })

  const pilotGov = 'SFX'
  const { data: inserted, error } = await db
    .from('housing_requests')
    .insert({
      full_name: d.fullName,
      phone: d.phone,
      email: d.email || null,
      gov_code: d.govCode,
      delegation_id: d.delegationId,
      request_type: d.requestType,
      desired_area_m2: d.desiredAreaM2,
      bedrooms: d.bedrooms,
      horizon: d.horizon,
      standing: d.standing,
      imada_id: d.imadaId,
      land_location: d.landLocation || null,
      urgency: d.urgency,
      urgency_note: d.urgencyNote || null,
      flexibility: d.flexibility.length ? d.flexibility : null,
      problem_note: d.problemNote || null,
      foprolos_interest: d.foprolosInterest,
      is_first_home: d.isFirstHome,
      has_social_housing: d.hasSocialHousing,
      cnss_affiliated: d.cnssAffiliated,
      cnss_number_years: d.cnssYears,
      owns_land: d.requestType === 'build_on_land',
      status: d.govCode === pilotGov ? 'new' : 'on_hold',
      consent_at: new Date().toISOString(),
      source: 'web',
      lang: isLocale(String(formData.get('locale') ?? '')) ? String(formData.get('locale')) : DEFAULT_LOCALE,
    })
    .select('id, ref_code')
    .single()

  if (error || !inserted) {
    console.error('insert housing_requests', error)
    return { ok: false, error: 'server' }
  }

  const requestId = inserted.id as string

  const { error: finErr } = await db.from('financial_profiles').insert({
    request_id: requestId,
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
  })
  if (finErr) console.error('insert financial_profiles', finErr)

  if (d.requestType === 'build_on_land' && d.landAreaM2) {
    const { error: landErr } = await db.from('request_land').insert({
      request_id: requestId,
      area_m2: d.landAreaM2,
      title_status: d.titleStatus,
      has_water: d.hasWater,
      has_power: d.hasPower,
      has_road: d.hasRoad,
      has_permit: d.hasPermit,
    })
    if (landErr) console.error('insert request_land', landErr)
  }

  const { error: scoreErr } = await db.from('scores').insert({
    request_id: requestId,
    total: score.total,
    band: score.band,
    breakdown: { criteria: score.criteria, maxPayment: score.maxPayment },
    max_loan_tnd: score.maxLoan,
    max_budget_tnd: score.maxBudget,
    algo_version: score.algoVersion,
  })
  if (scoreErr) console.error('insert scores', scoreErr)

  const locale = String(formData.get('locale') ?? '')
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE

  // الرمز يوصل على الهاتف بعد الردّ لا قبله: المزوّد البطيء ما يعطّلش المواطن،
  // والفشل يُسجَّل في sms_log ولا يمسّ المطلب.
  const refCode = String(inserted.ref_code)
  after(() => sendRequestConfirmation(requestId, refCode, d.phone, l))

  redirect(`/${l}/merci/${refCode}`)
}
