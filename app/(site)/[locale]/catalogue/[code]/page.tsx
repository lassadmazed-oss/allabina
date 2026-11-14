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
import { getArticleProducts } from '@/lib/products-server'
import { getCurrentStaff } from '@/lib/auth'
import {
  canShowProduct,
  materialPerUnit,
  packLabel,
  packPriceHt,
  productName,
  productSubtitle,
  shownProducts,
} from '@/lib/products'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { formatMillimes, isolateNumbers } from '@/lib/format'

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

  /**
   * المواد المعروضة: المنشورة للجميع، وغير المنشورة للفريق وحده.
   *
   * «انشرها نشوفها» و«لا تُعرض أسعار ما تثبّتنا منها» لا يتناقضان: من
   * داخلٌ بحساب فريق يرى المعاينة موسومة، والزائر لا يرى إلّا ما
   * اعتُمد. ولا يُعرض للزائر كلفةُ المادّة للوحدة: هي وسعرُ المقال
   * معاً يكشفان الهامش.
   */
  const [alternatives, siblings, priceDate, links, staff] = await Promise.all([
    getAlternatives(a.id),
    getStandingSiblings(a),
    getPriceListDate(),
    getArticleProducts(a.id),
    getCurrentStaff(),
  ])

  const isStaff = Boolean(staff)
  const materials = isStaff
    ? [...links].sort((x, y) => {
        if (x.isDefault !== y.isDefault) return x.isDefault ? -1 : 1
        return (packPriceHt(x.product, 19) ?? 0) - (packPriceHt(y.product, 19) ?? 0)
      })
    : shownProducts(links)

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
        {a.regionNote && (
          <p className="mt-1.5 text-sm text-gold">
            {t.regionNoteLabel}: {a.regionNote}
          </p>
        )}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row k={t.unit} v={a.unit} mono />
          <Row k={t.includesLabel} v={a.includes ? (t.includes[a.includes] ?? null) : null} />
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

      {/*
        الاختيارات: نفس الشغل بمواد مختلفة، والحريف يختار.
        المقال المفتوح يظهر معهم موسوماً — قائمة تُخفي ما أنت فيه تجعل
        المقارنة في الذاكرة بدل الشاشة.
      */}
      {siblings.length > 0 && (
        <section className="mt-6">
          <h2 className="display text-lg font-semibold">{t.otherStandings}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.otherStandingsLede}</p>
          <ul className="mt-3 grid gap-2">
            {[...siblings, a]
              .sort((x, y) => (x.priceHt ?? 0) - (y.priceHt ?? 0))
              .map((s) => {
                const current = s.id === a.id
                return (
                  <li key={s.id}>
                    <Link
                      href={`/${locale}/catalogue/${encodeURIComponent(s.code)}`}
                      aria-current={current ? 'true' : undefined}
                      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border px-3 py-2.5 transition ${
                        current
                          ? 'border-brand bg-brand-soft'
                          : 'border-line bg-surface hover:border-line-strong'
                      }`}
                    >
                      <span className="text-sm font-medium">{standingIn(s, locale) || s.code}</span>
                      {current && <span className="text-xs text-brand">· {t.thisOne}</span>}
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
                )
              })}
          </ul>
        </section>
      )}

      {materials.length > 0 && (
        <section className="mt-6">
          <h2 className="display text-lg font-semibold">{t.materials}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.materialsLede}</p>

          {isStaff && materials.some((m) => !canShowProduct(m)) && (
            <p className="mt-3 rounded border border-line bg-gold-soft px-3 py-2 text-xs leading-7">
              <b>{t.materialPreview}.</b> {t.materialPreviewWhy}
            </p>
          )}

          <ul className="mt-3 grid gap-3">
            {materials.map((m, i) => {
              const p = m.product
              const hidden = !canShowProduct(m)
              const perUnit = materialPerUnit(m, 19)
              const specPairs = Object.entries(p.specs ?? {}).slice(0, 4)
              return (
                <li
                  key={p.id}
                  className={`rounded border p-3 ${
                    hidden ? 'border-dashed border-line-strong bg-bg' : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium leading-7">{productName(p, locale)}</span>
                    {packLabel(p) && (
                      <span className="num text-xs text-faint">{isolateNumbers(packLabel(p)!)}</span>
                    )}
                    {m.isDefault && (
                      <span className="rounded bg-brand-soft px-1.5 text-xs text-brand">
                        {t.materialDefault}
                      </span>
                    )}
                    {!m.isDefault && i === 0 && materials.length > 1 && (
                      <span className="rounded bg-surface-2 px-1.5 text-xs text-muted">
                        {t.materialCheaper}
                      </span>
                    )}
                    {hidden && (
                      <span className="ms-auto rounded bg-gold-soft px-1.5 text-xs text-gold">
                        {p.priceVerified ? t.materialPreview : t.materialUnverified}
                      </span>
                    )}
                  </div>

                  {productSubtitle(p) && (
                    <p className="mt-0.5 text-xs text-muted">{productSubtitle(p)}</p>
                  )}

                  {specPairs.length > 0 && (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {specPairs.map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs leading-6">
                          <dt className="shrink-0 text-faint">{k}</dt>
                          <dd className="text-ink-soft">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {/* كلفة المادّة للفريق وحده: هي وسعرُ المقال يكشفان الهامش */}
                  {isStaff && (
                    <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
                      {perUnit === null ? (
                        t.materialNoCoverage
                      ) : (
                        <>
                          <b className="num text-ink">
                            {isolateNumbers(formatMillimes(perUnit, locale))}
                          </b>{' '}
                          {t.materialPerUnit} <span className="num">{a.unit}</span>
                          {m.coverageNote ? ` · ${m.coverageNote}` : ''}
                        </>
                      )}
                    </p>
                  )}
                </li>
              )
            })}
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
