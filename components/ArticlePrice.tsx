import { priceOf, type CatalogArticle } from '@/lib/catalog'
import { formatMoney, isolateNumbers } from '@/lib/format'
import type { Dictionary, Locale } from '@/lib/i18n'

/**
 * سعر مقال كما يُعرض للزائر.
 *
 * ثلاث حالات لا واحدة: سعر معروف، وما يُحدَّد بعد المعاينة، وما لا سعر
 * معتمد له. عرض الحالتين الأخيرتين صفراً يقول للزائر «مجّاني» — وهو
 * بالضبط ما يمنعه القسم 03.
 */
export default function ArticlePrice({
  article,
  taxRatePct,
  locale,
  t,
  compact = false,
}: {
  article: CatalogArticle
  taxRatePct: number | null
  locale: Locale
  t: Dictionary['catalogue']
  compact?: boolean
}) {
  const p = priceOf(article, taxRatePct)

  if (p.kind === 'on_survey') {
    return <span className="text-sm font-medium text-muted">{t.onSurvey}</span>
  }
  if (p.kind === 'unavailable') {
    return <span className="text-sm font-medium text-faint">{t.unavailable}</span>
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <b className="num text-base">{isolateNumbers(formatMoney(p.ht, locale))}</b>
      <span className="text-xs text-faint">
        {t.priceHt}
        {article.unit ? ` · ${article.unit}` : ''}
      </span>
      {!compact && p.ttc !== null && (
        <span className="num text-xs text-muted">
          {isolateNumbers(formatMoney(p.ttc, locale))} {t.priceTtc}
        </span>
      )}
    </span>
  )
}
