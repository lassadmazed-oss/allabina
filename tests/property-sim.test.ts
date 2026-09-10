import { describe, expect, it } from 'vitest'
import { candidateFit, simulate, type SimTerms } from '@/lib/property-sim'
import { monthlyPayment } from '@/lib/finance'

const terms: SimTerms = { downPct: 20, years: 25, ratePct: 9.5, dtiPct: 40 }

describe('simulate', () => {
  it('يقسم الثمن إلى تسبقة وقرض ويحسب القسط والدخل اللازم', () => {
    const s = simulate(250000, terms)
    expect(s.down).toBe(50000)
    expect(s.loan).toBe(200000)
    expect(s.monthly).toBeCloseTo(monthlyPayment(200000, 9.5, 25), 6)
    expect(s.incomeNeeded).toBeCloseTo((s.monthly * 100) / 40, 6)
  })

  it('تسبقة 100% = بلا قرض ولا قسط', () => {
    const s = simulate(80000, { ...terms, downPct: 100 })
    expect(s.loan).toBe(0)
    expect(s.monthly).toBe(0)
  })

  it('ثمن مفقود أو سالب لا يكسر الحساب', () => {
    expect(simulate(Number.NaN, terms).monthly).toBe(0)
    expect(simulate(-5, terms).price).toBe(0)
  })
})

describe('candidateFit', () => {
  it('حريف تكفيه التسبقة ويتحمّل القسط', () => {
    const s = simulate(100000, terms)
    const f = candidateFit(s, { income: 3000, existingLoans: 0, downPayment: 30000 }, terms)
    expect(f.downOk).toBe(true)
    expect(f.paymentOk).toBe(true)
    expect(f.affordablePrice).toBeGreaterThan(100000)
  })

  it('يقول كم ينقص من التسبقة وكم يفوق القسط قدرته', () => {
    const s = simulate(400000, terms)
    const f = candidateFit(s, { income: 2500, existingLoans: 400, downPayment: 50000 }, terms)
    expect(f.downOk).toBe(false)
    expect(f.downShort).toBe(80000 - 50000)
    expect(f.maxPayment).toBe(2500 * 0.4 - 400)
    expect(f.paymentOk).toBe(false)
    expect(f.paymentShort).toBeCloseTo(s.monthly - 600, 6)
    expect(f.affordablePrice).toBeLessThan(400000)
  })

  it('أقساط تستهلك كلّ القدرة: الثمن المتاح = التسبقة وحدها', () => {
    const s = simulate(150000, terms)
    const f = candidateFit(s, { income: 1000, existingLoans: 900, downPayment: 20000 }, terms)
    expect(f.maxPayment).toBe(0)
    expect(f.affordablePrice).toBe(20000)
  })
})
