import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  INTERNAL_KEYS,
  applyFilters,
  baseCode,
  canCompare,
  matches,
  priceOf,
  comparisonRows,
  parseCodes,
  standingIn,
  toPublic,
  toggleCode,
  type CatalogArticle,
} from '@/lib/catalog'

/**
 * الكاتالوج العمومي.
 *
 * ثلاثة أخطاء هنا لا تُحدث عطباً بل كذبة على الشاشة، ولذلك تُختبر:
 * سعر غائب يُعرض صفراً («مجّاني»)، ومقارنة سعر القطعة بسعر المتر
 * (تبدو صحيحة وتضلّل)، وحقل داخلي يتسرّب إلى المتصفّح.
 */
const art = (over: Partial<CatalogArticle> = {}): CatalogArticle => ({
  id: 'a1',
  code: 'A-05-012',
  lotCode: 5,
  lotNameAr: 'البناء',
  lotNameFr: 'Maçonnerie',
  standingCode: 'B03',
  standingNameAr: 'محسّن',
  standingNameFr: 'Confort',
  designationAr: 'بلوك 20',
  designationFr: 'Bloc 20',
  descriptionAr: null,
  descriptionFr: null,
  unit: 'm2',
  priceHt: 42,
  availability: 'in_stock',
  leadTimeDays: null,
  installationNote: null,
  usageNote: null,
  specs: null,
  imageUrl: null,
  isActive: true,
  regionNote: null,
  ...over,
})

describe('السعر لا يُحسب صفراً', () => {
  it('السعر المعروف يُعرض، ومعه TTC إن طُلب', () => {
    expect(priceOf(art(), 19)).toEqual({ kind: 'known', ht: 42, ttc: 42 * 1.19 })
    expect(priceOf(art())).toEqual({ kind: 'known', ht: 42, ttc: null })
  })

  it('الغائب «غير متاح» لا صفر — وصفرٌ معروضٌ معناه مجّاني', () => {
    expect(priceOf(art({ priceHt: null }))).toEqual({ kind: 'unavailable' })
    expect(priceOf(art({ priceHt: 0 }))).toEqual({ kind: 'unavailable' })
    expect(priceOf(art({ priceHt: Number.NaN }))).toEqual({ kind: 'unavailable' })
  })

  it('ما يُحدَّد بعد المعاينة له حالته الخاصّة', () => {
    expect(priceOf(art({ availability: 'on_survey', priceHt: 42 }))).toEqual({ kind: 'on_survey' })
  })

  it('«بعد المعاينة» تسبق السعر ولو كان مُدخَلاً', () => {
    const p = priceOf(art({ availability: 'on_survey', priceHt: 999 }), 19)
    expect(p.kind).toBe('on_survey')
  })
})

describe('المقارنة', () => {
  it('وحدتان مختلفتان لا تُقارنان — سعر القطعة ليس سعر المتر', () => {
    const d = canCompare([art({ unit: 'm2' }), art({ unit: 'u' })])
    expect(d).toEqual({ ok: false, reason: 'mixed_units' })
  })

  it('نفس الوحدة تُقارن، واثنان يكفيان', () => {
    expect(canCompare([art(), art()])).toEqual({ ok: true })
    expect(canCompare([art(), art(), art()])).toEqual({ ok: true })
  })

  it('واحد لا يُقارن بنفسه، وأربعة فوق الحدّ', () => {
    expect(canCompare([art()])).toEqual({ ok: false, reason: 'too_few' })
    expect(canCompare([art(), art(), art(), art()])).toEqual({ ok: false, reason: 'too_many' })
  })
})

describe('ما يخرج إلى المتصفّح', () => {
  it('القائمة بيضاء: حقل غريب لا يمرّ ولو لم يُمنع بالاسم', () => {
    const row = { ...art(), secret_new_column_2027: 'x', margin: 35, pu_achat: 12 }
    const out = toPublic(row as unknown as Record<string, unknown>)
    expect(Object.keys(out)).not.toContain('secret_new_column_2027')
  })

  it('ولا واحد من الحقول الداخلية المعروفة يتسرّب', () => {
    const row: Record<string, unknown> = { ...art() }
    for (const k of INTERNAL_KEYS) row[k] = 'سرّ'
    const out = toPublic(row)
    for (const k of INTERNAL_KEYS) expect(Object.keys(out), k).not.toContain(k)
  })

  it('وما يخرج يحمل ما يحتاجه الزائر فعلاً', () => {
    const out = toPublic({ ...art() } as unknown as Record<string, unknown>)
    for (const k of ['code', 'designationAr', 'unit', 'priceHt', 'availability']) {
      expect(Object.keys(out)).toContain(k)
    }
  })
})

describe('البحث والترشيح', () => {
  const list = [
    art({ id: '1', code: 'A-05-012', designationAr: 'بلوك 20', unit: 'm2', priceHt: 42 }),
    art({ id: '2', code: 'A-09-003', designationAr: 'كابل كهرباء', unit: 'ml', priceHt: 8, lotCode: 9 }),
    art({ id: '3', code: 'A-05-040', designationAr: 'آجر مجوّف', unit: 'm2', priceHt: 120 }),
    art({ id: '4', code: 'A-05-099', designationAr: 'حجر قدّ', unit: 'm2', priceHt: null, availability: 'on_survey' }),
  ]

  it('البحث بالمرجع وبالاسم معاً', () => {
    expect(matches(list[0], 'A-05')).toBe(true)
    expect(matches(list[0], 'بلوك')).toBe(true)
    expect(matches(list[0], 'كابل')).toBe(false)
  })

  it('البحث الفارغ يرجع الكلّ لا لا شيء', () => {
    expect(applyFilters(list, { query: '   ' })).toHaveLength(4)
  })

  it('الترشيح باللوط وبالوحدة', () => {
    expect(applyFilters(list, { lotCode: 9 }).map((a) => a.id)).toEqual(['2'])
    expect(applyFilters(list, { unit: 'm2' })).toHaveLength(3)
  })

  it('سقف السعر يستبعد ما لا سعر له بدل أن يحسبه صفراً', () => {
    const out = applyFilters(list, { maxPriceHt: 50 })
    expect(out.map((a) => a.id)).toEqual(['1', '2'])
    // «حجر قدّ» بلا سعر: لا يظهر تحت كلّ سقف
    expect(out.map((a) => a.id)).not.toContain('4')
  })
})

describe('النشر قرار إدارة', () => {
  const sql = readFileSync('supabase/migrations/0058_catalog_public.sql', 'utf8')

  it('المقال مغلق افتراضياً — 333 سعراً لا تخرج بهجرة', () => {
    expect(sql).toMatch(/is_public boolean not null default false/)
  })

  it('الصورة بلا إذن لا تُنشر: الحقوق عمود لا ملاحظة', () => {
    expect(sql).toContain('credit')
    expect(sql).toContain('license')
  })

  it('مقال ليس بديلاً لنفسه', () => {
    expect(sql).toMatch(/check \(article_id <> alternative_id\)/)
  })
})

describe('قائمة المقارنة في العنوان', () => {
  it('الزيادة والإزالة من نفس الزرّ', () => {
    expect(toggleCode([], 'A-01')).toEqual(['A-01'])
    expect(toggleCode(['A-01'], 'A-01')).toEqual([])
    expect(toggleCode(['A-01'], 'A-02')).toEqual(['A-01', 'A-02'])
  })

  it('الحدّ ثلاثة: الرابع لا يُزاد ولا يطرد أحداً', () => {
    const three = ['A-01', 'A-02', 'A-03']
    expect(toggleCode(three, 'A-04')).toEqual(three)
  })

  it('حالة الحرف لا تصنع مرجعين', () => {
    expect(toggleCode(['A-01'], 'a-01')).toEqual([])
  })

  it('القراءة من العنوان تُنظّف الفراغ والتكرار والزيادة', () => {
    expect(parseCodes(' a-01 , A-02,,A-01 , A-03 , A-04 ')).toEqual(['A-01', 'A-02', 'A-03'])
    expect(parseCodes(undefined)).toEqual([])
  })
})

describe('صفوف المقارنة', () => {
  const a = art({ id: '1', code: 'A-1', priceHt: 40, unit: 'm2', specs: { 'اللون': 'رمادي' } })
  const b = art({ id: '2', code: 'A-2', priceHt: 40, unit: 'm2', specs: { 'المقاومة': '60 بار' } })

  it('ما يختلف يُوسَم، وما يتطابق لا', () => {
    const rows = comparisonRows([a, b])
    const price = rows.find((r) => r.key === 'price_ht')!
    const unit = rows.find((r) => r.key === 'unit')!
    expect(price.differs).toBe(false)
    expect(unit.differs).toBe(false)
    expect(comparisonRows([a, art({ ...b, priceHt: 55 })]).find((r) => r.key === 'price_ht')!.differs).toBe(true)
  })

  it('مواصفة عند واحد وغائبة عند آخر فرقٌ يُرى لا سطرٌ يُحذف', () => {
    const rows = comparisonRows([a, b])
    const color = rows.find((r) => r.specKey === 'اللون')!
    expect(color.values).toEqual(['رمادي', null])
    expect(color.differs).toBe(true)
    expect(rows.find((r) => r.specKey === 'المقاومة')!.values).toEqual([null, '60 بار'])
  })

  it('الخانة الفارغة والمعدومة سواء في العرض', () => {
    const rows = comparisonRows([art({ installationNote: '' }), art({ installationNote: null })])
    expect(rows.find((r) => r.key === 'installation')!.values).toEqual([null, null])
    expect(rows.find((r) => r.key === 'installation')!.differs).toBe(false)
  })

  it('بلا مقالات: بلا صفوف', () => {
    expect(comparisonRows([])).toEqual([])
  })
})

describe('المقال المتوقّف', () => {
  it('حالة التوقّف تخرج إلى الواجهة — بطاقته تقولها لا تخفيها', () => {
    const out = toPublic({ ...art({ isActive: false }) } as unknown as Record<string, unknown>)
    expect(out.isActive).toBe(false)
    expect(Object.keys(out)).toContain('isActive')
  })

  it('المشتغل افتراضياً: خانة غائبة لا تعني متوقّفاً', () => {
    const row = { ...art() } as unknown as Record<string, unknown>
    delete row.isActive
    expect(toPublic(row).isActive).toBeNull()
  })
})

describe('جدول البدائل', () => {
  const sql = readFileSync('supabase/migrations/0058_catalog_public.sql', 'utf8')

  it('مفتاح مركّب يمنع سطرين لنفس العلاقة في نفس الاتّجاه', () => {
    expect(sql).toMatch(/primary key \(article_id, alternative_id\)/)
  })

  it('لا يُقرأ بالمفتاح العمومي: الربط شأن داخلي يُعرض مشكَّلاً', () => {
    expect(sql).toMatch(/revoke all on article_alternatives from anon/)
  })
})

/**
 * مستوى التشطيب في الكاتالوج العمومي.
 *
 * لكلّ مقال نسخة في كلّ مستوى: 67 مقالاً × 5 مستويات = 333 سطراً.
 * نشر الجدول بلا المستوى يعرض «أبواب داخلية» خمس مرّات من 425 د إلى
 * 850 د بلا سبب على الشاشة — وهو بالضبط ما يمنعه القسم 03: لا رقم بلا
 * ما يفسّره.
 */
describe('مستوى التشطيب يُرى', () => {
  const b01 = art({ id: '1', code: 'BO-01-B01', priceHt: 425, standingCode: 'B01', standingNameAr: 'اقتصادي', standingNameFr: 'Économique' })
  const b05 = art({ id: '2', code: 'BO-01-B05', priceHt: 850, standingCode: 'B05', standingNameAr: 'Haut Standing', standingNameFr: 'Haut standing' })

  it('المستوى يخرج إلى المتصفّح مع السعر — لا سعر بلا مستواه', () => {
    const out = toPublic({ ...b05 } as unknown as Record<string, unknown>)
    expect(out.standingCode).toBe('B05')
    expect(out.standingNameAr).toBe('Haut Standing')
  })

  it('الترشيح بالمستوى يرجع نسخة واحدة لا خمساً', () => {
    expect(applyFilters([b01, b05], { standing: 'B01' }).map((a) => a.id)).toEqual(['1'])
    // بلا ترشيح: الكلّ، لأنّ «كلّ المستويات» اختيارٌ مشروع
    expect(applyFilters([b01, b05], {})).toHaveLength(2)
  })

  it('المقارنة تقول إنّ الفرق فرق مستوى لا فرق سعر بلا سبب', () => {
    const rows = comparisonRows([b01, b05])
    const st = rows.find((r) => r.key === 'standing')!
    expect(st.differs).toBe(true)
    expect(st.values).toEqual(['اقتصادي', 'Haut Standing'])
    expect(comparisonRows([b01, b05], 'fr').find((r) => r.key === 'standing')!.values).toEqual([
      'Économique',
      'Haut standing',
    ])
  })

  it('الاسم بالفرنسية يرجع للعربية إن غاب، والعكس', () => {
    expect(standingIn(art({ standingNameFr: '' }), 'fr')).toBe('محسّن')
    expect(standingIn(art({ standingNameAr: '' }), 'ar')).toBe('Confort')
  })

  it('جذع المرجع يجمع نسخ المستويات، ومرجعاً بلا لاحقة لا يُقصّ', () => {
    expect(baseCode('BO-01-B03')).toBe('BO-01')
    expect(baseCode('BO-01-b05')).toBe('BO-01')
    expect(baseCode('A-05-012')).toBe('A-05-012')
    // «B1» ليست لاحقة مستوى: اللاحقة رقمان
    expect(baseCode('X-01-B1')).toBe('X-01-B1')
  })
})

/**
 * نصّ الكاتالوج لا يَدّعي ما لم يحصل.
 *
 * الأسعار بذرةٌ معيَّرة على السوق، ولم يراجعها أحد سطراً سطراً
 * (updated_by فارغ في 333 سطراً). فنصّ يقول «أسعارهم المعتمدة» كذبةٌ
 * على صفحة عمومية، لا خطأ تنسيق.
 */
describe('الصفحة لا تدّعي اعتماداً لم يقع', () => {
  const src = readFileSync('lib/i18n.ts', 'utf8')
  const ar = src.slice(src.indexOf("catalogue: {"), src.indexOf("account: {"))

  it('لا «أسعارهم المعتمدة» ولا «prix validés»', () => {
    expect(ar).not.toContain('بأسعارهم المعتمدة')
    expect(src).not.toContain('leurs prix validés')
  })

  it('وتقول إنّها استرشادية، وتحمل تاريخها', () => {
    expect(src).toContain('priceNoticeTitle')
    expect(src).toContain('priceDateLabel')
    expect(ar).toContain('استرشادية')
  })
})
