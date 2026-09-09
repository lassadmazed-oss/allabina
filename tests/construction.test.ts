import { describe, expect, it } from 'vitest'
import {
  assembliesForSpan,
  assemblyThicknessCm,
  isLoadBearingThickness,
  shearReinforcementCm,
  suggestAssembly,
  systemFitsProject,
  type SpanLimit,
} from '@/lib/construction'

/** الجدول الحقيقي من Avis Technique — DRISS AGGLO-01-PPE/2023، تسليح 2HA12 */
const LIMITS: SpanLimit[] = [
  { usage_code: 'habitation', usage_ar: 'سكن', load_kn_m2: 1.5, assembly_code: '12+4', span_max_m: 3.5, reinforcement: '2HA12' },
  { usage_code: 'habitation', usage_ar: 'سكن', load_kn_m2: 1.5, assembly_code: '15+5', span_max_m: 4.2, reinforcement: '2HA12' },
  { usage_code: 'habitation', usage_ar: 'سكن', load_kn_m2: 1.5, assembly_code: '20+6', span_max_m: 4.8, reinforcement: '2HA12' },
  { usage_code: 'commerce', usage_ar: 'محلّات تجارية', load_kn_m2: 5, assembly_code: '12+4', span_max_m: 3.0, reinforcement: '2HA12' },
  { usage_code: 'commerce', usage_ar: 'محلّات تجارية', load_kn_m2: 5, assembly_code: '15+5', span_max_m: 3.6, reinforcement: '2HA12' },
  { usage_code: 'commerce', usage_ar: 'محلّات تجارية', load_kn_m2: 5, assembly_code: '20+6', span_max_m: 4.1, reinforcement: '2HA12' },
]

describe('حدود البحور', () => {
  it('البحر 4,50 م في السكن يتجاوز 15+5 ويستوجب 20+6', () => {
    const verdicts = assembliesForSpan(LIMITS, 'habitation', 4.5)
    expect(verdicts.map((v) => [v.assembly, v.fits])).toEqual([
      ['12+4', false],
      ['15+5', false],
      ['20+6', true],
    ])
  })

  it('نفس البحر 4,20 م يكفي للسكن ولا يكفي لمحلّ تجاري', () => {
    expect(suggestAssembly(LIMITS, 'habitation', 4.2)?.assembly).toBe('15+5')
    expect(suggestAssembly(LIMITS, 'commerce', 4.2)).toBeNull()
  })

  it('البحر الخارج عن كلّ التركيبات لا يُقترَح له «الأكبر»', () => {
    expect(suggestAssembly(LIMITS, 'habitation', 5.4)).toBeNull()
  })

  it('البحر غير المعلوم لا يُعتبر ناجحاً', () => {
    expect(assembliesForSpan(LIMITS, 'habitation', 0).every((v) => !v.fits)).toBe(true)
  })

  it('الهامش يُحسب بالمتر إلى منزلتين', () => {
    expect(suggestAssembly(LIMITS, 'habitation', 4.05)?.marginM).toBe(0.15)
  })

  it('استعمال بلا حدود مسجّلة يعطي قائمة فارغة لا خياراً وهمياً', () => {
    expect(assembliesForSpan(LIMITS, 'bureaux', 3)).toEqual([])
  })
})

describe('سماكة السقف المجمَّعة', () => {
  it('12+4 = 16 · 15+5 = 20 · 20+6 = 26', () => {
    expect(assemblyThicknessCm('12+4')).toBe(16)
    expect(assemblyThicknessCm('15+5')).toBe(20)
    expect(assemblyThicknessCm('20+6')).toBe(26)
  })

  it('صيغة غير معروفة تعطي null لا NaN', () => {
    expect(assemblyThicknessCm('20')).toBeNull()
    expect(assemblyThicknessCm('a+b')).toBeNull()
  })
})

describe('تقوية القصّ', () => {
  it('(L1 − L2)/2 + 20 صم', () => {
    // 4,50 → 4,20: (30 صم)/2 + 20 = 35 → يرتفع إلى الحدّ الأدنى 40
    expect(shearReinforcementCm(4.5, 4.2)).toBe(40)
    // 5,00 → 4,20: (80)/2 + 20 = 60
    expect(shearReinforcementCm(5.0, 4.2)).toBe(60)
  })

  it('الحدّ الأدنى 40 صم يسري ولو كان الفرق صفراً', () => {
    expect(shearReinforcementCm(4.2, 4.2)).toBe(40)
  })
})

describe('حدود النظام تسري برمجياً', () => {
  const bloc = {
    constraints: {
      excluded_uses: ['sous_sol_parking'],
      excluded_reason_ar: 'مقاومة الحريق المطلوبة أعلى من ساعة واحدة',
      load_bearing_series_cm: [20, 22, 25],
    },
  }

  it('قبو بموقف سيارات يستبعد النظام مع ذكر السبب', () => {
    const v = systemFitsProject(bloc, { uses: ['sous_sol_parking'] })
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('الحريق')
  })

  it('مشروع بلا استعمال مستبعَد يمرّ', () => {
    expect(systemFitsProject(bloc, { uses: ['bureaux'] }).ok).toBe(true)
    expect(systemFitsProject(bloc, {}).ok).toBe(true)
  })

  it('السلاسل 10 و15 ليست حاملة', () => {
    expect(isLoadBearingThickness(bloc, 20)).toBe(true)
    expect(isLoadBearingThickness(bloc, 15)).toBe(false)
    expect(isLoadBearingThickness(bloc, 10)).toBe(false)
  })

  it('نظام بلا حدود مسجّلة لا يمنع شيئاً', () => {
    expect(systemFitsProject({ constraints: {} }, { uses: ['sous_sol_parking'] }).ok).toBe(true)
  })
})
