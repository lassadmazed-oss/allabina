/**
 * قياس الطلب الحقيقي — التعريفات والمنطق الخالص.
 *
 * كرّاس الشروط V2، القسم 09: «**تعريف كل نسبة ومقامها وفترة القياس**»،
 * و«فصل أشخاص فريدين عن عدد نسخ التقدير»، و«**الطلب الاستكشافي لا
 * يساوي طلب شراء**».
 *
 * هذه الجمل الثلاث هي الملفّ. لوحةٌ تعرض «نسبة التحويل 12%» بلا مقام
 * رقمٌ لا يُراجَع: 12% من ماذا؟ من الزوّار أم من الحسابات؟ في أيّ
 * مدّة؟ فكلّ نسبة هنا تحمل بَسْطها ومقامها بالاسم، واللوحة تعرضهما.
 */

export const EVENTS = [
  'category_view',
  'trial_start',
  'account_requested',
  'account_verified',
  'project_saved',
  'estimate',
  'review_requested',
  'inspection',
  'devis_approved',
  'accepted',
  'contract',
] as const
export type EventName = (typeof EVENTS)[number]

export const EVENT_AR: Record<EventName, string> = {
  category_view: 'تصفّح صنف',
  trial_start: 'بدء تجربة',
  account_requested: 'طلب حساب',
  account_verified: 'حساب مثبَّت',
  project_saved: 'مشروع محفوظ',
  estimate: 'تقدير',
  review_requested: 'طلب مراجعة',
  inspection: 'معاينة',
  devis_approved: 'devis معتمد',
  accepted: 'قبول',
  contract: 'عقد',
}

/**
 * استكشاف أم التزام؟
 *
 * «الطلب الاستكشافي لا يساوي طلب شراء». من يتصفّح صنفاً ويحسب تقديراً
 * يستكشف؛ من يطلب مراجعة أو معاينة يلتزم. خلطهما في عدّاد واحد يعطي
 * رقماً كبيراً يسرّ ولا يعني شيئاً.
 */
export const EXPLORATORY: readonly EventName[] = [
  'category_view',
  'trial_start',
  'account_requested',
  'project_saved',
  'estimate',
]
export const COMMITTED: readonly EventName[] = [
  'account_verified',
  'review_requested',
  'inspection',
  'devis_approved',
  'accepted',
  'contract',
]

export const isExploratory = (e: EventName) => EXPLORATORY.includes(e)

// ───────────────────────────────────────────────────── الفئات

/**
 * المساحة فئةً لا قيمةً.
 * «120 م²» في جدول قياس تعرّف ملفّاً بعينه حين تُقرن بالمعتمدية
 * والتاريخ. الفئة تكفي للقياس ولا تعرّف أحداً.
 */
export const AREA_BUCKETS = ['<80', '80-120', '120-160', '160-220', '220+'] as const
export type AreaBucket = (typeof AREA_BUCKETS)[number]

export function areaBucket(m2: number | null | undefined): AreaBucket | null {
  if (m2 === null || m2 === undefined || !Number.isFinite(m2) || m2 <= 0) return null
  if (m2 < 80) return '<80'
  if (m2 < 120) return '80-120'
  if (m2 < 160) return '120-160'
  if (m2 < 220) return '160-220'
  return '220+'
}

/** بالدينار. الحدود هي حدود السوق التونسية لا أرقام مستديرة لذاتها. */
export const BUDGET_BUCKETS = ['<80k', '80-150k', '150-250k', '250-400k', '400k+'] as const
export type BudgetBucket = (typeof BUDGET_BUCKETS)[number]

export function budgetBucket(tnd: number | null | undefined): BudgetBucket | null {
  if (tnd === null || tnd === undefined || !Number.isFinite(tnd) || tnd <= 0) return null
  if (tnd < 80_000) return '<80k'
  if (tnd < 150_000) return '80-150k'
  if (tnd < 250_000) return '150-250k'
  if (tnd < 400_000) return '250-400k'
  return '400k+'
}

// ──────────────────────────────────────────────── النسب ومقاماتها

/**
 * خطوة في القُمع: بَسْطٌ ومقامٌ بالاسم.
 * `unique: true` يعني أنّ العدّ أشخاصٌ فريدون لا أحداث — الفرق بين
 * «مئة تقدير» و«مئة شخص قدّروا» فرقُ قرارٍ لا فرقُ عرض.
 */
export type FunnelStep = {
  key: string
  label: string
  /** الحدث المعدود */
  event: EventName
  /** الخطوة التي تُقسَم عليها — null للأولى */
  of: string | null
  unique: boolean
}

export const FUNNEL: FunnelStep[] = [
  { key: 'visitors', label: 'زائر تصفّح صنفاً', event: 'category_view', of: null, unique: true },
  { key: 'trial', label: 'بدأ تجربة', event: 'trial_start', of: 'visitors', unique: true },
  { key: 'requested', label: 'طلب حساباً', event: 'account_requested', of: 'trial', unique: true },
  { key: 'verified', label: 'ثبّت حسابه', event: 'account_verified', of: 'requested', unique: true },
  { key: 'saved', label: 'حفظ مشروعاً', event: 'project_saved', of: 'verified', unique: true },
  { key: 'review', label: 'طلب مراجعة', event: 'review_requested', of: 'saved', unique: true },
  { key: 'approved', label: 'عرض معتمد', event: 'devis_approved', of: 'review', unique: true },
  { key: 'accepted', label: 'قبل العرض', event: 'accepted', of: 'approved', unique: true },
  { key: 'contract', label: 'عقد', event: 'contract', of: 'accepted', unique: true },
]

export type Counted = Record<string, number>

export type Ratio = {
  step: FunnelStep
  value: number
  /** البَسْط والمقام بالاسم — تُعرض مع النسبة لا بدلها */
  pct: number | null
  ofKey: string | null
  ofValue: number | null
  /** الانقطاع عند هذه الخطوة */
  dropped: number | null
}

/**
 * يبني القُمع من الأعداد.
 * النسبة بلا مقام لا تُحسَب: خطوة مقامها صفر تعطي `pct = null` لا
 * صفراً ولا مئة — لا شيء يُقسَم على لا شيء.
 */
export function funnelOf(counts: Counted, steps: FunnelStep[] = FUNNEL): Ratio[] {
  return steps.map((step) => {
    const value = counts[step.key] ?? 0
    if (!step.of) return { step, value, pct: null, ofKey: null, ofValue: null, dropped: null }
    const ofValue = counts[step.of] ?? 0
    return {
      step,
      value,
      ofKey: step.of,
      ofValue,
      pct: ofValue > 0 ? (value / ofValue) * 100 : null,
      dropped: ofValue > 0 ? ofValue - value : null,
    }
  })
}

/** فترة القياس — تُعرض دائماً مع الأرقام، فرقمٌ بلا مدّة لا يُقارَن */
export const PERIODS = [
  { key: '7d', label: 'آخر 7 أيّام', days: 7 },
  { key: '30d', label: 'آخر 30 يوماً', days: 30 },
  { key: '90d', label: 'آخر 90 يوماً', days: 90 },
  { key: 'all', label: 'منذ البداية', days: 0 },
] as const
export type PeriodKey = (typeof PERIODS)[number]['key']

export const periodStart = (key: PeriodKey, now: Date = new Date()): Date | null => {
  const p = PERIODS.find((x) => x.key === key)
  if (!p || p.days === 0) return null
  return new Date(now.getTime() - p.days * 86400_000)
}

/**
 * هل العيّنة تكفي لعرض نسبة؟
 *
 * «3 من 4 = 75%» رقمٌ يُتّخذ عليه قرار ولا يحتمله. تحت الحدّ تُعرض
 * الأعداد وحدها — والكرّاس يشترط «تعريف كل نسبة»، وجزءٌ من التعريف
 * أن تقول متى لا تعني شيئاً.
 */
export const MIN_SAMPLE = 20
export const ratioReliable = (ofValue: number | null) => (ofValue ?? 0) >= MIN_SAMPLE
