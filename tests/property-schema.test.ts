import { describe, expect, it } from 'vitest'
import { parseLooseInt, propertySchema } from '@/lib/property-schema'

describe('أرقام كما يكتبها الناس', () => {
  it('يقرأ فواصل الآلاف بكلّ أشكالها', () => {
    expect(parseLooseInt('150 000')).toBe(150000)
    expect(parseLooseInt('150.000')).toBe(150000)
    expect(parseLooseInt('150,000')).toBe(150000)
    expect(parseLooseInt('150 000')).toBe(150000)
    expect(parseLooseInt('150 000')).toBe(150000)
    expect(parseLooseInt("1'500'000")).toBe(1500000)
  })

  it('يقرأ الأرقام العربية-الهندية', () => {
    expect(parseLooseInt('١٢٠')).toBe(120)
    expect(parseLooseInt('٢٥٠ ٠٠٠')).toBe(250000)
  })

  it('الفارغ null والغائب undefined والحروف NaN', () => {
    expect(parseLooseInt('')).toBeNull()
    expect(parseLooseInt('   ')).toBeNull()
    expect(parseLooseInt(undefined)).toBeUndefined()
    expect(parseLooseInt('مائة ألف')).toBeNaN()
    expect(parseLooseInt('12a')).toBeNaN()
  })
})

const base = {
  kind: 'house',
  govCode: 'SFX',
  ownerName: 'تجربة الاستمارة',
  ownerPhone: '20 111 222',
  consent: true,
}

describe('استمارة العقار', () => {
  it('تقبل «150 000» ثمناً — كان يُرفض على مسافة', () => {
    const r = propertySchema.safeParse({ ...base, priceTnd: '150 000', areaM2: '1 200' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.priceTnd).toBe(150000)
      expect(r.data.areaM2).toBe(1200)
    }
  })

  it('البريد اختياري: فارغ يمرّ، وغالط يُرفض على حقله وحده', () => {
    expect(propertySchema.safeParse({ ...base, ownerEmail: '' }).success).toBe(true)
    expect(propertySchema.safeParse(base).success).toBe(true)
    const bad = propertySchema.safeParse({ ...base, ownerEmail: 'not-an-email' })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.issues.map((i) => i.path[0])).toEqual(['ownerEmail'])
  })

  it('الحقول الرقمية الفارغة أو الغائبة تصير null', () => {
    const r = propertySchema.safeParse({ ...base, priceTnd: '', rooms: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.priceTnd).toBeNull()
      expect(r.data.rooms).toBeNull()
      expect(r.data.builtAreaM2).toBeNull()
    }
  })

  it('يسمّي الحقل الغالط بالضبط — الواجهة تعرضه في النافذة', () => {
    const r = propertySchema.safeParse({ ...base, priceTnd: 'غالي', areaM2: '5' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const fields = [...new Set(r.error.issues.map((i) => String(i.path[0])))]
      expect(fields.sort()).toEqual(['areaM2', 'priceTnd'])
    }
  })
})
