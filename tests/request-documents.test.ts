import { describe, expect, it } from 'vitest'
import {
  applicableDocuments,
  groupDocuments,
  missingRequired,
  requiredProgress,
  type CatalogDoc,
  type DocContext,
} from '@/lib/request-documents'

const doc = (over: Partial<CatalogDoc> & { code: string }): CatalogDoc => ({
  nameAr: over.code,
  nameFr: null,
  whyAr: null,
  issuerAr: null,
  group: 'identity',
  appliesTo: null,
  onlyIf: [],
  required: false,
  sortOrder: 0,
  ...over,
})

const CATALOG: CatalogDoc[] = [
  doc({ code: 'cin', group: 'identity', required: true, sortOrder: 10 }),
  doc({ code: 'work_cert', group: 'income', onlyIf: ['employed'], required: true, sortOrder: 10 }),
  doc({ code: 'tax_return', group: 'income', onlyIf: ['self_employed', 'needs_bank'], sortOrder: 20 }),
  doc({ code: 'bank_statements', group: 'income', onlyIf: ['needs_bank'], required: true, sortOrder: 30 }),
  doc({ code: 'funds_proof', group: 'income', onlyIf: ['cash_ready'], required: true, sortOrder: 40 }),
  doc({ code: 'rent_contract', group: 'income', onlyIf: ['renting'], sortOrder: 50 }),
  doc({ code: 'land_title', group: 'property', appliesTo: ['build_on_land', 'renovation'], required: true, sortOrder: 10 }),
  doc({ code: 'copro_rules', group: 'property', appliesTo: ['apartment'], sortOrder: 20 }),
  doc({ code: 'building_permit', group: 'permits', appliesTo: ['build_on_land'], required: true, sortOrder: 10 }),
  doc({ code: 'non_property_cert', group: 'social', onlyIf: ['foprolos'], required: true, sortOrder: 10 }),
  doc({ code: 'omda_cert', group: 'support', onlyIf: ['hardship'], sortOrder: 10 }),
  doc({ code: 'disability_card', group: 'support', onlyIf: ['disability'], sortOrder: 20 }),
  doc({ code: 'ghost', group: 'identity', onlyIf: ['شرط_ما_نعرفوهش'], sortOrder: 99 }),
]

const base: DocContext = {
  requestType: 'apartment',
  employment: 'private',
  cashReady: false,
  isRenting: false,
  existingLoans: 0,
  foprolosInterest: false,
  hasDisability: false,
  housingCondition: '',
  housingProblems: [],
  incomeStability: '',
}

const codes = (c: DocContext) => applicableDocuments(CATALOG, c).map((d) => d.code)

describe('كلّ مسار وأوراقه', () => {
  it('مشتري شقّة: لا رسم عقاري ولا رخصة بناء', () => {
    const out = codes(base)
    expect(out).toContain('copro_rules')
    expect(out).not.toContain('land_title')
    expect(out).not.toContain('building_permit')
  })

  it('من يبني فوق أرضه: الرسم والرخصة، بلا نظام ملكية مشتركة', () => {
    const out = codes({ ...base, requestType: 'build_on_land' })
    expect(out).toContain('land_title')
    expect(out).toContain('building_permit')
    expect(out).not.toContain('copro_rules')
  })

  it('الترميم يطلب الرسم ولا يطلب رخصة بناء', () => {
    const out = codes({ ...base, requestType: 'renovation' })
    expect(out).toContain('land_title')
    expect(out).not.toContain('building_permit')
  })
})

describe('الشروط', () => {
  it('الأجير يُسأل على شهادة العمل، والمستقلّ على التصريح بالضريبة', () => {
    expect(codes({ ...base, employment: 'private' })).toContain('work_cert')
    expect(codes({ ...base, employment: 'private' })).not.toContain('tax_return')

    const indep = codes({ ...base, employment: 'self_employed' })
    expect(indep).toContain('tax_return')
    expect(indep).not.toContain('work_cert')
  })

  it('«فلوسي حاضرة» ترفع أوراق البنك وتطلب إثبات المبلغ', () => {
    const cash = codes({ ...base, cashReady: true })
    expect(cash).toContain('funds_proof')
    expect(cash).not.toContain('bank_statements')
  })

  it('الشروط تجتمع كلّها: مستقلّ بلا بنك ما يُسألش على التصريح', () => {
    // tax_return شرطاها self_employed + needs_bank معاً
    expect(codes({ ...base, employment: 'self_employed', cashReady: true })).not.toContain(
      'tax_return'
    )
  })

  it('عقد الكراء يظهر لمن هو كاري وحده', () => {
    expect(codes(base)).not.toContain('rent_contract')
    expect(codes({ ...base, isRenting: true })).toContain('rent_contract')
  })

  it('فوبرولوس يفتح شهادة عدم امتلاك مسكن', () => {
    expect(codes({ ...base, foprolosInterest: true })).toContain('non_property_cert')
  })

  it('الضائقة تُستنتج ولا تُسأل: من فيها لا يصنّف نفسه', () => {
    expect(codes(base)).not.toContain('omda_cert')
    expect(codes({ ...base, housingCondition: 'homeless' })).toContain('omda_cert')
    expect(codes({ ...base, housingProblems: ['unsafe'] })).toContain('omda_cert')
    expect(codes({ ...base, housingProblems: ['no_utilities'] })).toContain('omda_cert')
    expect(codes({ ...base, incomeStability: 'none' })).toContain('omda_cert')
    // ضيّق وغالٍ مشكلان حقيقيّان، لكنّهما ليسا ضائقة توجب شهادة العمدة
    expect(codes({ ...base, housingProblems: ['overcrowded', 'expensive'] })).not.toContain(
      'omda_cert'
    )
  })

  it('«بالكراء» في الحيازة يكفي لعقد الكراء، بلا سؤال ثانٍ', () => {
    expect(codes({ ...base, housingCondition: 'renting' })).toContain('rent_contract')
  })

  it('الإعاقة تفتح بطاقة الإعاقة وحدها', () => {
    expect(codes({ ...base, hasDisability: true })).toContain('disability_card')
  })

  it('شرط لا يعرفه الكود يخفي الورقة ولا يعرضها للجميع', () => {
    // الفريق يقدر يزيد رمز شرط في القاعدة قبل ما ندعموه
    expect(codes(base)).not.toContain('ghost')
    expect(codes({ ...base, requestType: 'build_on_land' })).not.toContain('ghost')
  })
})

describe('الترتيب والتجميع', () => {
  it('الأقسام بترتيبها والوثائق بترتيبها داخل القسم', () => {
    const out = applicableDocuments(CATALOG, { ...base, requestType: 'build_on_land' })
    const groups = out.map((d) => d.group)
    expect(groups).toEqual([...groups].sort((a, b) =>
      ['identity', 'income', 'property', 'permits', 'social', 'support'].indexOf(a) -
      ['identity', 'income', 'property', 'permits', 'social', 'support'].indexOf(b)
    ))
  })

  it('ما فمّاش قسم فارغ في العرض', () => {
    const sections = groupDocuments(applicableDocuments(CATALOG, base))
    expect(sections.every((s) => s.docs.length > 0)).toBe(true)
    expect(sections.map((s) => s.group)).not.toContain('permits')
  })
})

describe('التقدّم', () => {
  const docs = applicableDocuments(CATALOG, { ...base, requestType: 'build_on_land' })

  it('الضرورية وحدها تُعدّ', () => {
    const p = requiredProgress(docs, ['cin'])
    expect(p.total).toBe(docs.filter((d) => d.required).length)
    expect(p.done).toBe(1)
  })

  it('الناقص يُسمّى، ما يُعدّش برك', () => {
    const missing = missingRequired(docs, ['cin', 'work_cert']).map((d) => d.code)
    expect(missing).toContain('land_title')
    expect(missing).toContain('building_permit')
    expect(missing).not.toContain('cin')
  })

  it('ملفّ كامل: صفر ناقص', () => {
    const all = docs.filter((d) => d.required).map((d) => d.code)
    expect(missingRequired(docs, all)).toEqual([])
    const p = requiredProgress(docs, all)
    expect(p.done).toBe(p.total)
  })
})
