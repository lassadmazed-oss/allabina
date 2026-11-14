import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArticlePrice from '@/components/ArticlePrice'
import {
  catalogOpen,
  catalogTaxRate,
  getAlternatives,
  getPublicArticle,
} from '@/lib/catalog-server'
import { descriptionIn, designationIn, lotNameIn } from '@/lib/catalog'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}): Promise<Metadata> {
  const { locale: raw, code } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).catalogue
  const a = await getPublicArticle(decodeURIComponent(code))
  if (!a) return { title: t.pageTitle }
  return { title: `${designationIn(a, locale)} — ${t.pageTitle}`, description: descriptionIn(a, locale) ?? t.lede }
}

function Row({ k, v, mono = false }: { k: string; v: string | null; mono?: boolean }) {
  if (!v) return null
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className={`mt-0.5 leading-7${mono ? ' num' : ''}`}>{mono ? isolateNumbers(v) : v}</dd>
    </div>
  )
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>
}) {
  const { locale: raw, code } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).catalogue

  if (!(await catalogOpen())) notFound()

  const [a, taxRatePct] = await Promise.all([
    getPublicArticle(decodeURIComponent(code)),
    catalogTaxRate(),
  ])
  if (!a) notFound()

  const alternatives = await getAlternatives(a.id)

  const specs = a.specs && typeof a.specs === 'object' ? Object.entries(a.specs) : []

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link href={`/${locale}/catalogue`} className="text-sm text-muted underline underline-offset-4">
        {t.back}
      </Link>

      {a.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.imageUrl}
          alt={designationIn(a, locale)}
          decoding="async"
          className="mt-6 aspect-[4/3] w-full rounded border border-line object-cover"
        />
      )}

      {!a.isActive && (
        <div className="mt-6 rounded border border-line bg-gold-soft p-4">
          <p className="font-semibold">{t.discontinuedTitle}</p>
          <p className="mt-1 leading-7 text-muted">{t.discontinuedBody}</p>
        </div>
      )}

      <p className="num mt-6 text-xs text-faint">{isolateNumbers(a.code)}</p>
      <h1 className="display mt-1 text-2xl font-semibold sm:text-3xl">{designationIn(a, locale)}</h1>
      <p className="mt-1 text-sm text-muted">{lotNameIn(a, locale)}</p>

      {descriptionIn(a, locale) && (
        <p className="mt-4 leading-8 text-ink-soft">{descriptionIn(a, locale)}</p>
      )}

      <div className="mt-6 rounded border border-line bg-surface p-4">
        <ArticlePrice article={a} taxRatePct={taxRatePct} locale={locale} t={t} />
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row k={t.unit} v={a.unit} mono />
          <Row k={t.availabilityTitle} v={t.availability[a.availability] ?? a.availability} />
          <Row
            k={t.leadTime}
            v={a.leadTimeDays ? `${a.leadTimeDays} ${t.days}` : null}
            mono
          />
        </dl>
      </div>

      {specs.length > 0 && (
        <section className="mt-5 rounded border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">{t.specs}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {specs.map(([k, v]) => (
              <Row key={k} k={k} v={String(v)} />
            ))}
          </dl>
        </section>
      )}

      {(a.installationNote || a.usageNote) && (
        <section className="mt-5 grid gap-4 rounded border border-line bg-surface p-4">
          <Row k={t.installation} v={a.installationNote} />
          <Row k={t.usage} v={a.usageNote} />
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="mt-6">
          <h2 className="display text-lg font-semibold">{t.alternatives}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.alternativesLede}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {alternatives.map((alt) => (
              <li key={alt.id}>
                <Link
                  href={`/${locale}/catalogue/${encodeURIComponent(alt.code)}`}
                  className="flex h-full flex-col rounded border border-line bg-surface p-3 transition hover:border-line-strong"
                >
                  <span className="num text-xs text-faint">{isolateNumbers(alt.code)}</span>
                  <span className="mt-0.5 font-medium leading-7">{designationIn(alt, locale)}</span>
                  <span className="mt-2">
                    <ArticlePrice
                      article={alt}
                      taxRatePct={taxRatePct}
                      locale={locale}
                      t={t}
                      compact
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-xs leading-7 text-faint">{t.note}</p>

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
