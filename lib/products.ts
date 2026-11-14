import { mediaExt } from '@/lib/article-media'
import type { Locale } from '@/lib/i18n'

export const PRODUCT_MEDIA_BUCKET = 'product-media'

/** مسار صورة المنتَج — نفس قاعدة صور المقالات: مجلّد لكلّ منتج */
export function productMediaPath(
  productId: string,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8),
  now: Date = new Date()
): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${productId}/${stamp}-${random}.${mediaExt(mime)}`
}

/**
 * طبقة المنتَج — المنطق الخالص.
 *
 * المقال هو ما يُسعَّر في البوردرو («دهن داخلي · م²»)، والمنتَج هو ما
 * يختاره الحريف («Astralatex من أسترال · 5 كغ»). بينهما رقم واحد:
 * كم وحدةً من المقال تغطّيها عبوة واحدة.
 *
 * وثلاث قواعد هنا تمنع ثلاث كذبات:
 *
 *   1. تغطية ناقصة ← لا حساب. تغطيةٌ مُخترَعة تعطي سعراً يبدو دقيقاً
 *      وهو غلط، ولا أحد يكتشفه لأنّه معقول الشكل.
 *   2. سعر غير متثبَّت منه لا يخرج للحريف. سعر بائع بتخفيض ليس سعر
 *      مورّد، والفرق بينهما هو الفرق بين عرضٍ يُربح وعرضٍ يُخسر.
 *   3. صورة بلا مصدر وإذن لا تُنشر — صور المنتجات ملك أصحابها.
 */

export type Product = {
  id: string
  code: string
  brand: string | null
  rangeName: string | null
  nameAr: string
  nameFr: string | null
  packSize: number | null
  packUnit: string | null
  /** السعر كما وُجد — مع الأداء أو بدونه حسب priceIncludesTax */
  price: number | null
  priceIncludesTax: boolean
  taxRatePct: number | null
  priceSource: string | null
  priceCheckedAt: string | null
  priceVerified: boolean
  specs: Record<string, string> | null
  standard: string | null
  /** ملاحظات داخلية — لا تخرج للحريف */
  notes: string | null
  imageUrl: string | null
  isPublic: boolean
}

/** منتَج مربوط بمقال: المنتج وجسره إلى وحدة المقال */
export type ArticleProduct = {
  product: Product
  /** كم وحدةً من المقال تغطّيها عبوة واحدة. null = غير معروف بعد */
  coveragePerPack: number | null
  coverageNote: string | null
  isDefault: boolean
}

export const productName = (p: Product, locale: Locale) =>
  locale === 'fr' ? p.nameFr || p.nameAr : p.nameAr || p.nameFr || p.code

/** «Astral · Astralatex» — العلامة والجمّة حين توجدان */
export const productSubtitle = (p: Product): string =>
  [p.brand, p.rangeName].filter(Boolean).join(' · ')

/** «5 كغ» — العبوة كما تُباع */
export function packLabel(p: Product): string | null {
  if (p.packSize === null || !p.packUnit) return null
  const n = Number.isInteger(p.packSize) ? String(p.packSize) : String(p.packSize)
  return `${n} ${p.packUnit}`
}

// ───────────────────────────────────────────────────────── السعر

/**
 * سعر العبوة بلا أداء.
 *
 * ما وُجد مع الأداء يُقسَم على النسبة المعلنة، وبلا نسبة لا نخمّن:
 * قسمةٌ على 19 حين تكون النسبة 7 تعطي رقماً أقلّ ممّا هو.
 */
export function packPriceHt(p: Product, defaultRatePct: number | null = null): number | null {
  if (p.price === null || !Number.isFinite(p.price) || p.price <= 0) return null
  if (!p.priceIncludesTax) return p.price
  const rate = p.taxRatePct ?? defaultRatePct
  if (rate === null || !Number.isFinite(rate) || rate < 0) return null
  return p.price / (1 + rate / 100)
}

/**
 * كلفة المادّة لوحدة واحدة من المقال — «قدّاش يكلّف المتر دهناً».
 * null حين تنقص التغطية أو السعر: لا نحسب على فراغ.
 */
export function materialPerUnit(
  link: ArticleProduct,
  defaultRatePct: number | null = null
): number | null {
  const pack = packPriceHt(link.product, defaultRatePct)
  const cover = link.coveragePerPack
  if (pack === null) return null
  if (cover === null || !Number.isFinite(cover) || cover <= 0) return null
  return pack / cover
}

// ──────────────────────────────────────────────── ما ينقص قبل العرض

export type ProductGap = 'price' | 'price_unverified' | 'coverage' | 'photo' | 'specs'

/**
 * ما ينقص هذا المنتَج قبل أن يُعرض للحريف — بالترتيب الذي يُسدّ به.
 * تُعرض في الإدارة كقائمة عمل، لا كخطأ.
 */
const priceGap = (p: Product): ProductGap | null =>
  p.price === null || p.price <= 0 ? 'price' : p.priceVerified ? null : 'price_unverified'

/** مواصفة واحدة ليست مواصفات: لا تكفي ليقارن الحريف */
const thinSpecs = (p: Product): boolean => !p.specs || Object.keys(p.specs).length < 2

export function productGaps(link: ArticleProduct): ProductGap[] {
  const p = link.product
  const gaps: ProductGap[] = []
  const price = priceGap(p)
  if (price) gaps.push(price)
  if (link.coveragePerPack === null) gaps.push('coverage')
  if (!p.imageUrl) gaps.push('photo')
  if (thinSpecs(p)) gaps.push('specs')
  return gaps
}

/** نقص المنتَج وحده — بلا جسر التغطية، لقائمة المنتجات */
export function productOwnGaps(p: Product): ProductGap[] {
  const gaps: ProductGap[] = []
  const price = priceGap(p)
  if (price) gaps.push(price)
  if (!p.imageUrl) gaps.push('photo')
  if (thinSpecs(p)) gaps.push('specs')
  return gaps
}

/**
 * هل يخرج للحريف؟
 *
 * النشر قرار إدارة (is_public)، والسعر المتثبَّت منه شرطٌ فوقه: منتجٌ
 * بسعر بائع يدخل عرضاً ويخرج منه خسارة.
 */
export function canShowProduct(link: ArticleProduct): boolean {
  const p = link.product
  return p.isPublic && p.priceVerified && p.price !== null && p.price > 0
}

/** المنتجات المعروضة لمقال، الافتراضي أوّلاً ثمّ الأرخص */
export function shownProducts(links: ArticleProduct[]): ArticleProduct[] {
  return links
    .filter(canShowProduct)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return (packPriceHt(a.product) ?? 0) - (packPriceHt(b.product) ?? 0)
    })
}

/** عمر السعر بالأيّام — سعرٌ قديم يُراجَع قبل أن يُبنى عليه عرض */
export function priceAgeDays(p: Product, now = new Date()): number | null {
  if (!p.priceCheckedAt) return null
  const then = new Date(p.priceCheckedAt)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000)
}

/** بعد تسعين يوماً السعر يُعاد سؤاله — السوق التونسي تحرّك 12% في سنة */
export const PRICE_STALE_DAYS = 90
export const priceIsStale = (p: Product, now = new Date()): boolean => {
  const age = priceAgeDays(p, now)
  return age !== null && age > PRICE_STALE_DAYS
}
