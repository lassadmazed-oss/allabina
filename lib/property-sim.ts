/**
 * محاكي العقار — دوال صافية بلا أثر جانبي.
 *
 * لكلّ عرض: كم تسبقة، كم قرض، كم قسط، وكم دخل يلزم. ولكلّ حريف مطابق:
 * هل تكفي تسبقته، هل يتحمّل القسط، وإن لا فكم ينقص وبأيّ ثمن يولّي في
 * متناوله. الفرضيات هي فرضيات الترتيب الداخلية (getFinanceContext) —
 * لا شروط بنك، والقرار للبنك.
 */
import { maxAffordablePayment, maxLoan, monthlyPayment } from './finance'

export type SimTerms = {
  /** التسبقة % من الثمن */
  downPct: number
  years: number
  ratePct: number
  /** سقف الاستدانة % من الدخل */
  dtiPct: number
}

export type SimResult = {
  price: number
  down: number
  loan: number
  monthly: number
  /** الدخل الشهري الأدنى الذي يتحمّل هذا القسط تحت سقف الاستدانة */
  incomeNeeded: number
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function simulate(price: number, t: SimTerms): SimResult {
  const p = Math.max(0, price || 0)
  const down = (p * clamp(t.downPct, 0, 100)) / 100
  const loan = Math.max(0, p - down)
  const monthly = monthlyPayment(loan, t.ratePct, t.years)
  const incomeNeeded = t.dtiPct > 0 ? (monthly * 100) / t.dtiPct : 0
  return { price: p, down, loan, monthly, incomeNeeded }
}

export type Candidate = {
  /** مجموع دخل الأسرة الشهري */
  income: number
  existingLoans: number
  downPayment: number
}

export type CandidateFit = {
  downOk: boolean
  paymentOk: boolean
  /** كم ينقصه من التسبقة (0 إن كفت) */
  downShort: number
  /** كم يفوق القسطُ قدرتَه شهرياً (0 إن تحمّله) */
  paymentShort: number
  maxPayment: number
  /** الثمن الأعلى الذي يتحمّله بنفس الشروط: قرضه الأقصى + تسبقته المتوفّرة */
  affordablePrice: number
}

export function candidateFit(sim: SimResult, c: Candidate, t: SimTerms): CandidateFit {
  const maxPayment = maxAffordablePayment(c.income, c.existingLoans, t.dtiPct)
  const downShort = Math.max(0, sim.down - c.downPayment)
  const paymentShort = Math.max(0, sim.monthly - maxPayment)
  const affordablePrice = maxLoan(maxPayment, t.ratePct, t.years) + Math.max(0, c.downPayment)
  return {
    downOk: downShort <= 0.5,
    paymentOk: paymentShort <= 0.5,
    downShort,
    paymentShort,
    maxPayment,
    affordablePrice,
  }
}
