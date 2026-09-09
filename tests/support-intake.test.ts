import { describe, expect, it } from 'vitest'
import {
  BEST_TIMES,
  BUILDING_STATES,
  FOR_WHOM,
  HEAD_STATUSES,
  INCOME_RANGES,
  LAND_STATUSES,
  NEED_KINDS,
  SAVINGS_RANGES,
  SOCIAL_COVERAGE,
  STEPS_TAKEN,
  TRIGGERS,
  UTILITIES,
  YES_NO_UNKNOWN,
  supportRequestSchema,
} from '@/lib/support-schema'
import { dictionaries } from '@/lib/i18n'

const base = {
  fullName: 'اختبار للحذف',
  phone: '20123456',
  govCode: 'SFX',
  delegationId: '3',
  needText: 'السقف يقطر من عامين والدار فيها صغار، نحتاج مواد ويد عاملة.',
  urgency: 'urgent',
  housingCondition: 'renting',
  incomeStability: 'irregular',
  consent: true,
}

describe('تفاصيل طلب المساندة', () => {
  it('الحدّ الأدنى القديم ما زال يمرّ — كلّ التفاصيل اختيارية', () => {
    const r = supportRequestSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.needKinds).toEqual([])
    expect(r.data.forWhom).toBeNull()
    expect(r.data.incomeRange).toBeNull()
    expect(r.data.canVisit).toBe(false)
  })

  it('الاختيار المتعدّد يقبل مصفوفة ويرمي المجهول بصمت', () => {
    const r = supportRequestSchema.safeParse({
      ...base,
      needKinds: ['roof', 'labor', 'bitcoin'],
      triggers: 'flood',
      socialCoverage: ['amg1', 'x'],
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.needKinds).toEqual(['roof', 'labor'])
    expect(r.data.triggers).toEqual(['flood'])
    expect(r.data.socialCoverage).toEqual(['amg1'])
  })

  it('الشرائح والأعداد والنصوص القصيرة', () => {
    const r = supportRequestSchema.safeParse({
      ...base,
      forWhom: 'relative',
      beneficiaryName: 'الوالدة',
      incomeRange: '300_600',
      savingsRange: 'none',
      roomsCount: '2',
      yearsThere: '12',
      rentTnd: '250',
      childrenCount: '3',
      elderlyCount: '1',
      headStatus: 'single_mother',
      buildingState: 'danger',
      landStatus: 'heirs',
      existingAid: 'unknown',
      bestTime: 'evening',
      hasMaterials: true,
      canVisit: true,
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.roomsCount).toBe(2)
    expect(r.data.rentTnd).toBe(250)
    expect(r.data.headStatus).toBe('single_mother')
    expect(r.data.canVisit).toBe(true)
  })

  it('شريحة دخل مجهولة تُرفض لا تُمرَّر', () => {
    expect(supportRequestSchema.safeParse({ ...base, incomeRange: '5000' }).success).toBe(false)
    expect(supportRequestSchema.safeParse({ ...base, roomsCount: '99' }).success).toBe(false)
  })
})

describe('لكلّ خيار تسمية في اللغتين', () => {
  const cases: [string, readonly string[], string][] = [
    ['forWhomLabels', FOR_WHOM, 'شكون يطلب'],
    ['needKindLabels', NEED_KINDS, 'الحاجة'],
    ['triggerLabels', TRIGGERS, 'السبب'],
    ['utilityLabels', UTILITIES, 'المرافق'],
    ['buildingStateLabels', BUILDING_STATES, 'حالة البناء'],
    ['headStatusLabels', HEAD_STATUSES, 'الوضع العائلي'],
    ['incomeRangeLabels', INCOME_RANGES, 'شريحة الدخل'],
    ['socialCoverageLabels', SOCIAL_COVERAGE, 'التغطية'],
    ['yesNoLabels', YES_NO_UNKNOWN, 'نعم/لا'],
    ['landStatusLabels', LAND_STATUSES, 'وراق الأرض'],
    ['savingsLabels', SAVINGS_RANGES, 'الادّخار'],
    ['stepsLabels', STEPS_TAKEN, 'الخطوات'],
    ['bestTimeLabels', BEST_TIMES, 'وقت الاتصال'],
  ]
  for (const [key, values, name] of cases) {
    it(name, () => {
      for (const lang of ['ar', 'fr'] as const) {
        const labels = (dictionaries[lang].soutien.askHelp as Record<string, unknown>)[key] as Record<string, string>
        for (const v of values) expect(labels[v], `${lang}.${key}.${v}`).toBeTruthy()
      }
    })
  }
})
