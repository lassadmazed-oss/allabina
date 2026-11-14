import type { Metadata } from 'next'
import { recordEvent } from '@/lib/analytics-server'
import Link from 'next/link'
import ArticlePrice from '@/components/ArticlePrice'
import {
  catalogOpen,
  catalogTaxRate,
  getPublicArticles,
  getPublicLots,
} from '@/lib/catalog-server'
import { getDelegations } from '@/lib/supabase/server'
import { applyFilters, designationIn, lotNameIn, parseCodes, toggleCode } from '@/lib/catalog'
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
  searchParams: Promise<{ q?: string; lot?: string; cmp?: string; region?: string }>
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

  // المنطقة من العنوان: السعر المعروض سعرُها، والسبب يُقال تحته
  const regionId = Number(sp.region)
  const region = Number.isFinite(regionId) && regionId > 0
    ? { govCode: 'SFX', delegationId: regionId }
    : null

  const [lots, all, taxRatePct, delegations] = await Promise.all([
    getPublicLots(),
    getPublicArticles(300, region, locale),
    catalogTaxRate(),
    getDelegations('SFX'),
  ])

  const lotCode = sp.lot ? Number(sp.lot) : undefined
  const query = (sp.q ?? '').slice(0, 80)
  // «تصفّح صنف»: يُسجَّل عند اختيار لوط لا عند كلّ فتح صفحة
  if (lotCode) await recordEvent('category_view', { govCode: 'SFX', meta: { lot: lotCode } })

  const items = applyFilters(all, {
    lotCode: Number.isFinite(lotCode) ? lotCode : undefined,
    query,
  })

  // قائمة المقارنة تعيش في العنوان: تشتغل بلا جافاسكريبت، وتُنسَخ وتُرسَل
  const selected = parseCodes(sp.cmp)

  const href = (over: { lot?: number | null; q?: string; cmp?: string[] }) => {
    const p = new URLSearchParams()
    if (region) p.set('region', String(region.delegationId))
    const lot = over.lot === undefined ? lotCode : over.lot
    const q = over.q === undefined ? query : over.q
    const cmp = over.cmp === undefined ? selected : over.cmp
    if (lot) p.set('lot', String(lot))
    if (q) p.set('q', q)
    if (cmp.length) p.set('cmp', cmp.join(','))
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
        <label className="basis-44">
          <span className="sr-only">{t.regionLabel}</span>
          <select
            name="region"
            defaultValue={region ? String(region.delegationId) : ''}
            className="w-full rounded border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="">{t.regionAll}</option>
            {delegations.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name_ar}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-brand px-5 font-semibold text-white">
          {t.searchLabel}
        </button>
      </form>
      <p className="mt-2 text-xs leading-7 text-faint">{t.regionHint}</p>

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
            <li key={a.id} className="flex flex-col">
              <Link
                href={`/${locale}/catalogue/${encodeURIComponent(a.code)}`}
                className="flex flex-1 flex-col rounded border border-line bg-surface p-4 transition hover:border-line-strong"
              >
                {a.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="mb-3 aspect-[4/3] w-full rounded object-cover"
                  />
                )}
                <span className="num text-xs text-faint">{isolateNumbers(a.code)}</span>
                <span className="mt-1 font-semibold leading-7">{designationIn(a, locale)}</span>
                <span className="mt-0.5 text-xs text-muted">{lotNameIn(a, locale)}</span>
                <span className="mt-3 flex items-baseline gap-2">
                  <ArticlePrice article={a} taxRatePct={taxRatePct} locale={locale} t={t} compact />
                </span>
                {a.regionNote && (
                  <span className="mt-1 text-xs text-gold">{a.regionNote}</span>
                )}
              </Link>
              {/* الاختيار رابط لا خانة: يشتغل بلا جافاسكريبت */}
              <Link
                href={href({ cmp: toggleCode(selected, a.code) })}
                aria-pressed={selected.includes(a.code)}
                className={`mt-1.5 rounded border px-3 py-1.5 text-center text-xs ${
                  selected.includes(a.code)
                    ? 'border-brand bg-brand-soft font-medium text-brand'
                    : 'border-line text-muted'
                }`}
              >
                {selected.includes(a.code) ? `✓ ${t.comparing}` : t.compare}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-7 text-faint">{t.note}</p>

      {/* شريط الاختيار: ثابت أسفل الشاشة ما دام فيه مقال */}
      {selected.length > 0 && (
        <div
          className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-2 rounded border border-line bg-surface p-3 shadow-sm"
          style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <span className="num text-sm font-semibold">{isolateNumbers(String(selected.length))}</span>
          <span className="text-sm text-muted">{t.comparing}</span>
          <Link
            href={`/${locale}/catalogue/comparer?codes=${encodeURIComponent(selected.join(','))}`}
            className={`ms-auto rounded px-4 py-2 text-sm font-semibold text-white ${
              selected.length >= 2 ? 'bg-brand' : 'pointer-events-none bg-line-strong'
            }`}
            aria-disabled={selected.length < 2}
          >
            {t.compareOpen}
          </Link>
          <Link href={href({ cmp: [] })} className="rounded border border-line px-3 py-2 text-sm text-muted">
            {t.compareClear}
          </Link>
        </div>
      )}

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
