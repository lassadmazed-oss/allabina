/**
 * البنوك ومدّة التمويل — القواعد النقيّة المشتركة بين الاستمارة والمحاكي.
 *
 * الحريف يختار المدّة والبنك الذي يفكّر فيه، والتقدير يتبدّل بهما. لا شرط
 * بنكي مكتوب هنا: النسبة والمدّة القصوى تأتيان من جدول banks إن سجّلها
 * الفريق بمصدر وتاريخ، وإلّا تبقى الفرضية العامّة — والواجهة تقول صراحةً
 * أيّهما استُعمل. اسم بنك بجانب رقم لا يعني شرطه ما لم يُسجَّل.
 */

import { toAsciiDigits } from '@/lib/digits'
import type { FinanceSettings } from '@/lib/finance'

export type Bank = {
  code: string
  name_ar: string
  name_fr: string
  is_islamic: boolean
  /** نسبة سنوية تقديرية سجّلها الفريق — null = لا نعرف */
  indicative_rate_pct: number | null
  /** أقصى مدّة يموّل عليها البنك — null = لا نعرف */
  max_years: number | null
  /** أقصى نسبة تمويل من الكلفة — للعرض لا للحساب */
  max_share_pct: number | null
  terms_source: string | null
  terms_verified_at: string | null
}

/** المدد المعروضة للاختيار: التمويل السكني في تونس لا يتجاوز عادةً 25 سنة */
export const LOAN_YEAR_CHOICES = [5, 10, 15, 20, 25] as const

export const BANK_CODE = /^[a-z0-9_]{2,20}$/

export function bankName(b: Pick<Bank, 'name_ar' | 'name_fr'>, locale: 'ar' | 'fr'): string {
  return locale === 'fr' ? b.name_fr : b.name_ar
}

export type LoanTerms = {
  /** المدّة المستعملة في الحساب */
  years: number
  /** النسبة المستعملة في الحساب */
  ratePct: number
  /** 'bank' = نسبة سجّلها الفريق لهذا البنك · 'general' = الفرضية العامّة */
  rateSource: 'bank' | 'general'
  /** سقف المدّة عند البنك إن كان مسجّلاً */
  maxYears: number | null
  /** المدّة المطلوبة تجاوزت سقف البنك فقُصّت إليه */
  capped: boolean
}

/**
 * شروط الحساب: مدّة الحريف (أو الفرضية العامّة إن لم يختر)، مقصوصة إلى
 * سقف البنك إن كان معروفاً، ونسبة البنك إن سُجّلت وإلّا النسبة العامّة.
 */
export function loanTermsFor(
  assumptions: FinanceSettings,
  bank: Bank | null | undefined,
  chosenYears?: number | null
): LoanTerms {
  const maxYears = bank?.max_years ?? null
  const wanted = chosenYears && chosenYears > 0 ? Math.round(chosenYears) : assumptions.maxYears
  const years = maxYears != null ? Math.min(wanted, maxYears) : wanted
  const rate = bank?.indicative_rate_pct
  return {
    years,
    ratePct: rate != null ? Number(rate) : assumptions.annualRatePct,
    rateSource: rate != null ? 'bank' : 'general',
    maxYears,
    capped: maxYears != null && wanted > maxYears,
  }
}

/** الإعدادات بعد تطبيق الشروط — تُمرَّر إلى computeCapacity مع years */
export function settingsFor(assumptions: FinanceSettings, terms: LoanTerms): FinanceSettings {
  return { ...assumptions, annualRatePct: terms.ratePct, maxYears: terms.years }
}

// ---------------------------------------------------------------- المحاكي بعد الإرسال

/**
 * بعد إرسال المطلب يفتح الحريف المحاكي فيجده معمَّراً بما كتبه، لا بقيم
 * افتراضية لا تخصّه. البذرة تُكتب في متصفّحه وحده عند الإرسال: لا رابط
 * يحمل دخله، ولا خادم يرجعه لمن يعرف رمز المطلب.
 */
export const SIM_SEED_KEY = 'allabina.sim.seed'
const SEED_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type SimSeed = {
  v: 1
  at: number
  monthlyIncome: number
  spouseIncome: number
  otherIncome: number
  existingLoans: number
  downPayment: number
  years: number | null
  bankCode: string | null
}

type Amount = string | number | boolean | null | undefined

const amount = (x: Amount): number => {
  const n = Number(toAsciiDigits(String(x ?? '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const MONEY_KEYS = ['monthlyIncome', 'spouseIncome', 'otherIncome', 'existingLoans', 'downPayment'] as const

export function makeSimSeed(
  input: {
    monthlyIncome?: Amount
    spouseIncome?: Amount
    otherIncome?: Amount
    existingLoans?: Amount
    downPayment?: Amount
    years?: number | null
    bankCode?: string | null
  },
  now = Date.now()
): SimSeed {
  return {
    v: 1,
    at: now,
    monthlyIncome: amount(input.monthlyIncome),
    spouseIncome: amount(input.spouseIncome),
    otherIncome: amount(input.otherIncome),
    existingLoans: amount(input.existingLoans),
    downPayment: amount(input.downPayment),
    years: input.years != null && input.years >= 1 && input.years <= 30 ? Math.round(input.years) : null,
    bankCode: input.bankCode && BANK_CODE.test(input.bankCode) ? input.bankCode : null,
  }
}

/** يقرأ البذرة من المتصفّح؛ قديمة أو مكسورة أو مشكوك فيها = لا شيء */
export function parseSimSeed(raw: string | null | undefined, now = Date.now()): SimSeed | null {
  if (!raw) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || o.v !== 1 || typeof o.at !== 'number') return null
  if (now - o.at > SEED_TTL_MS || o.at - now > 60_000) return null
  for (const k of MONEY_KEYS) {
    const v = o[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  }
  let years: number | null = null
  if (o.years != null) {
    if (typeof o.years !== 'number' || o.years < 1 || o.years > 30) return null
    years = o.years
  }
  let bankCode: string | null = null
  if (o.bankCode != null) {
    if (typeof o.bankCode !== 'string' || !BANK_CODE.test(o.bankCode)) return null
    bankCode = o.bankCode
  }
  return {
    v: 1,
    at: o.at,
    monthlyIncome: o.monthlyIncome as number,
    spouseIncome: o.spouseIncome as number,
    otherIncome: o.otherIncome as number,
    existingLoans: o.existingLoans as number,
    downPayment: o.downPayment as number,
    years,
    bankCode,
  }
}
