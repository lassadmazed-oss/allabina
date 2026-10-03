import { describe, expect, it } from 'vitest'
import { computeCapacity, type FinanceSettings } from '@/lib/finance'
import { loanTermsFor, makeSimSeed, parseSimSeed, settingsFor, type Bank } from '@/lib/banks'

const A: FinanceSettings = { annualRatePct: 8, maxDtiPct: 40, maxYears: 20, registrationFeesPct: 0 }

const bank = (o: Partial<Bank> = {}): Bank => ({
  code: 'bh',
  name_ar: 'بنك الإسكان (BH Bank)',
  name_fr: 'BH Bank',
  is_islamic: false,
  indicative_rate_pct: null,
  max_years: null,
  max_share_pct: null,
  terms_source: null,
  terms_verified_at: null,
  ...o,
})

const loanAt = (b: Bank | null, years: number | null) => {
  const t = loanTermsFor(A, b, years)
  return computeCapacity({ monthlyIncome: 2000, years: t.years, settings: settingsFor(A, t) }).maxLoan
}

describe('مدّة التمويل والبنك في التقدير', () => {
  it('بلا اختيار: الفرضية العامّة، ونفس رقم الشاشة قبل التغيير', () => {
    const t = loanTermsFor(A, null, null)
    expect(t).toMatchObject({ years: 20, ratePct: 8, rateSource: 'general', maxYears: null, capped: false })
    const c = computeCapacity({ monthlyIncome: 2000, years: t.years, settings: settingsFor(A, t) })
    expect(Math.round(c.maxPayment)).toBe(800)
    expect(c.maxLoan).toBeCloseTo(95643, -1)
  })

  it('كلّ مدّة أطول تعطي تمويلاً أكبر', () => {
    expect(loanAt(null, 5)).toBeLessThan(loanAt(null, 10))
    expect(loanAt(null, 10)).toBeLessThan(loanAt(null, 15))
    expect(loanAt(null, 15)).toBeLessThan(loanAt(null, 20))
    expect(loanAt(null, 20)).toBeLessThan(loanAt(null, 25))
  })

  it('25 سنة تُحسب 25 ولو كانت الفرضية العامّة 20', () => {
    expect(loanTermsFor(A, null, 25)).toMatchObject({ years: 25, capped: false })
  })

  it('بنك بسقف مسجّل يقصّ المدّة ويقول ذلك', () => {
    const t = loanTermsFor(A, bank({ max_years: 20 }), 25)
    expect(t).toMatchObject({ years: 20, maxYears: 20, capped: true, rateSource: 'general' })
    expect(loanTermsFor(A, bank({ max_years: 20 }), 15)).toMatchObject({ years: 15, capped: false })
  })

  it('بنك بنسبة مسجّلة: الحساب بنسبته', () => {
    const b = bank({ indicative_rate_pct: 10.25 })
    expect(loanTermsFor(A, b, 20)).toMatchObject({ ratePct: 10.25, rateSource: 'bank' })
    expect(loanAt(b, 20)).toBeLessThan(loanAt(null, 20))
  })

  it('بنك بلا شروط مسجّلة: النسبة العامّة كما هي', () => {
    expect(loanTermsFor(A, bank(), 15)).toMatchObject({ years: 15, ratePct: 8, rateSource: 'general' })
  })
})

describe('المحاكي بمعطيات المطلب', () => {
  const now = 1_800_000_000_000

  it('يرجع كما كُتب، والأرقام العربية تُفهم', () => {
    const s = makeSimSeed(
      { monthlyIncome: '٢٤٠٠', spouseIncome: '1200', otherIncome: '', existingLoans: '150', downPayment: '40000', years: 15, bankCode: 'bh' },
      now
    )
    expect(s).toMatchObject({ monthlyIncome: 2400, spouseIncome: 1200, otherIncome: 0, existingLoans: 150, downPayment: 40000, years: 15, bankCode: 'bh' })
    expect(parseSimSeed(JSON.stringify(s), now + 1000)).toEqual(s)
  })

  it('قديمة أو مكسورة أو مزوّرة: لا شيء', () => {
    const s = makeSimSeed({ monthlyIncome: 2000, years: 20, bankCode: 'bh' }, now)
    expect(parseSimSeed(JSON.stringify(s), now + 31 * 24 * 3600 * 1000)).toBeNull()
    expect(parseSimSeed('{oops', now)).toBeNull()
    expect(parseSimSeed(null, now)).toBeNull()
    expect(parseSimSeed(JSON.stringify({ ...s, monthlyIncome: -5 }), now)).toBeNull()
    expect(parseSimSeed(JSON.stringify({ ...s, bankCode: '<script>' }), now)).toBeNull()
    expect(parseSimSeed(JSON.stringify({ ...s, years: 99 }), now)).toBeNull()
  })

  it('مدّة خارج المعقول أو رمز غريب لا يُكتبان أصلاً', () => {
    const s = makeSimSeed({ monthlyIncome: 1500, years: 0, bankCode: 'DROP TABLE' }, now)
    expect(s.years).toBeNull()
    expect(s.bankCode).toBeNull()
  })
})
