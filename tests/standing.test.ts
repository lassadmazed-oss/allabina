import { describe, expect, it } from 'vitest'
import {
  SHARE_TOLERANCE,
  biggestDifferences,
  breakdownTotal,
  lotBreakdown,
  plusValue,
  sharesBalanced,
  shareTotal,
  standingCost,
  type LotShare,
} from '@/lib/standing'

/** توزيع مبسّط على أربعة lots، مجموعه 100% بالضبط */
const shares: LotShare[] = [
  { lotCode: 4, lotNameAr: 'الهيكل', sharePct: 40 },
  { lotCode: 1, lotNameAr: 'الدراسات', sharePct: 10 },
  { lotCode: 10, lotNameAr: 'الفرش', sharePct: 30 },
  { lotCode: 15, lotNameAr: 'المطبخ', sharePct: 20 },
]

describe('مجموع النسب', () => {
  it('يجمع ويقرّب على ثلاث منازل', () => {
    expect(shareTotal(shares)).toBe(100)
    expect(sharesBalanced(shares)).toBe(true)
  })

  it('يتسامح مع ضجيج التقريب ولا يتسامح مع نقص حقيقي', () => {
    const noisy = [...shares.slice(1), { ...shares[0], sharePct: 40 + SHARE_TOLERANCE / 2 }]
    expect(sharesBalanced(noisy)).toBe(true)

    const short = [...shares.slice(1), { ...shares[0], sharePct: 30 }]
    expect(sharesBalanced(short)).toBe(false)
    expect(shareTotal(short)).toBe(90)
  })
})

describe('توزيع السعر على الـLots', () => {
  it('يرتّب حسب رقم اللوط ويحسب الدينار للمتر', () => {
    const lines = lotBreakdown(1600, shares, 120)
    expect(lines.map((l) => l.lotCode)).toEqual([1, 4, 10, 15])
    expect(lines[1].perM2).toBe(640) // 40% من 1600
    expect(lines[0].perM2).toBe(160)
  })

  it('الأسطر تجمّع على السعر × المساحة بالضبط', () => {
    const lines = lotBreakdown(1600, shares, 120)
    expect(breakdownTotal(lines)).toBe(1600 * 120)
  })

  it('يمتصّ ضجيج التقريب الناتج عن النسب بثلاث منازل', () => {
    // 28 د/م² من 1800 = 1.556% بعد التقريب، وهو ما يخلّف دينارين
    const noisy: LotShare[] = [
      { lotCode: 1, lotNameAr: 'أ', sharePct: 1.556 },
      { lotCode: 2, lotNameAr: 'ب', sharePct: 98.444 },
    ]
    const lines = lotBreakdown(1800, noisy, 150)
    expect(breakdownTotal(lines)).toBe(1800 * 150)
  })

  it('لا يخبّئ توزيعاً ناقصاً فعلاً', () => {
    const short: LotShare[] = [{ lotCode: 1, lotNameAr: 'أ', sharePct: 50 }]
    const lines = lotBreakdown(1600, short, 120)
    expect(breakdownTotal(lines)).toBe(96000) // نصف 192 000، ظاهرٌ لا مُصحَّح
  })

  it('يرجّع فارغاً على مدخلات غير صالحة', () => {
    expect(lotBreakdown(0, shares, 120)).toEqual([])
    expect(lotBreakdown(1600, [], 120)).toEqual([])
    expect(lotBreakdown(1600, shares, 0).every((l) => l.total === 0)).toBe(true)
  })
})

describe('فرق السعر بين مستويين', () => {
  it('يحسب الزيادة بالدينار والنسبة', () => {
    const pv = plusValue(1600, 1800, 120)
    expect(pv.from).toBe(192000)
    expect(pv.to).toBe(216000)
    expect(pv.diff).toBe(24000)
    expect(pv.pct).toBe(12.5)
  })

  it('النزول لمستوى أرخص يعطي فرقاً سالباً', () => {
    expect(plusValue(2000, 1200, 100).diff).toBe(-80000)
  })

  it('كلفة المستوى صفر على مدخلات غير صالحة', () => {
    expect(standingCost(0, 120)).toBe(0)
    expect(standingCost(1600, 0)).toBe(0)
  })
})

describe('أين يظهر الفرق', () => {
  it('يرتّب اللوطات حسب حجم الفرق ويهمل ما لم يتغيّر', () => {
    const from = lotBreakdown(1600, shares, 120)
    const to = lotBreakdown(
      2000,
      [
        { lotCode: 4, lotNameAr: 'الهيكل', sharePct: 34 },
        { lotCode: 1, lotNameAr: 'الدراسات', sharePct: 8 },
        { lotCode: 10, lotNameAr: 'الفرش', sharePct: 38 },
        { lotCode: 15, lotNameAr: 'المطبخ', sharePct: 20 },
      ],
      120
    )

    const diffs = biggestDifferences(from, to, 3)
    expect(diffs).toHaveLength(3)
    expect(diffs[0].lotCode).toBe(10) // الفرش أكبر قفزة
    expect(diffs[0].diff).toBeGreaterThan(0)
    // الترتيب تنازلي بالقيمة المطلقة
    for (let i = 1; i < diffs.length; i++) {
      expect(Math.abs(diffs[i - 1].diff)).toBeGreaterThanOrEqual(Math.abs(diffs[i].diff))
    }
  })
})
