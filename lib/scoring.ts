/**
 * تنقيط الحريف — نسخة v1.
 * 100 نقطة على ستّة معايير. كل نقطة لها سبب مكتوب، والنتيجة قابلة للشرح
 * للحريف وللبنك. الحساب في الخادم فقط.
 */
import { computeCapacity, monthlyPayment, type FinanceSettings } from './finance'

export const ALGO_VERSION = 'v1'

export type ScoreInput = {
  monthlyIncome: number
  spouseIncome?: number
  otherIncome?: number
  existingLoans?: number
  downPayment?: number
  maxMonthly?: number
  employment: string
  seniorityMonths?: number
  horizon?: string | null
  ownsLand: boolean
  landTitleStatus?: string | null
  desiredAreaM2?: number | null
  targetBudget?: number | null
  filledFields: number
  totalFields: number
  settings?: FinanceSettings
}

export type ScoreCriterion = {
  key: string
  label: string
  weight: number
  points: number
  reason: string
}

export type ScoreResult = {
  total: number
  band: 'A' | 'B' | 'C' | 'D'
  criteria: ScoreCriterion[]
  maxLoan: number
  maxBudget: number
  maxPayment: number
  algoVersion: string
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const round = (v: number) => Math.round(v * 10) / 10

export function computeScore(input: ScoreInput): ScoreResult {
  const capacity = computeCapacity({
    monthlyIncome: input.monthlyIncome,
    spouseIncome: input.spouseIncome,
    otherIncome: input.otherIncome,
    existingLoans: input.existingLoans,
    downPayment: input.downPayment,
    settings: input.settings,
  })

  const criteria: ScoreCriterion[] = []

  // 1) القدرة على السداد — 30
  // نسبة القسط المتاح إلى القسط اللازم لتمويل الميزانية المستهدفة.
  const target = input.targetBudget && input.targetBudget > 0 ? input.targetBudget : null
  let repayPoints: number
  let repayReason: string
  if (capacity.maxPayment <= 0) {
    repayPoints = 0
    repayReason = 'الأقساط الجارية تستهلك كامل القدرة على الاستدانة'
  } else if (target) {
    const needed = monthlyPayment(
      Math.max(0, target - (input.downPayment || 0)),
      capacity.annualRatePct,
      capacity.years
    )
    const ratio = needed > 0 ? capacity.maxPayment / needed : 2
    repayPoints = clamp(ratio, 0, 1) * 30
    repayReason =
      ratio >= 1
        ? 'القسط المتاح يغطّي الميزانية المستهدفة'
        : `القسط المتاح يغطّي ${Math.round(ratio * 100)}% من الميزانية المستهدفة`
  } else {
    // بلا ميزانية مستهدفة: نقيس القسط المتاح مقارنة بالدخل
    const ratio = capacity.income > 0 ? capacity.maxPayment / (capacity.income * 0.4) : 0
    repayPoints = clamp(ratio, 0, 1) * 30
    repayReason = `قسط شهري متاح في حدود ${Math.round(capacity.maxPayment)} د.ت`
  }
  criteria.push({
    key: 'repayment',
    label: 'القدرة على السداد',
    weight: 30,
    points: round(repayPoints),
    reason: repayReason,
  })

  // 2) التسبقة — 25 : ‎≥25%‎ من الميزانية = نقطة كاملة، ‎<10%‎ = صفر
  const budgetForRatio = target ?? capacity.maxBudget
  const downRatio =
    budgetForRatio > 0 ? (input.downPayment || 0) / budgetForRatio : 0
  const downPoints = clamp((downRatio - 0.1) / 0.15, 0, 1) * 25
  criteria.push({
    key: 'down_payment',
    label: 'التسبقة (المساهمة الذاتية)',
    weight: 25,
    points: round(downPoints),
    reason:
      (input.downPayment || 0) > 0
        ? `تسبقة تمثّل ${Math.round(downRatio * 100)}% من الميزانية`
        : 'بلا تسبقة مصرّح بها',
  })

  // 3) استقرار الدخل — 15
  const employmentBase: Record<string, number> = {
    public: 10,
    private: 8,
    expat: 8,
    retired: 7,
    self_employed: 6,
    other: 4,
    informal: 3,
  }
  const base = employmentBase[input.employment] ?? 4
  const seniority = clamp((input.seniorityMonths || 0) / 24, 0, 1) * 5
  criteria.push({
    key: 'stability',
    label: 'استقرار الدخل',
    weight: 15,
    points: round(base + seniority),
    reason: `${labelEmployment(input.employment)}، أقدمية ${seniorityYearsLabel(input.seniorityMonths)}`,
  })

  // 4) اكتمال الملفّ — 12
  const completeness =
    input.totalFields > 0 ? clamp(input.filledFields / input.totalFields, 0, 1) : 0
  criteria.push({
    key: 'completeness',
    label: 'اكتمال الملفّ',
    weight: 12,
    points: round(completeness * 12),
    reason: `${input.filledFields} من ${input.totalFields} معطى معبّأ`,
  })

  // 5) الأفق الزمني — 10
  const horizonPoints: Record<string, number> = { now: 10, '6m': 8, '12m': 5, '24m': 2 }
  const hp = input.horizon ? horizonPoints[input.horizon] ?? 2 : 2
  criteria.push({
    key: 'horizon',
    label: 'الأفق الزمني',
    weight: 10,
    points: hp,
    reason: labelHorizon(input.horizon),
  })

  // 6) أرض على الملك — 8
  let landPoints = 0
  let landReason = 'بلا أرض على الملك'
  if (input.ownsLand) {
    if (input.landTitleStatus === 'titled') {
      landPoints = 8
      landReason = 'أرض على الملك برسم عقاري'
    } else if (input.landTitleStatus === 'in_progress' || input.landTitleStatus === 'undivided') {
      landPoints = 4
      landReason = 'أرض على الملك في طور التسوية العقارية'
    } else {
      landPoints = 5
      landReason = 'أرض على الملك، الوضعية العقارية غير محدّدة'
    }
  }
  criteria.push({
    key: 'land',
    label: 'أرض أو مساهمة عينية',
    weight: 8,
    points: landPoints,
    reason: landReason,
  })

  const total = Math.round(criteria.reduce((sum, c) => sum + c.points, 0))
  const band: ScoreResult['band'] =
    total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 45 ? 'C' : 'D'

  return {
    total: clamp(total, 0, 100),
    band,
    criteria,
    maxLoan: Math.round(capacity.maxLoan),
    maxBudget: Math.round(capacity.maxBudget),
    maxPayment: Math.round(capacity.maxPayment),
    algoVersion: ALGO_VERSION,
  }
}

/**
 * الأقدمية تُعرض بالسنين وإن كانت مخزّنة بالأشهر،
 * مع صيغة الجمع العربية: سنة · سنتان · 3 سنوات · 11 سنة.
 */
export function seniorityYearsLabel(months?: number): string {
  const m = months || 0
  if (m < 12) return 'أقلّ من سنة'

  const years = Math.round((m / 12) * 10) / 10
  if (!Number.isInteger(years)) return `${years.toFixed(1)} سنة`
  if (years === 1) return 'سنة'
  if (years === 2) return 'سنتان'
  if (years <= 10) return `${years} سنوات`
  return `${years} سنة`
}

export function labelEmployment(v: string): string {
  return (
    {
      public: 'وظيفة عمومية',
      private: 'قطاع خاص',
      self_employed: 'عمل مستقلّ',
      informal: 'دخل غير قارّ',
      retired: 'متقاعد',
      expat: 'تونسي بالخارج',
      other: 'أخرى',
    }[v] ?? v
  )
}

export function labelHorizon(v?: string | null): string {
  return (
    {
      now: 'مستعدّ للانطلاق فوراً',
      '6m': 'في حدود ستّة أشهر',
      '12m': 'في حدود سنة',
      '24m': 'في حدود سنتين',
    }[v ?? ''] ?? 'الأفق الزمني غير محدّد'
  )
}

/** الرسالة المعروضة للحريف — الحروف A/B/C/D تبقى داخلية */
export function citizenMessage(band: ScoreResult['band']): string {
  switch (band) {
    case 'A':
      return 'ملفّك جاهز. باش نتّصلو بيك في ظرف 48 ساعة بعرض يناسب قدرتك.'
    case 'B':
      return 'ملفّك قابل للتمويل مع تعديل بسيط في التسبقة أو مدّة القرض. باش نتّصلو بيك للمرافقة.'
    case 'C':
      return 'نجّمو نلقاو لك حلّ بمساحة أو منطقة مختلفة، ولا بخطّة ادخار قصيرة. باش نتّصلو بيك.'
    default:
      return 'مطلبك تسجّل. بالمعطيات الحالية التمويل صعيب توّا، أمّا نعاودو نقيّمو ملفّك كي تتبدّل ظروفك.'
  }
}
