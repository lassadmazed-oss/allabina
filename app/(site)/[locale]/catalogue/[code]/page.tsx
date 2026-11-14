import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArticlePrice from '@/components/ArticlePrice'
import {
  catalogOpen,
  catalogTaxRate,
  getAlternatives,
  getPriceListDate,
  getPublicArticle,
  getStandingSiblings,
} from '@/lib/catalog-server'
import { descriptionIn, designationIn, lotNameIn, standingIn } from '@/lib/catalog'
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

  // المستوى في العنوان لا في الصفحة وحدها: خمس بطاقات لنفس المقال
  // بعنوان واحد تصير خمس نتائج متطابقة في محرّك البحث، ولا يعرف
  // الباحث أيّها يفتح.
  const level = standingIn(a, locale)
  const head = level ? `${designationIn(a, locale)} — ${level}` : designationIn(a, locale)
  return {
    title: `${head} — ${t.pageTitle}`,
    description: descriptionIn(a, locale) ?? `${head} · ${t.lede}`,
  }
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
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>
  searchParams: Promise<{ region?: string }>
}) {
  const [{ locale: raw, code }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale).catalogue

  if (!(await catalogOpen())) notFound()

  const regionId = Number(sp.region)
  const region =
    Number.isFinite(regionId) && regionId > 0 ? { govCode: 'SFX', delegationId: regionId } : null

  const [a, taxRatePct] = await Promise.all([
    getPublicArticle(decodeURIComponent(code), region, locale),
    catalogTaxRate(),
  ])
  if (!a) notFound()

  const [alternatives, siblings, priceDate] = await Promise.all([
    getAlternatives(a.id),
    getStandingSiblings(a),
    getPriceListDate(),
  ])

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
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{lotNameIn(a, locale)}</span>
        {standingIn(a, locale) && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
            {t.standingLabel}: {standingIn(a, locale)}
          </span>
        )}
      </p>

      {descriptionIn(a, locale) && (
        <p className="mt-4 leading-8 text-ink-soft">{descriptionIn(a, locale)}</p>
      )}

      <div className="mt-6 rounded border border-line bg-surface p-4">
        <ArticlePrice article={a} taxRatePct={taxRatePct} locale={locale} t={t} />
        {a.regionNote && (
          <p className="mt-1.5 text-sm text-gold">
            {t.regionNoteLabel}: {a.regionNote}
          </p>
        )}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row k={t.unit} v={a.unit} mono />
          <Row k={t.availabilityTitle} v={t.availability[a.availability] ?? a.availability} />
          <Row
            k={t.leadTime}
            v={a.leadTimeDays ? `${a.leadTimeDays} ${t.days}` : null}
            mono
          />
        </dl>
        {/* الرقم وما هو في نفس الإطار: لا سعر بلا صفته وتاريخه */}
        <p className="mt-4 border-t border-line pt-3 text-xs leading-7 text-muted">
          <b>{t.priceNoticeTitle}.</b> {t.priceNoticeBody}
          {priceDate && (
            <>
              {' '}
              {t.priceDateLabel} <span className="num">{isolateNumbers(priceDate.slice(0, 10))}</span>.
            </>
          )}
        </p>
      </div>

      {siblings.length > 0 && (
        <section className="mt-6">
          <h2 className="display text-lg font-semibold">{t.otherStandings}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.otherStandingsLede}</p>
          <ul className="mt-3 grid gap-2">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/catalogue/${encodeURIComponent(s.code)}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border border-line bg-surface px-3 py-2.5 transition hover:border-line-strong"
                >
                  <span className="text-sm font-medium">{standingIn(s, locale) || s.code}</span>
                  <span className="num text-xs text-faint">{isolateNumbers(s.code)}</span>
                  <span className="ms-auto">
                    <ArticlePrice
                      article={s}
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
