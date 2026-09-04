/**
 * أسعار البناء — الدينار للمتر المربّع، دون احتساب الأداءات (HT).
 * سياسة مرنة: ثلاث فئات مرجعية، والكلفة النهائية تُضبط في devis تفصيلي
 * لكل مسكن حسب المواصفات الفنية والمعمارية.
 */

export const STANDING_TIERS = ['standard', 'mid', 'premium'] as const
export type StandingTier = (typeof STANDING_TIERS)[number]

export type TierPrice = {
  tier: StandingTier
  label: string
  description: string
  /** السعر المرجعي د.ت/م² HT */
  price: number
  min: number
  max: number
}

/** القيم الافتراضية — تُقرأ من قاعدة البيانات وتُستعمل هذي عند غيابها */
export const DEFAULT_TIERS: TierPrice[] = [
  {
    tier: 'standard',
    label: 'عادي',
    description: 'بناء ومواد بمواصفات عادية، تشطيب بسيط.',
    price: 1200,
    min: 1200,
    max: 1350,
  },
  {
    tier: 'mid',
    label: 'متوسّط ومحسّن',
    description: 'مواد وتجهيزات أرقى، تشطيب محسّن.',
    price: 1500,
    min: 1400,
    max: 1600,
  },
  {
    tier: 'premium',
    label: 'Haut Standing',
    description: 'مواد وتجهيزات فاخرة، تشطيب عالي.',
    price: 1850,
    min: 1700,
    max: 2000,
  },
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
