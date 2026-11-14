import type { Locale } from '@/lib/i18n'

/**
 * الكاتالوج العمومي — المنطق الخالص.
 *
 * ثلاث قواعد من القسم 03 مكتوبة هنا كشفرة لا كنيّة، لأنّ خرقها لا
 * يُحدث خطأ بل يُحدث كذبة على الشاشة:
 *
 *   1. «البيانات الناقصة تظهر بعد المعاينة أو السعر غير متاح، ولا
 *      تُحسب بصفر». سعر غائب يُعرض صفراً يعني «مجّاني».
 *   2. «لا نقارن سعراً للقطعة بسعر للمتر». مقارنة بوحدتين مختلفتين
 *      تبدو صحيحة وتضلّل تماماً.
 *   3. «لا يظهر هامش الشركة ولا سعر الشراء الداخلي للحريف». ما لا
 *      يُشكَّل للعرض لا يخرج.
 */

export type Availability = 'in_stock' | 'on_order' | 'on_survey'

export type CatalogArticle = {
  id: string
  code: string
  lotCode: number
  lotNameAr: string
  lotNameFr: string
  designationAr: string
  designationFr: string
  descriptionAr: string | null
  descriptionFr: string | null
  unit: string
  /** سعر التوريد + اليد العاملة، بلا أداء. null = غير متاح */
  priceHt: number | null
  availability: Availability
  leadTimeDays: number | null
  installationNote: string | null
  usageNote: string | null
  specs: Record<string, string> | null
  imageUrl: string | null
}

/** ما يُسمح بخروجه إلى المتصفّح. كلّ ما عداه يبقى في الخادم. */
const PUBLIC_KEYS = new Set<keyof CatalogArticle>([
  'id',
  'code',
  'lotCode',
  'lotNameAr',
  'lotNameFr',
  'designationAr',
  'designationFr',
  'descriptionAr',
  'descriptionFr',
  'unit',
  'priceHt',
  'availability',
  'leadTimeDays',
  'installationNote',
  'usageNote',
  'specs',
  'imageUrl',
])

/** حقول داخلية لا تخرج أبداً — تُفحص بالاسم لا بالثقة */
export const INTERNAL_KEYS = [
  'manufacturer_code',
  'manufacturerCode',
  'margin',
  'marginPct',
  'purchasePrice',
  'puAchat',
  'pu_achat',
  'costPrice',
  'qty_formula',
  'qtyFormula',
] as const

/**
 * يُسقط كلّ ما ليس في القائمة البيضاء.
 * القائمة بيضاء لا سوداء: حقل جديد يُضاف للجدول غداً لا يتسرّب لأنّ
 * أحداً نسي يضيفه للممنوعات.
 */
export function toPublic(row: Record<string, unknown>): CatalogArticle {
  const out = {} as Record<string, unknown>
  for (const k of PUBLIC_KEYS) out[k] = row[k] ?? null
  return out as unknown as CatalogArticle
}

// ─────────────────────────────────────────────────────────── السعر

export type Price =
  | { kind: 'known'; ht: number; ttc: number | null }
  /** يُحدَّد بعد المعاينة — ليس صفراً وليس «مجّاني» */
  | { kind: 'on_survey' }
  /** لا سعر معتمد لهذا المقال */
  | { kind: 'unavailable' }

export function priceOf(
  article: Pick<CatalogArticle, 'priceHt' | 'availability'>,
  taxRatePct: number | null = null
): Price {
  if (article.availability === 'on_survey') return { kind: 'on_survey' }
  const ht = article.priceHt
  if (ht === null || ht === undefined || !Number.isFinite(ht)) return { kind: 'unavailable' }
  // سعر صفر ليس سعراً: مقال لم تُدخل قيمته بعد
  if (ht <= 0) return { kind: 'unavailable' }
  const ttc = taxRatePct === null ? null : ht * (1 + taxRatePct / 100)
  return { kind: 'known', ht, ttc }
}

// ───────────────────────────────────────────────────────── المقارنة

export type CompareRefusal = 'too_few' | 'too_many' | 'mixed_units'

export function canCompare(
  items: Pick<CatalogArticle, 'unit'>[],
  max = 3
): { ok: true } | { ok: false; reason: CompareRefusal } {
  if (items.length < 2) return { ok: false, reason: 'too_few' }
  if (items.length > max) return { ok: false, reason: 'too_many' }
  const units = new Set(items.map((i) => i.unit))
  if (units.size > 1) return { ok: false, reason: 'mixed_units' }
  return { ok: true }
}

// ───────────────────────────────────────────────────────── البحث

/** بحث بالاسم والمرجع — بلا حساسية لحالة الحرف ولا للمسافات الزائدة */
export function matches(article: CatalogArticle, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [article.code, article.designationAr, article.designationFr, article.descriptionAr]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q))
}

export type Filters = {
  lotCode?: number
  unit?: string
  availability?: Availability
  maxPriceHt?: number
  query?: string
}

export function applyFilters(items: CatalogArticle[], f: Filters): CatalogArticle[] {
  return items.filter((a) => {
    if (f.lotCode !== undefined && a.lotCode !== f.lotCode) return false
    if (f.unit && a.unit !== f.unit) return false
    if (f.availability && a.availability !== f.availability) return false
    if (f.maxPriceHt !== undefined) {
      const p = priceOf(a)
      // سعر غير معروف لا يُفترض أنّه تحت السقف ولا فوقه: يُستبعد من
      // ترشيح بالسعر بدل أن يُحسب صفراً فيظهر في كلّ نتيجة
      if (p.kind !== 'known' || p.ht > f.maxPriceHt) return false
    }
    if (f.query && !matches(a, f.query)) return false
    return true
  })
}

// ───────────────────────────────────────────────────────── العرض

export const designationIn = (a: CatalogArticle, locale: Locale) =>
  locale === 'fr' ? a.designationFr || a.designationAr : a.designationAr

export const lotNameIn = (a: CatalogArticle, locale: Locale) =>
  locale === 'fr' ? a.lotNameFr || a.lotNameAr : a.lotNameAr

export const descriptionIn = (a: CatalogArticle, locale: Locale) =>
  locale === 'fr' ? a.descriptionFr || a.descriptionAr : a.descriptionAr
