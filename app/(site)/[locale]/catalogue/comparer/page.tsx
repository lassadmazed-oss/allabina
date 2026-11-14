import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  canCompare,
  comparisonRows,
  designationIn,
  lotNameIn,
  parseCodes,
  priceOf,
  type CompareRow,
} from '@/lib/catalog'
import { catalogOpen, catalogTaxRate, getPublicArticlesByCodes } from '@/lib/catalog-server'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { formatMoney, isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').catalogue
  return { title: `${t.compareTitle} — ${t.pageTitle}`, robots: { index: false, follow: true } }
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ codes?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).catalogue

  if (!(await catalogOpen())) notFound()

  // parseCodes يقتطع عند ثلاثة. من كتب أكثر بيده يُقال له لماذا نقص.
  const asked = (sp.codes ?? '').split(',').filter((c) => c.trim()).length
  const codes = parseCodes(sp.codes)
  const trimmed = asked > codes.length
  const [items, taxRatePct] = await Promise.all([
    getPublicArticlesByCodes(codes),
    catalogTaxRate(),
  ])

  const verdict = canCompare(items)
  const missing = codes.length !== items.length

  const back = (
    <Link href={`/${locale}/catalogue`} className="text-sm text-muted underline underline-offset-4">
      {t.back}
    </Link>
  )

  if (!verdict.ok) {
    const msg =
      verdict.reason === 'mixed_units'
        ? t.compareMixedUnits
        : verdict.reason === 'too_many'
          ? t.compareMax
          : t.compareNeedTwo
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {back}
        <h1 className="display mt-4 text-2xl font-semibold">{t.compareTitle}</h1>
        <p className="mt-3 rounded border border-line bg-gold-soft px-4 py-3 leading-8">{msg}</p>
      </div>
    )
  }

  const rows = comparisonRows(items)

  const cell = (r: CompareRow, i: number) => {
    const v = r.values[i]
    if (v === null) return <span className="text-faint">{t.compareNone}</span>
    if (r.kind === 'money') {
      const p = priceOf(items[i], taxRatePct)
      if (p.kind === 'on_survey') return <span className="text-muted">{t.onSurvey}</span>
      if (p.kind === 'unavailable') return <span className="text-faint">{t.unavailable}</span>
      return (
        <span className="num font-semibold">{isolateNumbers(formatMoney(p.ht, locale))}</span>
      )
    }
    if (r.kind === 'days') {
      return (
        <span className="num">
          {isolateNumbers(v)} {t.days}
        </span>
      )
    }
    if (r.key === 'availability') return <span>{t.availability[v] ?? v}</span>
    return <span className="leading-7">{v}</span>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {back}
      <h1 className="display mt-4 text-2xl font-semibold sm:text-3xl">{t.compareTitle}</h1>
      <p className="mt-2 leading-8 text-muted">{t.compareLede}</p>

      {trimmed && (
        <p className="mt-4 rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
          {t.compareMax}
        </p>
      )}

      {missing && (
        <p className="mt-4 rounded border border-line bg-gold-soft px-3 py-2 text-sm leading-7">
          {t.compareMissing}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded border border-line">
        <table className="w-full min-w-[34rem] border-collapse bg-surface text-sm">
          <thead>
            <tr>
              <th className="w-36 border-b border-line bg-bg p-3 text-start text-xs font-semibold text-faint">
                {t.reference}
              </th>
              {items.map((a) => (
                <th key={a.id} className="border-b border-s border-line p-3 text-start align-top">
                  <Link
                    href={`/${locale}/catalogue/${encodeURIComponent(a.code)}`}
                    className="font-semibold leading-7 underline underline-offset-4"
                  >
                    {designationIn(a, locale)}
                  </Link>
                  <span className="num mt-1 block text-xs font-normal text-faint">
                    {isolateNumbers(a.code)}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {lotNameIn(a, locale)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.specKey ? `spec:${r.specKey}` : r.key} className={r.differs ? 'bg-gold-soft' : ''}>
                <th scope="row" className="border-b border-line p-3 text-start align-top text-xs font-medium text-muted">
                  {r.specKey ?? t.compareRows[r.key] ?? r.key}
                </th>
                {items.map((_, i) => (
                  <td key={i} className="border-b border-s border-line p-3 align-top">
                    {cell(r, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-7 text-faint">{t.note}</p>

      <section className="mt-8 rounded border border-line bg-gold-soft p-5">
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
