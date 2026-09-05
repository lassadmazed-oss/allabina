/**
 * حساب بوردرو المتر المربّع: سعر المستوى موزّعاً على الـLots.
 *
 * الشبكة هنا تجاوب على «قدّاش؟» بسرعة، والبوردرو التفصيلي يجاوب على
 * «على شنوّة؟». الاثنان يعطيان نفس المجموع بالبناء — راجع
 * `npm run check:bordereau`.
 */

export type LotShare = {
  lotCode: number
  lotNameAr: string
  lotNameFr?: string | null
  sharePct: number
}

export type StandingBreakdownLine = LotShare & {
  /** الدينار للمتر المربّع في هذا اللوط */
  perM2: number
  /** الكلفة على المساحة المطلوبة */
  total: number
}

/** انحراف مقبول في مجموع النسب — التقريب على ثلاث منازل يخلّف كسوراً */
export const SHARE_TOLERANCE = 0.05

export const shareTotal = (shares: LotShare[]) =>
  Math.round(shares.reduce((s, l) => s + l.sharePct, 0) * 1000) / 1000

/** هل مجموع النسب مقبول؟ تنبيه للإدارة لا منع */
export const sharesBalanced = (shares: LotShare[]) =>
  Math.abs(shareTotal(shares) - 100) <= SHARE_TOLERANCE

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * توزيع سعر المستوى على الـLots لمساحة معلومة.
 *
 * النسب مخزّنة بثلاث منازل، فجمع الأسطر بعد التقريب يخالف
 * السعر × المساحة بدينارين أو ثلاثة. الجدول اللي ما يجمّعش يبان غالطاً
 * للحريف، فنحطّو الباقي على أكبر سطر — وهو الفرق الأصغر نسبةً فيه.
 *
 * حدّ التصحيح دينار واحد لكلّ Lot: هذا مدى ضجيج التقريب. أيّ فرق أكبر
 * معناه أنّ التوزيع ناقص فعلاً، فيُترك ظاهراً ولا يُخبَّأ.
 */
export function lotBreakdown(
  pricePerM2: number,
  shares: LotShare[],
  surface: number
): StandingBreakdownLine[] {
  if (pricePerM2 <= 0) return []
  const area = surface > 0 ? surface : 0

  const lines = shares
    .slice()
    .sort((a, b) => a.lotCode - b.lotCode)
    .map((l) => {
      const exactPerM2 = (pricePerM2 * l.sharePct) / 100
      return { ...l, perM2: round2(exactPerM2), total: Math.round(exactPerM2 * area) }
    })

  if (lines.length === 0 || area === 0) return lines

  const target = Math.round(pricePerM2 * area)
  const sum = lines.reduce((s, l) => s + l.total, 0)
  const residual = target - sum

  if (residual !== 0 && Math.abs(residual) <= lines.length) {
    const biggest = lines.reduce((a, b) => (b.total > a.total ? b : a))
    biggest.total += residual
  }

  return lines
}

/** مجموع أسطر التوزيع كما تُعرض — قد يقلّ عن السعر × المساحة إذا كان التوزيع ناقصاً */
export const breakdownTotal = (lines: StandingBreakdownLine[]) =>
  lines.reduce((s, l) => s + l.total, 0)

/** كلفة المستوى على مساحة معلومة */
export const standingCost = (pricePerM2: number, surface: number) =>
  pricePerM2 > 0 && surface > 0 ? round2(pricePerM2 * surface) : 0

/**
 * فرق السعر بين مستويين على نفس المساحة.
 * موجب = زيادة، سالب = توفير. نعرضه للمواطن حتى يشوف ثمن الترقية
 * بالدينار لا بالكلام.
 */
export function plusValue(fromPerM2: number, toPerM2: number, surface: number) {
  const from = standingCost(fromPerM2, surface)
  const to = standingCost(toPerM2, surface)
  const diff = round2(to - from)
  return {
    from,
    to,
    diff,
    pct: from > 0 ? Math.round((diff / from) * 1000) / 10 : 0,
  }
}

/**
 * أكبر الفروق بين مستويين، مرتّبة — «وين يمشي الفرق؟».
 * ترجّع اللوطات التي يتغيّر فيها الإنفاق أكثر من غيرها.
 */
export function biggestDifferences(
  fromLines: StandingBreakdownLine[],
  toLines: StandingBreakdownLine[],
  limit = 5
) {
  const byLot = new Map(fromLines.map((l) => [l.lotCode, l]))

  return toLines
    .map((to) => {
      const from = byLot.get(to.lotCode)
      return {
        lotCode: to.lotCode,
        lotNameAr: to.lotNameAr,
        lotNameFr: to.lotNameFr,
        diff: round2(to.total - (from?.total ?? 0)),
      }
    })
    .filter((d) => d.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, limit)
}
