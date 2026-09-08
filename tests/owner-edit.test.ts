import { describe, expect, it } from 'vitest'
import {
  FIELD_LABELS_AR,
  OWNER_FIELDS,
  changedLabels,
  diffValues,
  monthsToYears,
  toFormValues,
  touchesScore,
  type FinanceRow,
  type LandRow,
  type RequestRow,
} from '@/lib/owner-edit'

const request: RequestRow = {
  full_name: 'سيف الليّوشي',
  phone: '20123456',
  email: null,
  gov_code: 'SFX',
  delegation_id: 12,
  imada_id: null,
  land_location: 'نهج الحبيب بورقيبة',
  request_type: 'build_on_land',
  desired_area_m2: 120,
  bedrooms: 3,
  horizon: '12m',
  standing: 'B03',
  urgency: 'within_year',
  urgency_note: null,
  flexibility: ['area', 'timing'],
  problem_note: null,
  foprolos_interest: true,
  is_first_home: true,
  has_social_housing: false,
  cnss_affiliated: true,
  cnss_number_years: 8,
  problem_type: 'financing',
  financing_state: 'not_started',
  cash_ready: false,
}

const finance: FinanceRow = {
  monthly_income_tnd: 1500,
  spouse_income_tnd: 0,
  other_income_tnd: 0,
  existing_loans_tnd: 120,
  down_payment_tnd: 20000,
  max_monthly_tnd: null,
  employment: 'public',
  seniority_months: 66,
  is_expat: false,
  expat_country: null,
}

const social = {
  household_size: 5,
  dependents: 3,
  has_disability: false,
  housing_condition: 'rented_unstable',
  income_stability: 'low_stable',
  is_renting: true,
  rent_tnd: 620,
}

const land: LandRow = {
  area_m2: 300,
  title_status: 'titled',
  has_water: true,
  has_power: true,
  has_road: false,
  has_permit: false,
}

describe('toFormValues', () => {
  const v = toFormValues(request, finance, land, null, social)

  it('يعطي كلّ حقل قابل للتعديل قيمة', () => {
    for (const f of OWNER_FIELDS) expect(v, f).toHaveProperty(f)
  })

  it('يحوّل الأرقام إلى نصوص لأنّ الاستمارة تشتغل بالنصّ', () => {
    expect(v.desiredAreaM2).toBe('120')
    expect(v.bedrooms).toBe('3')
    expect(v.landAreaM2).toBe('300')
  })

  it('الغائب يبقى فارغاً لا صفراً — الصفر معطى والفراغ غيابه', () => {
    expect(v.maxMonthly).toBe('')
    expect(v.imadaId).toBe('')
    expect(v.email).toBe('')
    // صفر مصرَّح به يبقى صفراً
    expect(v.spouseIncome).toBe('0')
  })

  it('المرونة تصير نصّاً بفواصل كما تنتظرها الاستمارة', () => {
    expect(v.flexibility).toBe('area,timing')
  })

  it('الأشهر ترجع سنين', () => {
    expect(v.seniorityYears).toBe('5.5')
  })

  it('الموافقة مؤشَّرة: أُعطيت وقت الإرسال الأوّل', () => {
    expect(v.consent).toBe(true)
  })

  it('الكراء يعبر كما هو — دليل القدرة الشهرية', () => {
    expect(v.isRenting).toBe(true)
    expect(v.rentTnd).toBe('620')
  })

  it('«فلوسي حاضرة» تُقرأ من المطلب لا من وضع التمويل', () => {
    expect(v.cashReady).toBe(false)
    const ready = toFormValues({ ...request, cash_ready: true }, finance, land)
    expect(ready.cashReady).toBe(true)
  })

  it('يشتغل بلا معطى مالي ولا أرض', () => {
    const bare = toFormValues(request, null, null)
    expect(bare.monthlyIncome).toBe('')
    expect(bare.landAreaM2).toBe('')
    expect(bare.hasWater).toBe(false)
    expect(bare.isRenting).toBe(false)
    expect(bare.rentTnd).toBe('')
  })
})

describe('monthsToYears', () => {
  it('يقرّب لخانة واحدة', () => {
    expect(monthsToYears(18)).toBe('1.5')
    expect(monthsToYears(17)).toBe('1.4')
    expect(monthsToYears(0)).toBe('0')
  })
  it('الغائب يبقى غائباً', () => {
    expect(monthsToYears(null)).toBe('')
    expect(monthsToYears(undefined)).toBe('')
  })
})

describe('diffValues', () => {
  const before = toFormValues(request, finance, land, null, social)

  it('لا يرى تبديلاً حين لا شيء تبدّل', () => {
    // ما يرجع من الاستمارة أرقام لا نصوص — ولازم يُعتبر نفس القيمة
    const after = { ...before, desiredAreaM2: 120, bedrooms: 3, monthlyIncome: 1500 }
    expect(diffValues(before, after, OWNER_FIELDS)).toEqual({})
  })

  it('يمسك التبديل الحقيقي وحده', () => {
    const after = { ...before, monthlyIncome: 1800, bedrooms: 3 }
    const d = diffValues(before, after, OWNER_FIELDS)
    expect(Object.keys(d)).toEqual(['monthlyIncome'])
    expect(d.monthlyIncome).toEqual({ from: '1500', to: 1800 })
  })

  it('يقارن المرونة كمجموعة مرتّبة لا كنصّ عشوائي', () => {
    const same = diffValues(before, { ...before, flexibility: ['area', 'timing'] }, OWNER_FIELDS)
    expect(same).toEqual({})
    const changed = diffValues(before, { ...before, flexibility: ['area'] }, OWNER_FIELDS)
    expect(changed).toHaveProperty('flexibility')
  })

  it('true/false تُقارن كقيم منطقية لا كنصوص', () => {
    expect(diffValues(before, { ...before, hasWater: true }, OWNER_FIELDS)).toEqual({})
    expect(diffValues(before, { ...before, hasWater: false }, OWNER_FIELDS)).toHaveProperty(
      'hasWater'
    )
  })

  it('الخانة الاختيارية الفارغة ليست تبديلاً حين يرجعها المخطّط صفراً', () => {
    // maxMonthly في القاعدة null، والاستمارة تتركها فارغة، والمخطّط
    // يعطي 0. بلا هذا يمتلئ سجلّ التدقيق بتبديل لم يقع.
    expect(before.maxMonthly).toBe('')
    const d = diffValues(before, { ...before, maxMonthly: 0 }, OWNER_FIELDS)
    expect(d).not.toHaveProperty('maxMonthly')
  })

  it('لكنّ صفراً يصير رقماً حقيقياً يبقى تبديلاً', () => {
    const d = diffValues(before, { ...before, maxMonthly: 900 }, OWNER_FIELDS)
    expect(d).toHaveProperty('maxMonthly')
  })

  it('لا يخرج عن قائمة الحقول المسموحة', () => {
    const after = { ...before, status: 'qualified', ref_code: 'LB-2026-000999' }
    expect(diffValues(before, after, OWNER_FIELDS)).toEqual({})
  })
})

describe('touchesScore', () => {
  it('الدخل يحرّك التنقيط', () => {
    expect(touchesScore({ monthlyIncome: { from: 1500, to: 1800 } })).toBe(true)
  })
  it('تبديل الاسم أو الرقم لا يحرّكه', () => {
    expect(touchesScore({ fullName: { from: 'أ', to: 'ب' } })).toBe(false)
    expect(touchesScore({ phone: { from: '20123456', to: '20999999' } })).toBe(false)
  })
  it('لا تبديل، لا إعادة حساب', () => {
    expect(touchesScore({})).toBe(false)
  })
})

describe('أسماء الحقول للفريق', () => {
  it('كلّ حقل قابل للتعديل عندو اسم بالعربية', () => {
    for (const f of OWNER_FIELDS) expect(FIELD_LABELS_AR, f).toHaveProperty(f)
  })

  it('السطر المكتوب في خطّ الزمن يقرأه إنسان لا مبرمج', () => {
    const line = changedLabels({
      bedrooms: { from: 3, to: 4 },
      monthlyIncome: { from: 2000, to: 2400 },
    })
    expect(line).toBe('عدد الغرف، الدخل الشهري')
  })
})
