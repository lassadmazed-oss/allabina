import { describe, expect, it } from 'vitest'
import { applicableDocuments, type CatalogDoc, type DocContext } from '@/lib/request-documents'

const doc = (over: Partial<CatalogDoc>): CatalogDoc => ({
  code: 'x',
  nameAr: 'x',
  nameFr: null,
  whyAr: null,
  issuerAr: null,
  group: 'property',
  appliesTo: null,
  onlyIf: [],
  required: false,
  sortOrder: 0,
  ...over,
})

const ctx = (over: Partial<DocContext>): DocContext => ({
  requestType: 'renovation',
  employment: 'private',
  cashReady: false,
  isRenting: false,
  existingLoans: 0,
  foprolosInterest: false,
  hasDisability: false,
  housingCondition: '',
  housingProblems: [],
  incomeStability: '',
  ...over,
})

const title = doc({ code: 'land_title', appliesTo: ['build_on_land', 'renovation'], onlyIf: ['home_owner'] })
const permit = doc({ code: 'renovation_permit', appliesTo: ['renovation'], onlyIf: ['structural'] })

describe('الأوراق تتبع المسار', () => {
  it('إثبات الملكية لمن يملك الدار أو ورثها — لا للكاري', () => {
    expect(applicableDocuments([title], ctx({ ownership: 'owner' })).map((d) => d.code)).toEqual(['land_title'])
    expect(applicableDocuments([title], ctx({ ownership: 'heirs' })).map((d) => d.code)).toEqual(['land_title'])
    expect(applicableDocuments([title], ctx({ ownership: 'tenant' }))).toEqual([])
  })

  it('من يبني فوق أرضه يُطلب منه الرسم دائماً — السؤال عن الملكية لا يخصّه', () => {
    expect(
      applicableDocuments([title], ctx({ requestType: 'build_on_land' })).map((d) => d.code)
    ).toEqual(['land_title'])
  })

  it('رخصة الأشغال حين يُبنى شيء: توسعة أو طابق، لا دهان ولا سباكة', () => {
    expect(applicableDocuments([permit], ctx({ works: ['extension'] })).map((d) => d.code)).toEqual(['renovation_permit'])
    expect(applicableDocuments([permit], ctx({ works: ['add_floor', 'roof'] })).map((d) => d.code)).toEqual(['renovation_permit'])
    expect(applicableDocuments([permit], ctx({ works: ['repair', 'networks'] }))).toEqual([])
    expect(applicableDocuments([permit], ctx({}))).toEqual([])
  })

  it('ورقة الترميم لا تُعرض على مشتري شقّة مهما كانت شروطها', () => {
    expect(applicableDocuments([permit], ctx({ requestType: 'apartment', works: ['extension'] }))).toEqual([])
  })
})
