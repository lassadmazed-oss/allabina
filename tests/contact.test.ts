import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMPTY_IDENTITY, legalInLocale, telHref, waHref } from '@/lib/contact'

/**
 * الهويّة القانونية وروابط الاتّصال.
 *
 * هذا منطق خطؤه صامت: رابط واتساب بصيغة غلط يفتح «رقم غير موجود» بدل
 * ما يرمي خطأ، وسطر قانوني ناقص يُعرض بشرطة فيبدو الموقع مكسوراً. لذلك
 * نختبر الصيغة لا العرض.
 */
describe('رابط واتساب', () => {
  it('الرقم التونسي بثمانية أعداد يُسبَق بـ216', () => {
    expect(waHref('98120630')).toBe('https://wa.me/21698120630')
  })

  it('المكتوب بالصيغة الدولية ما يتسبّقش مرّة ثانية', () => {
    expect(waHref('+216 98 120 630')).toBe('https://wa.me/21698120630')
    expect(waHref('0021698120630')).toBe('https://wa.me/21698120630')
  })

  it('المسافات والشرط تتشال', () => {
    expect(waHref('98-12-06-30')).toBe('https://wa.me/21698120630')
  })

  it('خانة فارغة = لا رابط، فالزرّ ما يظهرش', () => {
    expect(waHref('')).toBeNull()
    expect(waHref('   ')).toBeNull()
  })

  it('النصّ الجاهز يُرمَّز فلا يكسر الرابط', () => {
    const href = waHref('98120630', 'سلام، عندي سؤال على اللَّبنة.')
    expect(href).toContain('?text=')
    expect(href).not.toContain(' ')
  })
})

describe('رابط الهاتف', () => {
  it('يحافظ على الأعداد وعلامة الزائد وحدها', () => {
    expect(telHref('98 120 630')).toBe('tel:98120630')
    expect(telHref('+216 98120630')).toBe('tel:+21698120630')
  })
})

describe('الهويّة حسب اللغة', () => {
  const id = {
    ...EMPTY_IDENTITY,
    nameAr: 'اللَّبنة للبناء والإعمار',
    nameFr: 'LABINA POUR LA CONSTRUCTION ET LA RECONSTITUTION',
    addressAr: 'شارع الهادي نويرة، صفاقس',
    addressFr: '',
  }

  it('الصفحة العربية تأخذ العربية', () => {
    expect(legalInLocale(id, 'ar').name).toBe('اللَّبنة للبناء والإعمار')
  })

  it('الصفحة الفرنسية تأخذ الفرنسية', () => {
    expect(legalInLocale(id, 'fr').name).toBe('LABINA POUR LA CONSTRUCTION ET LA RECONSTITUTION')
  })

  it('الفرنسية الغائبة ترجع للعربية — لا خانة بيضاء في صفحة فرنسية', () => {
    expect(legalInLocale(id, 'fr').address).toBe('شارع الهادي نويرة، صفاقس')
  })
})

describe('بذر الهويّة في الترحيل', () => {
  const sql = readFileSync('supabase/migrations/0052_legal_identity.sql', 'utf8')

  it('المعرّف الوحيد ورأس المال والنشاط مبذورون', () => {
    expect(sql).toContain('2005254J')
    expect(sql).toContain('150000')
    expect(sql).toContain('4521')
  })

  it('رقم التثبّت وعدد المضمون لا يُخزَّنان — مفتاحان يفتحان المضمون الكامل', () => {
    expect(sql).not.toContain('PFEK8U2VZPY1HG')
    expect(sql).not.toMatch(/ER\d{11}/)
  })

  it('تبديل القيمة لا يُنشئ سطراً ثانياً: on conflict يحيّن', () => {
    expect(sql).toMatch(/on conflict \(key\) do update set/)
  })
})
