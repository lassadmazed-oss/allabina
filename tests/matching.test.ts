import { describe, expect, it } from 'vitest'
import {
  MATCH_WEIGHTS,
  matchScore,
  rankProperties,
  type MatchProperty,
  type MatchRequest,
} from '@/lib/matching'

const request: MatchRequest = {
  requestType: 'build_on_land',
  govCode: 'SFX',
  delegationId: 5,
  imadaId: null,
  desiredAreaM2: 100,
  maxBudget: 200000,
  ownsLand: false,
  scoreBand: 'B',
}

const land = (over: Partial<MatchProperty> = {}): MatchProperty => ({
  id: 'p1',
  kind: 'land',
  govCode: 'SFX',
  delegationId: 5,
  imadaId: null,
  areaM2: 300,
  builtAreaM2: null,
  priceTnd: 120000,
  status: 'approved',
  ...over,
})

describe('بنية المطابقة', () => {
  it('مجموع الأوزان 100', () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('لكلّ سبب نصّ مكتوب — المطابقة مفسَّرة لا صندوق أسود', () => {
    for (const r of matchScore(request, land()).reasons) {
      expect(r.ar.length).toBeGreaterThan(3)
      expect(r.points).toBeLessThanOrEqual(r.weight)
    }
  })

  it('النتيجة بين 0 و100', () => {
    const m = matchScore(request, land())
    expect(m.score).toBeGreaterThanOrEqual(0)
    expect(m.score).toBeLessThanOrEqual(100)
  })
})

describe('الموقع أوّلاً', () => {
  it('نفس المعتمدية يفوق معتمدية أخرى في نفس الولاية', () => {
    const same = matchScore(request, land()).score
    const other = matchScore(request, land({ delegationId: 9 })).score
    expect(same).toBeGreaterThan(other)
  })

  it('ولاية أخرى مانع قاطع', () => {
    const m = matchScore(request, land({ govCode: 'TUN' }))
    expect(m.blockers).toContain('العقار خارج ولاية المطلب')
  })

  it('نفس العمادة يعطي أعلى نصّ تفسيري', () => {
    const withImada = { ...request, imadaId: 12 }
    const m = matchScore(withImada, land({ imadaId: 12 }))
    expect(m.reasons.find((r) => r.key === 'location')?.ar).toContain('العمادة')
  })
})

describe('النوع والميزانية', () => {
  it('شقة لا تخدم مطلب البناء فوق أرض', () => {
    const m = matchScore(request, land({ kind: 'apartment' }))
    expect(m.blockers).toContain('نوع العقار لا يخدم نوع المطلب')
  })

  it('أرض أو دار تخدمان مطلب «أرض ودار»', () => {
    const req = { ...request, requestType: 'land_and_house' }
    expect(matchScore(req, land({ kind: 'land' })).blockers).toHaveLength(0)
    expect(
      matchScore(req, land({ kind: 'house', builtAreaM2: 100 })).blockers
    ).toHaveLength(0)
  })

  it('ثمن داخل الميزانية يفوق ثمناً على الحافّة', () => {
    const comfy = matchScore(request, land({ priceTnd: 140000 })).score
    const tight = matchScore(request, land({ priceTnd: 199000 })).score
    expect(comfy).toBeGreaterThan(tight)
  })

  it('تجاوز الميزانية بأكثر من 15% مانع قاطع', () => {
    const m = matchScore(request, land({ priceTnd: 260000 }))
    expect(m.blockers).toContain('الثمن يفوق الميزانية بأكثر من 15%')
  })

  it('تجاوز بسيط يبقى مقترحاً مع تنبيه التفاوض', () => {
    const m = matchScore(request, land({ priceTnd: 215000 }))
    expect(m.blockers).toHaveLength(0)
    expect(m.reasons.find((r) => r.key === 'budget')?.ar).toContain('تفاوض')
  })
})

describe('المساحة', () => {
  it('أرض أوسع من المطلوب تنال كامل نقاط المساحة', () => {
    const m = matchScore(request, land({ areaM2: 400 }))
    expect(m.reasons.find((r) => r.key === 'area')?.points).toBe(MATCH_WEIGHTS.area)
  })

  it('أرض أصغر بكثير مانع قاطع', () => {
    const m = matchScore(request, land({ areaM2: 50 }))
    expect(m.blockers).toContain('مساحة الأرض أصغر بكثير من المطلوب')
  })
})

describe('العروض غير المراجَعة', () => {
  it('عرض في انتظار المراجعة لا يُقترح', () => {
    const m = matchScore(request, land({ status: 'pending' }))
    expect(m.blockers).toContain('العرض غير مراجَع بعد')
  })
})

describe('ترتيب العروض', () => {
  const pool: MatchProperty[] = [
    land({ id: 'best', priceTnd: 130000, areaM2: 350 }),
    land({ id: 'far', delegationId: 9, priceTnd: 130000 }),
    land({ id: 'expensive', priceTnd: 300000 }),
    land({ id: 'pending', status: 'pending' }),
    land({ id: 'other-gov', govCode: 'TUN' }),
  ]

  it('يُقصي كلّ ما فيه مانع قاطع', () => {
    const ids = rankProperties(request, pool).map((m) => m.propertyId)
    expect(ids).not.toContain('expensive')
    expect(ids).not.toContain('pending')
    expect(ids).not.toContain('other-gov')
  })

  it('يرتّب تنازلياً ويضع الأقرب أوّلاً', () => {
    const ranked = rankProperties(request, pool)
    expect(ranked[0].propertyId).toBe('best')
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score)
  })

  it('يحترم الحدّ الأدنى والعدد الأقصى', () => {
    const top = rankProperties(request, pool)[0].score
    expect(rankProperties(request, pool, { minScore: top + 1 })).toHaveLength(0)
    expect(rankProperties(request, pool, { limit: 1 })).toHaveLength(1)
  })

  it('العرض الأمثل يجمع الموقع والنوع والميزانية والمساحة', () => {
    const best = rankProperties(request, pool)[0]
    expect(best.score).toBeGreaterThanOrEqual(90)
    expect(best.blockers).toHaveLength(0)
  })
})

/* ---------- الاتجاه المعاكس والفرص ---------- */

import { findOpportunities, rankRequests, type MatchRequestWithId } from '@/lib/matching'

const landOffer = {
  id: 'p-land',
  kind: 'land',
  govCode: 'SFX',
  delegationId: 1,
  imadaId: null,
  areaM2: 400,
  builtAreaM2: null,
  priceTnd: 90_000,
  status: 'approved',
}

const builder = (over: Partial<MatchRequestWithId> = {}): MatchRequestWithId => ({
  id: 'r1',
  requestType: 'build_on_land',
  govCode: 'SFX',
  delegationId: 1,
  imadaId: null,
  desiredAreaM2: 120,
  maxBudget: 150_000,
  ownsLand: false,
  scoreBand: 'B',
  ...over,
})

describe('من العرض إلى الحرفاء', () => {
  it('يرجّع الحرفاء المناسبين مرتّبين', () => {
    const near = builder({ id: 'near', delegationId: 1 })
    const far = builder({ id: 'far', delegationId: 2 })
    const out = rankRequests(landOffer, [far, near])
    expect(out.map((m) => m.requestId)).toEqual(['near', 'far'])
    expect(out[0].score).toBeGreaterThan(out[1].score)
  })

  it('نفس تنقيط الاتجاه الأصلي — لا محرّك ثانٍ', () => {
    const r = builder()
    const [reverse] = rankRequests(landOffer, [r])
    const [forward] = rankProperties(r, [landOffer])
    expect(reverse.score).toBe(forward.score)
  })

  it('يستبعد من فيه مانع قاطع: ولاية أخرى أو نوع لا يخدم', () => {
    expect(rankRequests(landOffer, [builder({ govCode: 'TUN' })])).toHaveLength(0)
    expect(rankRequests(landOffer, [builder({ requestType: 'apartment' })])).toHaveLength(0)
  })

  it('العرض غير المراجَع لا يطابق أحداً', () => {
    expect(rankRequests({ ...landOffer, status: 'pending' }, [builder()])).toHaveLength(0)
  })
})

describe('أين يلتقي الطلب بالعرض', () => {
  it('يجمّع حسب المنطقة والنوع ويعدّ الجاهز منها', () => {
    const out = findOpportunities(
      [
        builder({ id: 'a', scoreBand: 'A' }),
        builder({ id: 'b', scoreBand: 'D' }),
        builder({ id: 'c', delegationId: 2, scoreBand: 'B' }),
      ],
      [landOffer]
    )
    const first = out.find((o) => o.delegationId === 1)
    expect(first?.demand).toBe(2)
    expect(first?.readyDemand).toBe(1)
    expect(first?.supply).toBe(1)
  })

  it('يرتّب حسب التقاطعات الحقيقية لا حسب عدد المطالب', () => {
    const out = findOpportunities(
      [
        builder({ id: 'near1' }),
        builder({ id: 'near2' }),
        // منطقة أخرى: نفس الولاية فالعرض يطابق، لكن بتنقيط أقلّ
        builder({ id: 'far1', delegationId: 9 }),
        builder({ id: 'far2', delegationId: 9 }),
        builder({ id: 'far3', delegationId: 9 }),
      ],
      [landOffer]
    )
    // ثلاثة تقاطعات في المعتمدية 9 مقابل اثنين في 1 — الترتيب بالتقاطعات
    expect(out[0].delegationId).toBe(9)
    expect(out[0].pairs).toBe(3)
    // وأعلى تنقيط يبقى لمن هو في نفس المعتمدية
    const near = out.find((o) => o.delegationId === 1)!
    expect(near.bestScore).toBeGreaterThan(out[0].bestScore)
  })

  it('«العرض» يعني عروضاً طابقت فعلاً، لا جواراً جغرافياً', () => {
    // مطلب بعيد عن العرض: يطابق (نفس الولاية) فيُعدّ العرض عرضاً حقيقياً
    const out = findOpportunities([builder({ delegationId: 9 })], [landOffer])
    expect(out[0].supply).toBe(1)
    expect(out[0].pairs).toBe(1)
  })

  it('العرض المعدود هو المراجَع فقط', () => {
    const out = findOpportunities([builder()], [{ ...landOffer, status: 'pending' }])
    expect(out[0].supply).toBe(0)
    expect(out[0].pairs).toBe(0)
  })
})
