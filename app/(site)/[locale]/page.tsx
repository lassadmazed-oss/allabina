import Link from 'next/link'
import { getBuildTiers } from '@/lib/supabase/server'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatNumber, formatRange, perM2Label } from '@/lib/format'

export const dynamic = 'force-dynamic'

const HOME_PATHS = ['build_on_land', 'land_and_house', 'apartment', 'rent_to_own'] as const

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const p = (s = '') => path(locale, s)
  const { tiers, referencePrice } = await getBuildTiers('SFX', locale)
  const perM2 = `${perM2Label(locale)} HT`

  return (
    <>
      {/* الواجهة — Hero */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <div className="brick-pattern absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-28">
          {/* items-start: النصّ يلتفّ سطرين على التليفون، واللبنة تبقى مع أوّله */}
          <div className="mb-5 flex items-start gap-3 text-[13px] leading-6 text-[#BFD3C6] sm:mb-6 sm:items-center sm:text-sm">
            <span className="brick mt-1.5 shrink-0 sm:mt-0" aria-hidden="true" />
            <span>{t.home.badge}</span>
          </div>
          <h1 className="display max-w-3xl text-[1.75rem] font-semibold leading-snug sm:text-5xl sm:leading-tight lg:text-6xl">
            {t.home.title}
          </h1>
          <p className="mt-4 max-w-2xl leading-8 text-[#B9CDBF] sm:mt-6 sm:text-lg">{t.home.lede}</p>
          {/* على التليفون: زرّان متساويان بعرض الشاشة — الإبهام يصيبهما بلا تصويب */}
          <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-wrap">
            <Link
              href={p('/demande')}
              className="flex min-h-12 items-center justify-center rounded bg-gold-light px-7 font-medium text-brand-deep transition hover:bg-[#c08c46] active:scale-[0.99]"
            >
              {t.home.cta1}
            </Link>
            <Link
              href={p('/simulateur')}
              className="flex min-h-12 items-center justify-center rounded border border-[#2C4437] px-7 font-medium text-[#EAF2EC] transition hover:border-[#4d6b5b] active:scale-[0.99]"
            >
              {t.home.cta2}
            </Link>
          </div>
          <p className="mt-6 text-sm leading-6 text-[#8FAB9C]">{t.home.heroNote}</p>
        </div>
      </section>

      {/* المسارات — Parcours */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-16">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t.home.pathsTitle}</h2>
        <p className="mt-3 max-w-2xl text-muted">{t.home.pathsLede}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_PATHS.map((key) => (
            <Link
              key={key}
              href={p(`/demande?type=${key}`)}
              className="group flex flex-col rounded border border-line bg-surface p-4 sm:p-6 transition hover:border-brand hover:shadow-sm"
            >
              <span className="brick mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold group-hover:text-brand">
                {t.labels.requestType[key]}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-7 text-muted">{t.home.paths[key]}</p>
              <span className="mt-4 text-sm font-medium text-brand">{t.home.pathStart}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* كيفاش تخدم — Comment ça marche */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.home.howTitle}</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.home.steps.map((s, i) => (
              <div key={i}>
                <div className="num mb-3 text-sm font-medium text-gold">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* أسعار البناء — Coût de construction */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.home.pricesTitle}</h2>
          <p className="mt-3 leading-8 text-muted">{t.home.pricesLede}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.tier} className="rounded border border-line bg-surface p-4 sm:p-6">
              <span className="brick mb-4 block" aria-hidden="true" />
              <h3 className="text-lg font-semibold">{tier.label}</h3>
              <div className="num mt-2 text-xl font-semibold text-brand">
                <bdi dir="ltr">{formatRange(tier.min, tier.max)}</bdi>
                <span className="text-sm font-normal text-muted"> {perM2}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted">{tier.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-7 text-faint">
          {t.home.pricesNote}{' '}
          <span className="num">
            <bdi dir="ltr">{formatNumber(referencePrice)}</bdi> {perM2}
          </span>
        </p>
      </section>

      {/* لمن — Pour qui */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {[t.home.audience.citizen, t.home.audience.builders, t.home.audience.banks].map((a) => (
            <div key={a.title} className="rounded border border-line bg-surface p-5 sm:p-7">
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-muted">
                {a.items.map((it) => (
                  <li key={it}>— {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* دعوة أخيرة — Appel final */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-5 sm:pb-20">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded border border-line bg-gold-soft p-5 sm:gap-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">{t.home.ctaTitle}</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-ink-soft">{t.home.ctaBody}</p>
          </div>
          <Link
            href={p('/demande')}
            className="flex min-h-12 w-full items-center justify-center rounded bg-brand px-7 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] sm:w-auto"
          >
            {t.nav.cta}
          </Link>
        </div>
      </section>
    </>
  )
}
