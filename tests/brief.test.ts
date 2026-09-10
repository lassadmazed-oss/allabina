import { describe, expect, it } from 'vitest'
import { buildBrief, splitPhases, type BriefInput } from '@/lib/brief'

/** ملفّ منى (LB-2026-000109) كما في اللوحة: A·87، بناء فوق أرضها، عرض يتجاوز الميزانية */
const mouna: BriefInput = {
  requestType: 'build_on_land',
  fullName: 'Mouna zoiri',
  bedrooms: 3,
  desiredAreaM2: 120,
  horizon: '6m',
  urgency: 'urgent',
  standingName: 'اقتصادي',
  delegation: 'صفاقس الجنوبية',
  landLocation: 'العين',
  financingState: 'not_started',
  cashReady: false,
  flexibility: ['area', 'phased'],
  isFirstHome: true,
  foprolosInterest: true,
  cnssAffiliated: true,
  cnssYears: 14,
  householdSize: 5,
  dependents: 3,
  isRenting: true,
  rentTnd: 500,
  fin: {
    monthlyIncome: 2000,
    spouseIncome: 500,
    otherIncome: 0,
    existingLoans: 400,
    downPayment: 50000,
    employment: 'public',
    seniorityMonths: 120,
    isExpat: false,
  },
  land: { areaM2: 400, titleStatus: 'titled', hasWater: true, hasPower: true, hasRoad: true, hasPermit: false, hasPlans: false },
  score: { total: 87, band: 'A', maxLoan: 71733, maxBudget: 121733 },
  devis: {
    total: 140395,
    surface: 120,
    version: 2,
    lots: [
      { code: 1, name: 'الدراسات', total: 2880 },
      { code: 4, name: 'الهيكل', total: 28778 },
      { code: 9, name: 'الكهرباء', total: 7211 },
      { code: 10, name: 'الفرش', total: 10842 },
      { code: 14, name: 'الدهن', total: 5766 },
    ],
  },
  docsMissing: ['الأمثلة الهندسية', 'رخصة البناء', 'شهادة عدم امتلاك مسكن'],
  openInquiries: 0,
  matchesCount: 3,
  ageDays: 1,
}

describe('buildBrief', () => {
  it('يقول في العنوان أنّ العرض يتجاوز الميزانية ويحسب الفجوة', () => {
    const b = buildBrief(mouna)
    expect(b.headline).toContain('A · 87')
    expect(b.headline).toContain('يتجاوز الميزانية')
    expect(b.headline).toMatch(/18[\s  ]?662/)
  })

  it('يقترح مساحة تدخل في الميزانية بنفس كلفة المتر', () => {
    const b = buildBrief(mouna)
    const shrink = b.solutions.find((s) => s.key === 'shrink')
    expect(shrink).toBeDefined()
    // 120 × 121733 / 140395 = 104.05 → 104
    expect(shrink?.figure).toBe('104 م²')
    // الحريف مستعدّ يتنازل على المساحة: يمشي الآن
    expect(shrink?.tone).toBe('go')
  })

  it('يقسم العرض إلى هيكل وتشطيب ويقول إن كانت المرحلة الأولى تدخل في الميزانية', () => {
    const b = buildBrief(mouna)
    const phased = b.solutions.find((s) => s.key === 'phased')
    expect(phased).toBeDefined()
    expect(phased?.why).toContain('المرحلة الأولى تدخل في الميزانية')
    expect(splitPhases(mouna.devis!.lots)).toEqual({ shell: 2880 + 28778 + 7211, finishing: 10842 + 5766 })
  })

  it('يذكر الرخصة والأمثلة والمسار المدعّم والقرض والكراء', () => {
    const keys = buildBrief(mouna).solutions.map((s) => s.key)
    expect(keys).toEqual(expect.arrayContaining(['permit', 'social', 'loan', 'rent', 'topup']))
    // الأرض برسم عقاري: لا حلّ تسوية
    expect(keys).not.toContain('title')
  })

  it('يرتّب الحلول: ما يمشي الآن أوّلاً ثمّ ما يحتاج قراراً ثمّ المرهون بغيرنا', () => {
    const tones = buildBrief(mouna).solutions.map((s) => s.tone)
    const rank = { go: 0, fix: 1, wait: 2 } as const
    for (let k = 1; k < tones.length; k++) expect(rank[tones[k]]).toBeGreaterThanOrEqual(rank[tones[k - 1]])
  })

  it('يجمع الخلاصة: الحريف، الطلب، المال، الأرض، العرض، والنواقص', () => {
    const b = buildBrief(mouna)
    expect(b.summary.join('\n')).toContain('وظيفة عمومية')
    expect(b.summary.join('\n')).toContain('أرض 400 م²')
    expect(b.gaps.join('\n')).toContain('رخصة البناء')
    expect(b.strengths.join('\n')).toContain('رسم عقاري')
  })

  it('بلا ملفّ مالي: عنوان صريح وثغرة واحدة على الأقلّ', () => {
    const b = buildBrief({ ...mouna, fin: null, score: null, devis: null })
    expect(b.headline).toContain('الملفّ المالي ناقص')
    expect(b.gaps).toContain('الملفّ المالي غير معبّأ')
  })

  it('عرض داخل الميزانية: المسار مفتوح', () => {
    const b = buildBrief({ ...mouna, devis: { ...mouna.devis!, total: 110000 } })
    expect(b.headline).toContain('داخل الميزانية')
    expect(b.solutions[0].key).toBe('fits')
  })

  it('الباحث عن شقّة بلا عروض: توسيع البحث', () => {
    const b = buildBrief({ ...mouna, requestType: 'apartment', land: null, devis: null, matchesCount: 0, flexibility: ['zone'] })
    const s = b.solutions.find((x) => x.key === 'no-offers')
    expect(s?.steps[0]).toContain('توسيع البحث')
  })
})
