import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PRICE_STALE_DAYS,
  canShowProduct,
  materialPerUnit,
  packLabel,
  packPriceHt,
  priceAgeDays,
  priceIsStale,
  productGaps,
  productName,
  productSubtitle,
  shownProducts,
  type ArticleProduct,
  type Product,
} from '@/lib/products'

/**
 * طبقة المنتَج.
 *
 * ثلاثة أخطاء هنا لا تُحدث عطباً بل تُحدث عرضاً غالطاً يُوقَّع:
 * تغطية مُخترَعة، وسعر بائع يُحسب سعر مورّد، وصورة بلا إذن.
 */
const prod = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  code: 'AS-LATMT5',
  brand: 'Astral',
  rangeName: 'Astralatex',
  nameAr: 'دهن أسترالاتكس مات 5 كغ',
  nameFr: 'Astral Astralatex Mat 5 kg',
  packSize: 5,
  packUnit: 'kg',
  price: 23.8,
  priceIncludesTax: true,
  taxRatePct: 19,
  priceSource: 'https://example.test/p',
  priceCheckedAt: '2026-11-14',
  priceVerified: true,
  specs: { 'التشطيب': 'مات', 'القاعدة': 'أكريليك' },
  standard: null,
  notes: null,
  imageUrl: 'https://example.test/i.jpg',
  isPublic: true,
  ...over,
})

const link = (over: Partial<ArticleProduct> = {}): ArticleProduct => ({
  product: prod(),
  coveragePerPack: 25,
  coverageNote: 'طبقتان على تلبيس',
  isDefault: false,
  ...over,
})

describe('سعر العبوة بلا أداء', () => {
  it('ما وُجد مع الأداء يُقسَم على نسبته', () => {
    expect(packPriceHt(prod({ price: 23.8, taxRatePct: 19 }))).toBeCloseTo(20, 5)
  })

  it('وما وُجد بلا أداء يبقى كما هو', () => {
    expect(packPriceHt(prod({ price: 20, priceIncludesTax: false }))).toBe(20)
  })

  it('مع الأداء وبلا نسبة: لا نخمّن', () => {
    expect(packPriceHt(prod({ taxRatePct: null }))).toBeNull()
    // النسبة الافتراضية تُمرَّر صراحةً من المعطيات المرجعية
    expect(packPriceHt(prod({ taxRatePct: null }), 19)).toBeCloseTo(20, 5)
  })

  it('صفر ليس سعراً، ولا السالب', () => {
    expect(packPriceHt(prod({ price: 0 }))).toBeNull()
    expect(packPriceHt(prod({ price: -5 }))).toBeNull()
    expect(packPriceHt(prod({ price: null }))).toBeNull()
  })
})

describe('كلفة المادّة لوحدة المقال', () => {
  it('تُحسب حين تُعرف التغطية', () => {
    // 20 د للعبوة ÷ 25 م² = 0,8 د/م²
    expect(materialPerUnit(link())).toBeCloseTo(0.8, 5)
  })

  it('وتغطية ناقصة تعني لا حساب — لا تخمين', () => {
    expect(materialPerUnit(link({ coveragePerPack: null }))).toBeNull()
    expect(materialPerUnit(link({ coveragePerPack: 0 }))).toBeNull()
  })

  it('وسعر ناقص كذلك', () => {
    expect(materialPerUnit(link({ product: prod({ price: null }) }))).toBeNull()
  })
})

describe('ما ينقص قبل العرض', () => {
  it('المنتج الكامل لا ينقصه شيء', () => {
    expect(productGaps(link())).toEqual([])
  })

  it('سعر بائع غير متثبَّت منه يُوسَم', () => {
    expect(productGaps(link({ product: prod({ priceVerified: false }) }))).toContain(
      'price_unverified'
    )
  })

  it('والتغطية والصورة والمواصفات تُحصى', () => {
    const gaps = productGaps(
      link({
        coveragePerPack: null,
        product: prod({ imageUrl: null, specs: { 'التشطيب': 'مات' } }),
      })
    )
    expect(gaps).toEqual(['coverage', 'photo', 'specs'])
  })
})

describe('ما يخرج للحريف', () => {
  it('منشور ومتثبَّت من سعره', () => {
    expect(canShowProduct(link())).toBe(true)
  })

  it('سعر بائع لا يخرج ولو نُشر — عرضٌ يُبنى عليه يخسر', () => {
    expect(canShowProduct(link({ product: prod({ priceVerified: false }) }))).toBe(false)
  })

  it('وما لم تعتمده الإدارة لا يخرج ولو تثبّتنا من سعره', () => {
    expect(canShowProduct(link({ product: prod({ isPublic: false }) }))).toBe(false)
  })

  it('الترتيب: الافتراضي أوّلاً ثمّ الأرخص', () => {
    const cheap = link({ product: prod({ id: 'c', code: 'C', price: 11.9 }) })
    const dear = link({ product: prod({ id: 'd', code: 'D', price: 47.6 }) })
    const def = link({ product: prod({ id: 'x', code: 'X', price: 35.7 }), isDefault: true })
    expect(shownProducts([dear, cheap, def]).map((l) => l.product.code)).toEqual(['X', 'C', 'D'])
  })

  it('وغير الصالح لا يظهر في القائمة أصلاً', () => {
    const hidden = link({ product: prod({ id: 'h', code: 'H', isPublic: false }) })
    expect(shownProducts([link(), hidden])).toHaveLength(1)
  })
})

describe('عمر السعر', () => {
  const now = new Date('2026-11-14T00:00:00Z')

  it('يُحسب بالأيّام من تاريخ التثبّت', () => {
    expect(priceAgeDays(prod({ priceCheckedAt: '2026-11-04' }), now)).toBe(10)
    expect(priceAgeDays(prod({ priceCheckedAt: null }), now)).toBeNull()
  })

  it('وبعد تسعين يوماً يُعاد سؤاله', () => {
    expect(priceIsStale(prod({ priceCheckedAt: '2026-11-04' }), now)).toBe(false)
    expect(priceIsStale(prod({ priceCheckedAt: '2026-06-01' }), now)).toBe(true)
    // بلا تاريخ لا نقول «قديم»: نقول لا نعرف، وذاك نقصٌ آخر
    expect(priceIsStale(prod({ priceCheckedAt: null }), now)).toBe(false)
    expect(PRICE_STALE_DAYS).toBe(90)
  })
})

describe('العرض', () => {
  it('الاسم يرجع للغة الأخرى إن غاب', () => {
    expect(productName(prod(), 'fr')).toBe('Astral Astralatex Mat 5 kg')
    expect(productName(prod({ nameFr: null }), 'fr')).toBe('دهن أسترالاتكس مات 5 كغ')
  })

  it('العلامة والجمّة سطر واحد', () => {
    expect(productSubtitle(prod())).toBe('Astral · Astralatex')
    expect(productSubtitle(prod({ rangeName: null }))).toBe('Astral')
  })

  it('العبوة لا تُعرض ناقصة', () => {
    expect(packLabel(prod())).toBe('5 kg')
    expect(packLabel(prod({ packUnit: null }))).toBeNull()
  })
})

/**
 * البذرة الأولى أسعار بائع، وتبقى مغلقة حتّى يؤكّدها مورّد.
 * الهجرة نفسها تحمل هذا الشرط — لا الشاشة وحدها.
 */
describe('بذرة الدهن لا تخرج', () => {
  const sql = readFileSync('supabase/migrations/0063_products.sql', 'utf8')

  it('المنتج يولد مغلقاً وسعره غير متثبَّت منه', () => {
    expect(sql).toMatch(/is_public\s+boolean not null default false/)
    expect(sql).toMatch(/price_verified\s+boolean not null default false/)
  })

  it('وكلّ سعر مبذور يحمل مصدره وتاريخه', () => {
    const rows = sql.split('\n').filter((l) => l.includes('https://spacenet.tn'))
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(sql).toContain("date '2026-11-14'")
  })

  it('وصور المنتجات تحتاج مصدراً وإذناً كصور المقالات', () => {
    expect(sql).toContain('credit')
    expect(sql).toContain('license')
    expect(sql).toMatch(/revoke all on product_media from anon/)
  })

  it('ولا مادّة افتراضية مزدوجة لنفس المقال', () => {
    expect(sql).toMatch(/article_products_one_default[\s\S]{0,120}where is_default/)
  })
})
