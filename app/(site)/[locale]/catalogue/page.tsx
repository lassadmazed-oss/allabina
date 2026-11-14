import type { Metadata } from 'next'
import Link from 'next/link'
import ArticlePrice from '@/components/ArticlePrice'
import {
  catalogOpen,
  catalogTaxRate,
  getPublicArticles,
  getPublicLots,
} from '@/lib/catalog-server'
import { applyFilters, designationIn, lotNameIn } from '@/lib/catalog'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').catalogue
  return { title: t.pageTitle, description: t.lede }
}

export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; lot?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).catalogue

  // الكاتالوج مغلق حتّى تعتمد الإدارة الأسعار — نقولها بدل صفحة فارغة
  if (!(await catalogOpen())) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:py-20">
        <h1 className="display text-2xl font-semibold sm:text-3xl">{t.closedTitle}</h1>
        <p className="mt-3 leading-8 text-muted">{t.closedBody}</p>
        <Link
          href={`/${locale}/demande`}
          className="mt-6 inline-block rounded bg-brand px-5 py-3 font-semibold text-white"
        >
          {t.cta}
        </Link>
      </div>
    )
  }

  const [lots, all, taxRatePct] = await Promise.all([
    getPublicLots(),
    getPublicArticles(),
    catalogTaxRate(),
  ])

  const lotCode = sp.lot ? Number(sp.lot) : undefined
  const query = (sp.q ?? '').slice(0, 80)
  const items = applyFilters(all, {
    lotCode: Number.isFinite(lotCode) ? lotCode : undefined,
    query,
  })

  const href = (over: { lot?: number | null; q?: string }) => {
    const p = new URLSearchParams()
    const lot = over.lot === undefined ? lotCode : over.lot
    const q = over.q === undefined ? query : over.q
    if (lot) p.set('lot', String(lot))
    if (q) p.set('q', q)
    const s = p.toString()
    return `/${locale}/catalogue${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
      <p className="mt-2 max-w-2xl leading-8 text-muted">{t.lede}</p>

      {/* بحث بلا جافاسكريبت: النتيجة في العنوان فتُشارَك وتُحفظ */}
      <form action={`/${locale}/catalogue`} className="mt-6 flex flex-wrap gap-2">
        {lotCode ? <input type="hidden" name="lot" value={lotCode} /> : null}
        <label className="flex-1 basis-56">
          <span className="sr-only">{t.searchLabel}</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t.searchPlaceholder}
            className="w-full rounded border border-line bg-surface px-3 py-2.5"
          />
        </label>
        <button type="submit" className="rounded bg-brand px-5 font-semibold text-white">
          {t.searchLabel}
        </button>
      </form>

      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link
          href={href({ lot: null })}
          className={`rounded-full border px-3 py-1.5 ${
            lotCode ? 'border-line text-muted' : 'border-brand bg-brand-soft text-brand'
          }`}
        >
          {t.allLots}
        </Link>
        {lots.map((l) => (
          <Link
            key={l.code}
            href={href({ lot: l.code })}
            className={`rounded-full border px-3 py-1.5 ${
              lotCode === l.code ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'
            }`}
          >
            {locale === 'fr' ? l.nameFr || l.nameAr : l.nameAr}{' '}
            <span className="num text-xs text-faint">{isolateNumbers(String(l.count))}</span>
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-xs text-faint">
        <span className="num">{isolateNumbers(String(items.length))}</span> {t.results}
      </p>

      {items.length === 0 ? (
        <p className="mt-6 rounded border border-line bg-surface px-4 py-6 text-sm text-muted">
          {t.empty}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/${locale}/catalogue/${encodeURIComponent(a.code)}`}
                className="flex h-full flex-col rounded border border-line bg-surface p-4 transition hover:border-line-strong"
              >
                <span className="num text-xs text-faint">{isolateNumbers(a.code)}</span>
                <span className="mt-1 font-semibold leading-7">{designationIn(a, locale)}</span>
                <span className="mt-0.5 text-xs text-muted">{lotNameIn(a, locale)}</span>
                <span className="mt-3 flex items-baseline gap-2">
                  <ArticlePrice article={a} taxRatePct={taxRatePct} locale={locale} t={t} compact />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-7 text-faint">{t.note}</p>

      <section className="mt-10 rounded border border-line bg-gold-soft p-5">
        <h2 className="display text-lg font-semibold">{t.ctaTitle}</h2>
        <p className="mt-1 leading-7 text-muted">{t.ctaBody}</p>
        <Link
          href={`/${locale}/demande`}
          className="mt-4 inline-block rounded bg-brand px-5 py-3 font-semibold text-white"
        >
          {t.cta}
        </Link>
      </section>
    </div>
  )
}
