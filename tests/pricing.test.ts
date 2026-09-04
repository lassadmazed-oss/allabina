import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIERS,
  REFERENCE_PRICE_HT,
  SENSITIVITY_HT,
  buildCost,
  buildCostRange,
  buildableArea,
  tierByKey,
} from '@/lib/pricing'

describe('فئات البناء', () => {
  it('ثلاث فئات مرتّبة تصاعدياً بلا تداخل', () => {
    expect(DEFAULT_TIERS).toHaveLength(3)
    const [a, b, c] = DEFAULT_TIERS
    expect(a.max).toBeLessThanOrEqual(b.min)
    expect(b.max).toBeLessThanOrEqual(c.min)
  })

  it('السعر المرجعي داخل مجال دراسة الحساسية', () => {
    expect(REFERENCE_PRICE_HT).toBeGreaterThanOrEqual(SENSITIVITY_HT.min)
    expect(REFERENCE_PRICE_HT).toBeLessThanOrEqual(SENSITIVITY_HT.max)
  })

  it('السعر المرجعي لكلّ فئة داخل نطاقها', () => {
    for (const t of DEFAULT_TIERS) {
      expect(t.price).toBeGreaterThanOrEqual(t.min)
      expect(t.price).toBeLessThanOrEqual(t.max)
    }
  })
})

describe('حساب الكلفة', () => {
  it('الكلفة = المساحة × السعر', () => {
    expect(buildCost(100, 1500)).toBe(150000)
  })

  it('نطاق الكلفة يتبع نطاق الفئة', () => {
    const mid = tierByKey(DEFAULT_TIERS, 'mid')!
    expect(buildCostRange(100, mid)).toEqual({ min: mid.min * 100, max: mid.max * 100 })
  })

  it('المساحة الممكنة = الميزانية ÷ السعر', () => {
    expect(buildableArea(150000, 1500)).toBe(100)
  })

  it('يرجع صفراً للمدخلات غير الصالحة', () => {
    expect(buildCost(0, 1500)).toBe(0)
    expect(buildCost(100, 0)).toBe(0)
    expect(buildableArea(150000, 0)).toBe(0)
  })

  it('tierByKey يرجع null لمفتاح غير معروف', () => {
    expect(tierByKey(DEFAULT_TIERS, 'unknown')).toBeNull()
    expect(tierByKey(DEFAULT_TIERS, null)).toBeNull()
  })
})
