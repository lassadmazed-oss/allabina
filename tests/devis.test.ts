import { describe, expect, it } from 'vitest'
import {
  costPerM2,
  evaluateFormula,
  generateDevis,
  type ArticleInput,
  type ProjectConfig,
} from '@/lib/devis'

const config: ProjectConfig = {
  surface: 120,
  levels: 1,
  bedrooms: 3,
  livingRooms: 1,
  kitchens: 1,
  bathrooms: 2,
  garage: true,
  terrasse: false,
  jardin: false,
  landArea: 400,
}

const article = (over: Partial<ArticleInput> = {}): ArticleInput => ({
  id: 'a1',
  code: 'ART-001',
  lotCode: 5,
  lotNameAr: 'البناء',
  designationAr: 'بناء جدران',
  unit: 'm2',
  qtyFormula: 'surface',
  puFournitureHt: 30,
  puMainOeuvreHt: 20,
  ...over,
})

describe('مقيّم الصيغ', () => {
  it('يحسب المتغيّرات والعمليات الأربع', () => {
    expect(evaluateFormula('surface', config)).toBe(120)
    expect(evaluateFormula('surface * 1.15', config)).toBe(138)
    expect(evaluateFormula('bedrooms + bathrooms', config)).toBe(5)
    expect(evaluateFormula('surface / 2', config)).toBe(60)
    expect(evaluateFormula('(surface + 80) * 2', config)).toBe(400)
  })

  it('يحترم أولوية العمليات', () => {
    expect(evaluateFormula('2 + 3 * 4', config)).toBe(14)
    expect(evaluateFormula('(2 + 3) * 4', config)).toBe(20)
  })

  it('يعامل الخيارات المنطقية كصفر أو واحد', () => {
    expect(evaluateFormula('garage * 18', config)).toBe(18)
    expect(evaluateFormula('terrasse * 25', config)).toBe(0)
  })

  it('يضرب في عدد المستويات', () => {
    const rPlus1 = { ...config, levels: 2 }
    expect(evaluateFormula('surface * levels', rPlus1)).toBe(240)
  })

  it('لا ينفّذ كوداً — يرفض ما ليس رقماً ولا متغيّراً معروفاً', () => {
    expect(() => evaluateFormula('process.exit(1)', config)).toThrow()
    expect(() => evaluateFormula('surface; drop table', config)).toThrow()
    expect(() => evaluateFormula('unknownVar * 2', config)).toThrow(/متغيّر غير معروف/)
    expect(() => evaluateFormula('surface ** 2', config)).toThrow()
  })

  it('يرفض الصيغ الناقصة والقسمة على صفر', () => {
    expect(() => evaluateFormula('surface *', config)).toThrow()
    expect(() => evaluateFormula('(surface + 2', config)).toThrow(/قوس/)
    expect(() => evaluateFormula('surface / 0', config)).toThrow(/قسمة على صفر/)
  })

  it('الصيغة الفارغة تعطي صفراً لا خطأ', () => {
    expect(evaluateFormula('', config)).toBe(0)
    expect(evaluateFormula('   ', config)).toBe(0)
  })

  it('لا كمّيات سالبة', () => {
    expect(evaluateFormula('bedrooms - 10', config)).toBe(0)
  })
})

describe('توليد الـDevis', () => {
  it('يحسب الكمّية والسعر والمجموع لكلّ سطر', () => {
    const r = generateDevis(config, [article()])
    expect(r.lines).toHaveLength(1)
    const l = r.lines[0]
    expect(l.quantity).toBe(120)
    expect(l.puTotalHt).toBe(50)
    expect(l.totalHt).toBe(6000)
    expect(r.totalHt).toBe(6000)
  })

  it('يجمع حسب الـLot ويرتّب بترتيب البوردرو', () => {
    const r = generateDevis(config, [
      article({ id: 'a', code: 'B-1', lotCode: 9, lotNameAr: 'الكهرباء', qtyFormula: '10', puFournitureHt: 5, puMainOeuvreHt: 5 }),
      article({ id: 'b', code: 'A-1', lotCode: 3, lotNameAr: 'الأساسات', qtyFormula: '20', puFournitureHt: 10, puMainOeuvreHt: 0 }),
    ])
    expect(r.lots.map((l) => l.code)).toEqual([3, 9])
    expect(r.lots[0].totalHt).toBe(200)
    expect(r.lots[1].totalHt).toBe(100)
    expect(r.totalHt).toBe(300)
  })

  it('يتجاهل المقالات التي كمّيتها صفر', () => {
    const r = generateDevis(config, [
      article({ qtyFormula: 'terrasse * 30' }),
      article({ id: 'a2', code: 'ART-002', qtyFormula: 'surface' }),
    ])
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].articleCode).toBe('ART-002')
  })

  it('يجمع أخطاء الصيغ ولا يُسقط العرض كلّه', () => {
    const r = generateDevis(config, [
      article({ id: 'bad', code: 'BAD-1', qtyFormula: 'surfacz * 2' }),
      article({ id: 'ok', code: 'OK-1', qtyFormula: 'surface' }),
    ])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].code).toBe('BAD-1')
    expect(r.lines).toHaveLength(1)
    expect(r.totalHt).toBeGreaterThan(0)
  })

  it('يفصل التوريد عن اليد العاملة في كلّ سطر', () => {
    const r = generateDevis(config, [article({ puFournitureHt: 30, puMainOeuvreHt: 20 })])
    expect(r.lines[0].puFournitureHt).toBe(30)
    expect(r.lines[0].puMainOeuvreHt).toBe(20)
    expect(r.lines[0].puTotalHt).toBe(50)
  })

  it('بلا مقالات: عرض فارغ لا انهيار', () => {
    const r = generateDevis(config, [])
    expect(r.lines).toHaveLength(0)
    expect(r.totalHt).toBe(0)
    expect(r.lots).toHaveLength(0)
  })
})

describe('كلفة المتر المربّع', () => {
  it('تُحتسب من مجموع العرض والمساحة', () => {
    const r = generateDevis(config, [article({ qtyFormula: 'surface', puFournitureHt: 1000, puMainOeuvreHt: 400 })])
    expect(costPerM2(r, 120)).toBe(1400)
  })

  it('null حين لا مساحة أو لا مجموع', () => {
    const empty = generateDevis(config, [])
    expect(costPerM2(empty, 120)).toBeNull()
    const r = generateDevis(config, [article()])
    expect(costPerM2(r, 0)).toBeNull()
  })
})

import { DEFAULT_VALIDITY_DAYS, daysLeft, devisValidUntil, isDevisExpired } from '@/lib/devis'

describe('صلاحية العرض', () => {
  const base = new Date('2026-09-05T10:00:00Z')

  it('المدّة الافتراضية 30 يوماً', () => {
    expect(DEFAULT_VALIDITY_DAYS).toBe(30)
    expect(devisValidUntil(base)).toBe('2026-10-05')
  })

  it('تقبل مدّة أخرى تضبطها الإدارة', () => {
    expect(devisValidUntil(base, 15)).toBe('2026-09-20')
    expect(devisValidUntil(base, 60)).toBe('2026-11-04')
  })

  it('يوم الانتهاء نفسه ما زال صالحاً', () => {
    expect(isDevisExpired('2026-10-05', new Date('2026-10-05T23:00:00Z'))).toBe(false)
    expect(isDevisExpired('2026-10-05', new Date('2026-10-06T00:30:00Z'))).toBe(true)
  })

  it('عرض بلا تاريخ صلاحية لا يُعتبر منتهياً', () => {
    expect(isDevisExpired(null)).toBe(false)
  })

  it('يحسب الأيّام الباقية، وسالباً بعد الانتهاء', () => {
    expect(daysLeft('2026-10-05', base)).toBe(30)
    expect(daysLeft('2026-09-05', base)).toBe(0)
    expect(daysLeft('2026-09-01', base)).toBe(-4)
    expect(daysLeft(null)).toBeNull()
  })
})
