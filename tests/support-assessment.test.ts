import { describe, expect, it } from 'vitest'
import {
  CRITERIA,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  RUBRIC,
  assess,
  bandOf,
  decisionProblem,
  normalizeWeights,
  type Scores,
  type Verification,
} from '@/lib/support-assessment'

const none: Verification = {
  phone_verified: false,
  documents_checked: false,
  home_visit_done: false,
  third_party_confirmed: false,
  inconsistencies_found: false,
}
const visited: Verification = { ...none, phone_verified: true, home_visit_done: true }
const phoneOnly: Verification = { ...none, phone_verified: true }

const s = (v: Partial<Scores>): Scores => ({
  vulnerability: 0, urgency: 0, housing_gap: 0, self_effort: 0, feasibility: 0, verification: 0, ...v,
})

describe('الأوزان والوصف', () => {
  it('الأوزان الافتراضية مجموعها 100 ولكلّ معيار وصف بأربع درجات', () => {
    expect(CRITERIA.reduce((a, c) => a + DEFAULT_WEIGHTS[c], 0)).toBe(100)
    for (const c of CRITERIA) {
      expect(RUBRIC[c].levels).toHaveLength(4)
      expect(RUBRIC[c].levels.every((l) => l.length > 5)).toBe(true)
    }
  })

  it('لو عدّل الفريق وزناً ونسي الباقي، تُعاد التسوية إلى 100', () => {
    const w = normalizeWeights({ vulnerability: 50 })
    expect(Math.round(CRITERIA.reduce((a, c) => a + w[c], 0))).toBe(100)
    expect(w.vulnerability).toBeGreaterThan(w.urgency)
  })

  it('أوزان فاسدة ترجع للافتراضي بدل القسمة على صفر', () => {
    expect(normalizeWeights({ vulnerability: 0, urgency: 0, housing_gap: 0, self_effort: 0, feasibility: 0, verification: 0 }))
      .toEqual(DEFAULT_WEIGHTS)
  })
})

describe('المجموع والفئة', () => {
  it('كلّه صفر = 0 غير مؤهّل، كلّه 3 مع زيارة = 100 أولوية', () => {
    expect(assess(s({}), none).total).toBe(0)
    const top = assess(s({ vulnerability: 3, urgency: 3, housing_gap: 3, self_effort: 3, feasibility: 3, verification: 3 }), visited)
    expect(top.total).toBe(100)
    expect(top.band).toBe('priority')
    expect(top.capped).toBe(false)
  })

  it('المساهمات تشرح المجموع: 3/3 من معيار وزنه 25 = 25', () => {
    const r = assess(s({ vulnerability: 3, verification: 3 }), visited)
    expect(r.contributions.vulnerability).toBe(25)
    expect(r.contributions.verification).toBe(10)
    expect(r.total).toBe(35)
  })

  it('حدود الفئات', () => {
    expect(bandOf(70)).toBe('priority')
    expect(bandOf(69)).toBe('eligible')
    expect(bandOf(50)).toBe('eligible')
    expect(bandOf(49)).toBe('review')
    expect(bandOf(30)).toBe('review')
    expect(bandOf(29)).toBe('not_eligible')
    expect(bandOf(69, { ...DEFAULT_THRESHOLDS, priority: 60 })).toBe('priority')
  })

  it('درجة خارج 0–3 تُقصّ لا تُرفض', () => {
    const r = assess(s({ vulnerability: 9, urgency: -4, verification: 3 }), visited)
    expect(r.contributions.vulnerability).toBe(25)
    expect(r.contributions.urgency).toBe(0)
  })
})

describe('حاجز الصحّة — لا أولوية بلا تثبّت', () => {
  const dramatic = s({ vulnerability: 3, urgency: 3, housing_gap: 3, self_effort: 2, feasibility: 3, verification: 0 })

  it('حكاية مؤثّرة بلا أيّ تثبّت تبقى «للمراجعة» مهما بلغت الدرجة', () => {
    const r = assess(dramatic, none)
    expect(r.total).toBeGreaterThanOrEqual(70) // الدرجة الخام أولوية
    expect(r.rawBand).toBe('priority')
    expect(r.band).toBe('review')
    expect(r.capped).toBe(true)
    expect(r.capReason).toMatch(/لا تثبّت/)
  })

  it('مكالمة فقط ترفع إلى «مؤهّل» لا أكثر', () => {
    const r = assess({ ...dramatic, verification: 1 }, phoneOnly)
    expect(r.rawBand).toBe('priority')
    expect(r.band).toBe('eligible')
    expect(r.capReason).toMatch(/مكالمة فقط/)
  })

  it('وثيقة أو زيارة تفتح الأولوية', () => {
    const r = assess({ ...dramatic, verification: 3 }, visited)
    expect(r.band).toBe('priority')
    expect(r.capped).toBe(false)
  })

  it('تناقض مرصود يهبط إلى «للمراجعة» حتى مع زيارة', () => {
    const r = assess({ ...dramatic, verification: 3 }, { ...visited, inconsistencies_found: true })
    expect(r.band).toBe('review')
    expect(r.capReason).toMatch(/تناقض/)
  })

  it('الحاجز ينزل ولا يرفع أبداً', () => {
    const weak = s({ vulnerability: 1, verification: 3 })
    const r = assess(weak, visited)
    expect(r.band).toBe(r.rawBand)
    expect(r.band).toBe('not_eligible')
  })
})

describe('القرار', () => {
  it('الرفض والتحويل بلا سبب مرفوضان، والقبول لا يستوجب سبباً', () => {
    expect(decisionProblem('decline', '')).toMatch(/سبباً/)
    expect(decisionProblem('redirect_commercial', 'قصير')).toMatch(/سبباً/)
    expect(decisionProblem('decline', 'الحاجة مالية صرفة وخارج ما تقدر عليه المنصّة')).toBeNull()
    expect(decisionProblem('accept_support', '')).toBeNull()
    expect(decisionProblem('pending', null)).toBeNull()
  })
})
