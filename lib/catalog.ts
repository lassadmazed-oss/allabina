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
  /** متوقّف: يبقى بمرجعه في الملفّات القديمة ولا يُقترح للجديد */
  isActive: boolean
  /** سبب فرق سعر المنطقة — يُقال ولا يُدسّ. null = لا قاعدة. */
  regionNote: string | null
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
  'isActive',
  'regionNote',
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

// ─────────────────────────────────────────── المواصفات

/**
 * المواصفات تُحرَّر سطراً سطراً «المفتاح: القيمة».
 *
 * لماذا نصّ لا خانات ثابتة؟ لأنّ مواصفات الآجرّ ليست مواصفات الكابل
 * ولا مواصفات المطبخ. خانات ثابتة تعني عشرين خانة فارغة في كلّ بطاقة،
 * أو جدولاً لكلّ لوط.
 */
export function parseSpecs(text: string): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const line of (text ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (k && v) out[k] = v
  }
  return Object.keys(out).length ? out : null
}

export const formatSpecs = (specs: Record<string, string> | null | undefined): string =>
  specs
    ? Object.entries(specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : ''

// ─────────────────────────────────────────── المقارنة

/**
 * إضافة مرجع إلى قائمة المقارنة أو إزالته.
 *
 * القائمة تعيش في عنوان الصفحة لا في ذاكرة المتصفّح: تشتغل بلا
 * جافاسكريبت، وتُنسَخ وتُرسَل كما هي. والحدّ ثلاثة كما في الكرّاس —
 * ما فوقها لا يُقارَن بل يُتصفَّح.
 */
export function toggleCode(codes: string[], code: string, max = 3): string[] {
  const c = code.trim().toUpperCase()
  if (!c) return codes
  if (codes.includes(c)) return codes.filter((x) => x !== c)
  return codes.length >= max ? codes : [...codes, c]
}

/** «A-01,A-02» → [A-01, A-02]، بلا فراغ ولا تكرار ولا أكثر من الحدّ */
export function parseCodes(raw: string | undefined, max = 3): string[] {
  const seen: string[] = []
  for (const part of (raw ?? '').split(',')) {
    const c = part.trim().toUpperCase()
    if (c && !seen.includes(c) && seen.length < max) seen.push(c)
  }
  return seen
}

export type CompareKind = 'money' | 'days' | 'text'
export type CompareRow = {
  key: string
  kind: CompareKind
  /** مفتاح المواصفة حين يكون السطر مواصفة لا خانة ثابتة */
  specKey?: string
  values: (string | null)[]
  /** يختلف بين المقالات — يُبرَز، وهو سبب المقارنة أصلاً */
  differs: boolean
}

/**
 * صفوف المقارنة: خانة لكلّ سطر، ومقال لكلّ عمود.
 *
 * المواصفات تُجمع من كلّ المقالات: مواصفة عند واحد وغائبة عند آخر
 * فرقٌ يستحقّ أن يُرى، لا سطرٌ يُحذف لأنّه ناقص عند أحدهم.
 */
export function comparisonRows(items: CatalogArticle[]): CompareRow[] {
  if (!items.length) return []

  const specKeys: string[] = []
  for (const a of items) {
    for (const k of Object.keys(a.specs ?? {})) if (!specKeys.includes(k)) specKeys.push(k)
  }

  const rows: CompareRow[] = [
    row('price_ht', 'money', items.map((a) => (a.priceHt === null ? null : String(a.priceHt)))),
    row('unit', 'text', items.map((a) => a.unit || null)),
    row('availability', 'text', items.map((a) => a.availability)),
    row('lead_time', 'days', items.map((a) => (a.leadTimeDays === null ? null : String(a.leadTimeDays)))),
    row('installation', 'text', items.map((a) => a.installationNote)),
    row('usage', 'text', items.map((a) => a.usageNote)),
  ]
  for (const k of specKeys) {
    rows.push({ ...row('spec', 'text', items.map((a) => a.specs?.[k] ?? null)), specKey: k })
  }
  return rows
}

function row(key: string, kind: CompareKind, values: (string | null)[]): CompareRow {
  const shown = values.map((v) => (v === null || v === '' ? null : v))
  const first = shown[0]
  return { key, kind, values: shown, differs: shown.some((v) => v !== first) }
}
