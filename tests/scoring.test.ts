import { describe, expect, it } from 'vitest'
import { ALGO_VERSION, citizenMessage, computeScore, type ScoreInput } from '@/lib/scoring'
import type { FinanceSettings } from '@/lib/finance'

const S: FinanceSettings = {
  annualRatePct: 8,
  maxDtiPct: 40,
  maxYears: 20,
  registrationFeesPct: 0,
}

const base: ScoreInput = {
  monthlyIncome: 2500,
  employment: 'public',
  seniorityMonths: 36,
  horizon: 'now',
  ownsLand: false,
  filledFields: 5,
  totalFields: 10,
  settings: S,
}

describe('بنية التنقيط', () => {
  it('مجموع أوزان المعايير 100 نقطة', () => {
    const r = computeScore(base)
    expect(r.criteria.reduce((s, c) => s + c.weight, 0)).toBe(100)
  })

  it('لا تتجاوز نقاط أيّ معيار وزنه', () => {
    const r = computeScore({ ...base, monthlyIncome: 50000, downPayment: 500000 })
    for (const c of r.criteria) {
      expect(c.points).toBeLessThanOrEqual(c.weight)
      expect(c.points).toBeGreaterThanOrEqual(0)
    }
  })

  it('المجموع بين 0 و100 ونسخة الخوارزمية مسجّلة', () => {
    const r = computeScore(base)
    expect(r.total).toBeGreaterThanOrEqual(0)
    expect(r.total).toBeLessThanOrEqual(100)
    expect(r.algoVersion).toBe(ALGO_VERSION)
  })

  it('لكلّ معيار سبب مكتوب — التنقيط قابل للشرح', () => {
    for (const c of computeScore(base).criteria) {
      expect(c.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('الأصناف', () => {
  const band = (total: number) => (total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 45 ? 'C' : 'D')

  it('الصنف يطابق عتبات المجموع', () => {
    const cases: ScoreInput[] = [
      { ...base, monthlyIncome: 6000, downPayment: 200000, ownsLand: true, landTitleStatus: 'titled', filledFields: 10 },
      base,
      { ...base, monthlyIncome: 900, existingLoans: 350, horizon: '24m', employment: 'informal', filledFields: 1 },
    ]
    for (const c of cases) {
      const r = computeScore(c)
      expect(r.band).toBe(band(r.total))
    }
  })

  it('ملفّ قويّ يفوق ملفّاً ضعيفاً', () => {
    const strong = computeScore({
      ...base,
      monthlyIncome: 5000,
      downPayment: 120000,
      ownsLand: true,
      landTitleStatus: 'titled',
      filledFields: 10,
    })
    const weak = computeScore({
      ...base,
      monthlyIncome: 800,
      existingLoans: 300,
      employment: 'informal',
      horizon: '24m',
      filledFields: 1,
    })
    expect(strong.total).toBeGreaterThan(weak.total)
  })
})

describe('معايير بعينها', () => {
  it('أرض برسم عقاري تعطي كامل نقاط المعيار', () => {
    const r = computeScore({ ...base, ownsLand: true, landTitleStatus: 'titled' })
    expect(r.criteria.find((c) => c.key === 'land')?.points).toBe(8)
  })

  it('أرض في طور التسوية تعطي نصف النقاط', () => {
    const r = computeScore({ ...base, ownsLand: true, landTitleStatus: 'in_progress' })
    expect(r.criteria.find((c) => c.key === 'land')?.points).toBe(4)
  })

  it('الأفق الفوري يفوق أفق السنتين', () => {
    const now = computeScore({ ...base, horizon: 'now' })
    const later = computeScore({ ...base, horizon: '24m' })
    expect(now.criteria.find((c) => c.key === 'horizon')!.points).toBeGreaterThan(
      later.criteria.find((c) => c.key === 'horizon')!.points
    )
  })

  it('الأقساط الجارية المستهلكة للسقف تُصفّر معيار السداد', () => {
    const r = computeScore({ ...base, monthlyIncome: 1000, existingLoans: 500 })
    expect(r.criteria.find((c) => c.key === 'repayment')?.points).toBe(0)
    expect(r.maxLoan).toBe(0)
  })

  it('ميزانية مستهدفة أكبر من القدرة تنقص نقاط السداد', () => {
    const affordable = computeScore({ ...base, targetBudget: 50000 })
    const stretch = computeScore({ ...base, targetBudget: 400000 })
    expect(stretch.criteria.find((c) => c.key === 'repayment')!.points).toBeLessThan(
      affordable.criteria.find((c) => c.key === 'repayment')!.points
    )
  })

  it('ملفّ مكتمل يفوق ملفّاً ناقصاً في معيار الاكتمال', () => {
    const full = computeScore({ ...base, filledFields: 10, totalFields: 10 })
    const partial = computeScore({ ...base, filledFields: 2, totalFields: 10 })
    expect(full.criteria.find((c) => c.key === 'completeness')!.points).toBeGreaterThan(
      partial.criteria.find((c) => c.key === 'completeness')!.points
    )
  })
})

describe('رسالة الحريف', () => {
  it('رسالة لكلّ صنف ولا تكشف الحرف', () => {
    for (const b of ['A', 'B', 'C', 'D'] as const) {
      const msg = citizenMessage(b)
      expect(msg.length).toBeGreaterThan(10)
      expect(msg).not.toContain(b)
    }
  })
})

import { seniorityYearsLabel } from '@/lib/scoring'

describe('عرض الأقدمية بالسنين', () => {
  it('يحوّل الأشهر المخزّنة إلى سنين', () => {
    expect(seniorityYearsLabel(36)).toBe('3 سنوات')
    expect(seniorityYearsLabel(24)).toBe('سنتان')
    expect(seniorityYearsLabel(12)).toBe('سنة')
  })

  it('يحترم صيغة الجمع العربية فوق العشرة', () => {
    expect(seniorityYearsLabel(144)).toBe('12 سنة')
    expect(seniorityYearsLabel(120)).toBe('10 سنوات')
  })

  it('أقلّ من سنة تُكتب كما هي لا صفراً', () => {
    expect(seniorityYearsLabel(8)).toBe('أقلّ من سنة')
    expect(seniorityYearsLabel(0)).toBe('أقلّ من سنة')
    expect(seniorityYearsLabel(undefined)).toBe('أقلّ من سنة')
  })

  it('الكسور تُعرض بمنزلة واحدة', () => {
    expect(seniorityYearsLabel(18)).toBe('1.5 سنة')
  })

  it('سنتان من الأقدمية تعطيان كامل نقاط الاستقرار الزمني', () => {
    const junior = computeScore({ ...base, seniorityMonths: 0 })
    const senior = computeScore({ ...base, seniorityMonths: 24 })
    const veteran = computeScore({ ...base, seniorityMonths: 120 })
    const pts = (r: ReturnType<typeof computeScore>) =>
      r.criteria.find((c) => c.key === 'stability')!.points
    expect(pts(senior)).toBeGreaterThan(pts(junior))
    expect(pts(veteran)).toBe(pts(senior))
  })
})
