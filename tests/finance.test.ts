import { describe, expect, it } from 'vitest'
import {
  computeCapacity,
  formatTND,
  maxAffordablePayment,
  maxLoan,
  monthlyPayment,
  type FinanceSettings,
} from '@/lib/finance'

/** فرضيات ثابتة للاختبار — ليست شروطاً بنكية */
const S: FinanceSettings = {
  annualRatePct: 8,
  maxDtiPct: 40,
  maxYears: 20,
  registrationFeesPct: 0,
}

describe('monthlyPayment', () => {
  it('يقسم المبلغ على عدد الأشهر عند نسبة صفر', () => {
    expect(monthlyPayment(120000, 0, 10)).toBeCloseTo(1000, 6)
  })

  it('يعطي قسطاً أكبر كلّما ارتفعت النسبة', () => {
    expect(monthlyPayment(100000, 10, 20)).toBeGreaterThan(monthlyPayment(100000, 5, 20))
  })

  it('يعطي قسطاً أصغر كلّما طالت المدّة', () => {
    expect(monthlyPayment(100000, 8, 25)).toBeLessThan(monthlyPayment(100000, 8, 10))
  })

  it('يرجع صفراً للمدخلات غير الصالحة', () => {
    expect(monthlyPayment(0, 8, 20)).toBe(0)
    expect(monthlyPayment(100000, 8, 0)).toBe(0)
    expect(monthlyPayment(-5000, 8, 20)).toBe(0)
  })
})

describe('maxLoan', () => {
  it('عكس monthlyPayment: القرض ← القسط ← القرض', () => {
    const loan = 150000
    const payment = monthlyPayment(loan, 8, 20)
    expect(maxLoan(payment, 8, 20)).toBeCloseTo(loan, 4)
  })

  it('يرجع صفراً بلا قسط', () => {
    expect(maxLoan(0, 8, 20)).toBe(0)
  })
})

describe('maxAffordablePayment', () => {
  it('سقف الاستدانة ناقص الأقساط الجارية', () => {
    expect(maxAffordablePayment(3000, 200, 40)).toBe(1000)
  })

  it('لا ينزل تحت الصفر مهما كانت الأقساط الجارية', () => {
    expect(maxAffordablePayment(1000, 900, 40)).toBe(0)
  })
})

describe('computeCapacity', () => {
  it('يجمع دخل القرين والدخل الآخر', () => {
    const c = computeCapacity({ monthlyIncome: 2000, spouseIncome: 900, otherIncome: 100, settings: S })
    expect(c.income).toBe(3000)
    expect(c.maxPayment).toBe(1200)
  })

  it('الميزانية = القرض + المساهمة الذاتية − المصاريف', () => {
    const withFees: FinanceSettings = { ...S, registrationFeesPct: 6 }
    const c = computeCapacity({ monthlyIncome: 3000, downPayment: 40000, settings: withFees })
    const gross = c.maxLoan + 40000
    expect(c.fees).toBeCloseTo(gross * 0.06, 6)
    expect(c.maxBudget).toBeCloseTo(gross - c.fees, 6)
  })

  it('لا يتجاوز المدّة القصوى المسموح بها', () => {
    const c = computeCapacity({ monthlyIncome: 3000, years: 40, settings: S })
    expect(c.years).toBe(S.maxYears)
  })

  it('قدرة صفرية حين تستهلك الأقساط الجارية كامل السقف', () => {
    const c = computeCapacity({ monthlyIncome: 1000, existingLoans: 500, settings: S })
    expect(c.maxPayment).toBe(0)
    expect(c.maxLoan).toBe(0)
  })

  it('الميزانية لا تكون سالبة', () => {
    const withFees: FinanceSettings = { ...S, registrationFeesPct: 200 }
    const c = computeCapacity({ monthlyIncome: 1200, settings: withFees })
    expect(c.maxBudget).toBeGreaterThanOrEqual(0)
  })
})

describe('formatTND', () => {
  it('يقرّب ويضيف الوحدة', () => {
    expect(formatTND(142499.7)).toContain('د.ت')
    expect(formatTND(0)).toContain('0')
  })
})
