/**
 * أسعار البناء — الدينار للمتر المربّع، دون احتساب الأداءات (HT).
 * سياسة مرنة: ثلاث فئات مرجعية، والكلفة النهائية تُضبط في devis تفصيلي
 * لكل مسكن حسب المواصفات الفنية والمعمارية.
 */

/**
 * رمز مستوى التشطيب — نصّ لا نوع مُعدّد: المستويات سطور في standing_levels
 * تزيدها الإدارة من الـBack-office، فلا يجوز تثبيتها في الكود.
 */
export type StandingTier = string

export type TierPrice = {
  tier: StandingTier
  label: string
  description: string
  /** السعر المرجعي د.ت/م² HT */
  price: number
  min: number
  max: number
}

/**
 * شبكة احتياطية تُستعمل فقط إذا كان جدول standing_levels فارغاً —
 * صورة طبق الأصل من بذرته. المرجع الحقيقي هو القاعدة.
 */
export const DEFAULT_TIERS: TierPrice[] = [
  { tier: 'B01', label: 'اقتصادي', description: 'بناء سليم بمواد عادية وتشطيب بسيط.', price: 1200, min: 1150, max: 1300 },
  { tier: 'B02', label: 'عادي', description: 'نفس الهيكل مع تشطيب أحسن.', price: 1400, min: 1350, max: 1500 },
  { tier: 'B03', label: 'محسّن', description: 'مستوى مرجعي: مطبخ مركّب وسقف مستعار.', price: 1600, min: 1550, max: 1700 },
  { tier: 'B04', label: 'راقٍ', description: 'مواد وتجهيزات أرقى وواجهة مدروسة.', price: 1800, min: 1750, max: 1900 },
  { tier: 'B05', label: 'Haut Standing', description: 'أعلى مستوى: تجهيزات فاخرة وتهيئة متكاملة.', price: 2000, min: 1950, max: 2200 },
]

/** الفرضية المرجعية لدراسة الجدوى والملفّ البنكي */
export const REFERENCE_PRICE_HT = 1600
export const SENSITIVITY_HT = { min: 1200, max: 2000 }

export function tierByKey(tiers: TierPrice[], key?: string | null): TierPrice | null {
  if (!key) return null
  return tiers.find((t) => t.tier === key) ?? null
}

/** كلفة البناء لمساحة معلومة (HT) */
export function buildCost(areaM2: number, pricePerM2: number): number {
  if (areaM2 <= 0 || pricePerM2 <= 0) return 0
  return areaM2 * pricePerM2
}

/** نطاق الكلفة بين الحدّ الأدنى والأقصى للفئة */
export function buildCostRange(areaM2: number, tier: TierPrice): { min: number; max: number } {
  return { min: buildCost(areaM2, tier.min), max: buildCost(areaM2, tier.max) }
}

/** المساحة القابلة للبناء بميزانية معلومة */
export function buildableArea(budget: number, pricePerM2: number): number {
  if (budget <= 0 || pricePerM2 <= 0) return 0
  return budget / pricePerM2
}

export function tierLabel(key?: string | null): string {
  return DEFAULT_TIERS.find((t) => t.tier === key)?.label ?? '—'
}
