import { describe, expect, it } from 'vitest'
import {
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
  SIGNED_URL_TTL_SECONDS,
  documentRejection,
  groupByDocType,
  humanSize,
  isPdf,
  slugifyDocType,
  storagePathFor,
} from '@/lib/documents'

describe('قبول الوثيقة', () => {
  it('يقبل PDF والصور الثلاث في حدود الحجم', () => {
    for (const mime of ALLOWED_DOCUMENT_MIME) {
      expect(documentRejection(mime, 4096)).toBeNull()
      expect(documentRejection(mime, MAX_DOCUMENT_BYTES)).toBeNull()
    }
  })

  it('يرفض النوع الغريب — وورد وأرشيف وتنفيذيّ', () => {
    for (const mime of ['application/msword', 'application/zip', 'application/x-msdownload', 'text/html']) {
      expect(documentRejection(mime, 4096)).toBe('type')
    }
  })

  it('يرفض ما فوق 15 MiB وما هو فارغ', () => {
    expect(documentRejection('application/pdf', MAX_DOCUMENT_BYTES + 1)).toBe('size')
    expect(documentRejection('application/pdf', 0)).toBe('empty')
  })
})

describe('المسار في المخزن', () => {
  it('لا يحمل الاسم الأصلي ولا العربية — تسمية لاتينية ثابتة', () => {
    const p = storagePathFor('req-1', 'رسم عقاري / عقد ملكية', 'application/pdf', 'zz9')
    expect(p).toMatch(/^req-1\/land-title\/\d{14}-zz9\.pdf$/)
    expect(p).not.toMatch(/[؀-ۿ]/)
  })

  it('تسميات قائمة التحقّق كلّها لها slug معلوم', () => {
    const known = ['بطاقة تعريف', 'شهادة في العمل', 'كشف حساب بنكي', 'رسم عقاري / عقد ملكية', 'رخصة بناء', 'أمثلة ودراسات']
    const slugs = known.map(slugifyDocType)
    expect(new Set(slugs).size).toBe(known.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z-]+$/)
  })

  it('تسمية غريبة تُحوَّل أو تسقط على other', () => {
    expect(slugifyDocType('Attestation CNSS 2026')).toBe('attestation-cnss-2026')
    expect(slugifyDocType('وثيقة أخرى')).toBe('other')
  })
})

describe('العرض', () => {
  it('الحجم بوحدة مقروءة في اللغتين', () => {
    expect(humanSize(512)).toBe('512 بايت')
    expect(humanSize(318 * 1024)).toBe('318 كيلو')
    expect(humanSize(2.4 * 1024 * 1024)).toBe('2.4 ميغا')
    expect(humanSize(3 * 1024 * 1024, 'fr')).toBe('3 Mo')
  })

  it('يميّز PDF عن الصورة لاختيار الأيقونة', () => {
    expect(isPdf('application/pdf')).toBe(true)
    expect(isPdf('image/png')).toBe(false)
  })

  it('عمر الرابط الموقّع دقائق لا أيّام', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(15 * 60)
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60)
  })
})

describe('التجميع تحت قائمة التحقّق', () => {
  const order = ['بطاقة تعريف', 'رخصة بناء']
  const files = [
    { id: 'a', doc_type: 'رخصة بناء' },
    { id: 'b', doc_type: 'بطاقة تعريف' },
    { id: 'c', doc_type: 'شهادة سكنى' },
    { id: 'd', doc_type: 'بطاقة تعريف' },
  ]

  it('يتبع ترتيب القائمة، يُبقي الفارغ، ويلحق الغريب آخراً', () => {
    const g = groupByDocType(files, order)
    expect(g.map((x) => x.docType)).toEqual(['بطاقة تعريف', 'رخصة بناء', 'شهادة سكنى'])
    expect(g[0].files.map((f) => f.id)).toEqual(['b', 'd'])
    expect(g[1].files.map((f) => f.id)).toEqual(['a'])
  })

  it('قائمة بلا ملفّات تبقى كاملة بمجموعات فارغة', () => {
    const g = groupByDocType([], order)
    expect(g).toHaveLength(2)
    expect(g.every((x) => x.files.length === 0)).toBe(true)
  })
})
