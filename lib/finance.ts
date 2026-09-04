import { formatMoney } from './format'

/**
 * حسابات التمويل — دوال صافية، بلا أي أثر جانبي.
 * تُستعمل في مكانين: محاكي التمويل العلني، وحساب التنقيط في الخادم.
 * كل المبالغ بالدينار التونسي.
 */

export type FinanceSettings = {
  /** نسبة الفائدة السنوية % (مرجع + هامش بنكي) */
  annualRatePct: number
  /** سقف نسبة الاستدانة % من الدخل الصافي */
  maxDtiPct: number
  /** المدّة القصوى بالسنوات */
  maxYears: number
  /** مصاريف التسجيل والتسجيل العقاري % من ثمن الاقتناء */
  registrationFeesPct: number
}

export const PROVISIONAL_SETTINGS: FinanceSettings = {
  annualRatePct: 9.5,
  maxDtiPct: 40,
  maxYears: 25,
  registrationFeesPct: 6,
}

/** القسط الشهري لقرض بمبلغ وفائدة ومدّة معلومة */
export function monthlyPayment(loan: number, annualRatePct: number, years: number): number {
  if (loan <= 0 || years <= 0) return 0
  const i = annualRatePct / 100 / 12
  const n = years * 12
  if (i === 0) return loan / n
  return (loan * i) / (1 - Math.pow(1 + i, -n))
}

/** أقصى قسط شهري ممكن حسب الدخل والأقساط الجارية */
export function maxAffordablePayment(
  netIncome: number,
  existingLoans: number,
  maxDtiPct: number
): number {
  return Math.max(0, (netIncome * maxDtiPct) / 100 - existingLoans)
}

/** أقصى قرض ممكن انطلاقاً من القسط المتاح */
export function maxLoan(payment: number, annualRatePct: number, years: number): number {
  if (payment <= 0 || years <= 0) return 0
  const i = annualRatePct / 100 / 12
  const n = years * 12
  if (i === 0) return payment * n
  return (payment * (1 - Math.pow(1 + i, -n))) / i
}

export type Capacity = {
  /** مجموع الدخل الصافي الشهري */
  income: number
  /** أقصى قسط شهري */
  maxPayment: number
  /** أقصى قرض */
  maxLoan: number
  /** الميزانية الجملية: القرض + التسبقة − مصاريف التسجيل */
  maxBudget: number
  /** مصاريف التسجيل المقدّرة */
  fees: number
  years: number
  annualRatePct: number
}

export function computeCapacity(input: {
  monthlyIncome: number
  spouseIncome?: number
  otherIncome?: number
  existingLoans?: number
  downPayment?: number
  years?: number
  settings?: FinanceSettings
}): Capacity {
  const s = input.settings ?? PROVISIONAL_SETTINGS
  const years = Math.min(input.years ?? s.maxYears, s.maxYears)
  const income =
    (input.monthlyIncome || 0) + (input.spouseIncome || 0) + (input.otherIncome || 0)

  const maxPayment = maxAffordablePayment(income, input.existingLoans || 0, s.maxDtiPct)
  const loan = maxLoan(maxPayment, s.annualRatePct, years)
  const gross = loan + (input.downPayment || 0)
  const fees = (gross * s.registrationFeesPct) / 100
  return {
    income,
    maxPayment,
    maxLoan: loan,
    maxBudget: Math.max(0, gross - fees),
    fees,
    years,
    annualRatePct: s.annualRatePct,
  }
}

/**
 * تنسيق المبالغ بالدينار — التنسيق نفسه في كامل المنصة.
 * انظر lib/format.ts لسبب الفاصل الضيّق غير الفاصل بين الآلاف.
 */
export function formatTND(value: number, locale: 'ar' | 'fr' = 'ar'): string {
  return formatMoney(value, locale)
}
