/**
 * دراسة طلب المساندة — المحرّك النقيّ.
 *
 * ستّة معايير، كلّ واحد 0→3 بوصف مكتوب لكلّ درجة حتى يحكم مستشاران
 * بنفس الميزان. الأوزان تجي من app_settings (الفريق يعدّلها)، وهذي
 * الافتراضية. الدرجة تعاون القرار ولا تصنعه.
 *
 * حاجز الصحّة: لا «أولوية» بلا تثبّت، ولا فوق «للمراجعة» مع تناقض مرصود.
 */

export const ALGO_VERSION = 'v1'

export const CRITERIA = [
  'vulnerability',
  'urgency',
  'housing_gap',
  'self_effort',
  'feasibility',
  'verification',
] as const
export type Criterion = (typeof CRITERIA)[number]

export type Weights = Record<Criterion, number>

export const DEFAULT_WEIGHTS: Weights = {
  vulnerability: 25,
  urgency: 20,
  housing_gap: 15,
  self_effort: 15,
  feasibility: 15,
  verification: 10,
}

export const MAX_SCORE = 3

/** وصف كلّ درجة — هو ما يقرأه المستشار وهو يقيّم، لا الرقم */
export const RUBRIC: Record<Criterion, { title: string; levels: [string, string, string, string] }> = {
  vulnerability: {
    title: 'هشاشة الوضعية',
    levels: [
      'بالغون قادرون على العمل، بلا إعاقة ولا مرض مزمن',
      'أطفال في العائلة أو مسنّ معال',
      'إعاقة أو مرض مزمن عند أحد الأفراد، أو أمّ وحيدة بأطفال',
      'أكثر من عامل هشاشة معاً، أو خطر مباشر على القُصّر',
    ],
  },
  urgency: {
    title: 'الاستعجال',
    levels: [
      'يخطّط بلا أجل',
      'خلال سنة',
      'أقلّ من ستّة أشهر: إشعار خروج، عقد ينتهي',
      'خطر حالّ: سقف مهدّد، إخلاء وشيك، بلا مسكن الآن',
    ],
  },
  housing_gap: {
    title: 'فجوة السكن',
    levels: [
      'مسكن مقبول والطلب تحسين',
      'مسكن ضيّق أو غير مستقرّ',
      'مسكن غير آمن أو بلا مرافق أساسية (ماء/كهرباء/صرف)',
      'بلا مسكن أو مسكن مهدّد بالانهيار',
    ],
  },
  self_effort: {
    title: 'الجهد الذاتي',
    levels: [
      'لا أرض ولا بناء ولا مساهمة',
      'مساهمة ذاتية جزئية أو أرض غير مسوّاة',
      'أرض مسوّاة أو بناء قائم يحتاج تكملة',
      'بناء متقدّم وواضح أنّ ما بقي محدود ومحدّد',
    ],
  },
  feasibility: {
    title: 'قابلية التدخّل العيني',
    levels: [
      'الحاجة مالية صرفة أو خارج ما تقدر عليه المنصّة',
      'التدخّل ممكن لكن كبير ومتعدّد الأطراف',
      'التدخّل واضح: مواد أو يد عاملة أو دراسة محدّدة',
      'تدخّل صغير محدّد يغلق الحاجة نهائياً',
    ],
  },
  verification: {
    title: 'مدى صحّة المعطيات',
    levels: [
      'ما تثبّتنا من شيء بعدُ',
      'مكالمة مع صاحب الطلب فقط',
      'وثائق أو شهادة طرف ثالث (عمدة، جمعية)',
      'زيارة ميدانية تؤكّد الوضعية',
    ],
  },
}

export const BANDS = ['priority', 'eligible', 'review', 'not_eligible'] as const
export type Band = (typeof BANDS)[number]

export type Thresholds = { priority: number; eligible: number; review: number }
export const DEFAULT_THRESHOLDS: Thresholds = { priority: 70, eligible: 50, review: 30 }

export const BAND_AR: Record<Band, string> = {
  priority: 'أولوية',
  eligible: 'مؤهّل',
  review: 'للمراجعة',
  not_eligible: 'غير مؤهّل',
}

export const DECISIONS = [
  'pending',
  'accept_support',
  'redirect_commercial',
  'need_more_info',
  'decline',
] as const
export type Decision = (typeof DECISIONS)[number]

export const DECISION_AR: Record<Decision, string> = {
  pending: 'لم يُقرَّر',
  accept_support: 'يدخل مسار المساندة',
  redirect_commercial: 'يرجع للمسار العادي',
  need_more_info: 'ناقص تثبّت أو معطى',
  decline: 'خارج ما تقدر عليه المنصّة',
}

/** قرارا الرفض والتحويل يستوجبان سبباً مكتوباً — نفس قيد القاعدة */
export const REASON_REQUIRED: readonly Decision[] = ['decline', 'redirect_commercial']
export const MIN_REASON_LENGTH = 10

export type Scores = Record<Criterion, number>

export type Verification = {
  phone_verified: boolean
  documents_checked: boolean
  home_visit_done: boolean
  third_party_confirmed: boolean
  inconsistencies_found: boolean
}

export type AssessmentResult = {
  total: number
  band: Band
  /** الفئة قبل حاجز الصحّة — تُعرض حتى يفهم المستشار لماذا نزلت */
  rawBand: Band
  capped: boolean
  capReason: string | null
  /** مساهمة كلّ معيار في المجموع، للشرح */
  contributions: Record<Criterion, number>
}

const clamp = (n: number) => Math.max(0, Math.min(MAX_SCORE, Math.round(n)))

/** أوزان معدّلة إلى 100 — لو عدّل الفريق واحداً ونسي الباقي */
export function normalizeWeights(w: Partial<Weights> | null | undefined): Weights {
  const merged: Weights = { ...DEFAULT_WEIGHTS, ...(w ?? {}) }
  const sum = CRITERIA.reduce((s, c) => s + Math.max(0, Number(merged[c]) || 0), 0)
  if (sum <= 0) return { ...DEFAULT_WEIGHTS }
  const out = {} as Weights
  for (const c of CRITERIA) out[c] = (Math.max(0, Number(merged[c]) || 0) * 100) / sum
  return out
}

export function bandOf(total: number, t: Thresholds = DEFAULT_THRESHOLDS): Band {
  if (total >= t.priority) return 'priority'
  if (total >= t.eligible) return 'eligible'
  if (total >= t.review) return 'review'
  return 'not_eligible'
}

const BAND_RANK: Record<Band, number> = { not_eligible: 0, review: 1, eligible: 2, priority: 3 }
const lower = (a: Band, b: Band): Band => (BAND_RANK[a] <= BAND_RANK[b] ? a : b)

/**
 * الحساب. المجموع = Σ (درجة/3 × وزن). ثمّ حاجز الصحّة:
 *  - تناقض مرصود → لا يتجاوز «للمراجعة»
 *  - بلا أيّ تثبّت (verification = 0 ولا خانة مُعلَّمة) → لا يتجاوز «للمراجعة»
 *  - تثبّت بمكالمة فقط → لا يتجاوز «مؤهّل» (الأولوية تستوجب وثيقة أو زيارة)
 */
export function assess(
  scores: Scores,
  verification: Verification,
  weights: Weights = DEFAULT_WEIGHTS,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): AssessmentResult {
  const w = normalizeWeights(weights)
  const contributions = {} as Record<Criterion, number>
  let total = 0
  for (const c of CRITERIA) {
    const part = (clamp(scores[c] ?? 0) / MAX_SCORE) * w[c]
    contributions[c] = Math.round(part * 10) / 10
    total += part
  }
  const rounded = Math.round(total)
  const rawBand = bandOf(rounded, thresholds)

  const anyCheck =
    verification.phone_verified ||
    verification.documents_checked ||
    verification.home_visit_done ||
    verification.third_party_confirmed
  const strongCheck =
    verification.documents_checked || verification.home_visit_done || verification.third_party_confirmed

  let band = rawBand
  let capReason: string | null = null
  if (verification.inconsistencies_found) {
    band = lower(band, 'review')
    capReason = 'تناقض مرصود في المعطيات — يبقى للمراجعة حتى يُحلّ'
  } else if (!anyCheck || clamp(scores.verification) === 0) {
    band = lower(band, 'review')
    capReason = 'لا تثبّت بعدُ — الأولوية والأهلية تستوجبان تثبّتاً'
  } else if (!strongCheck) {
    band = lower(band, 'eligible')
    capReason = 'تثبّت بمكالمة فقط — الأولوية تستوجب وثيقة أو شهادة أو زيارة'
  }

  return { total: rounded, band, rawBand, capped: band !== rawBand, capReason, contributions }
}

/** هل القرار مكتمل الشروط؟ يرجّع سبب النقص أو null */
export function decisionProblem(decision: Decision, reason: string | null | undefined): string | null {
  if (REASON_REQUIRED.includes(decision) && (reason ?? '').trim().length < MIN_REASON_LENGTH) {
    return `قرار «${DECISION_AR[decision]}» يستوجب سبباً مكتوباً (${MIN_REASON_LENGTH} أحرف على الأقلّ)`
  }
  return null
}
