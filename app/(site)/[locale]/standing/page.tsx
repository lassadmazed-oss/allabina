import Link from 'next/link'
import { db, getStandingLevels } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatMoney, formatNumber, formatSignedMoney, perM2Label } from '@/lib/format'
import {
  biggestDifferences,
  breakdownTotal,
  lotBreakdown,
  plusValue,
  type LotShare,
} from '@/lib/standing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').standingPage
  return { title: t.pageTitle, description: t.lede }
}

const SURFACES = [80, 100, 120, 150, 180, 220]
const DEFAULT_SURFACE = 120

type Lot = { code: number; name_ar: string; name_fr: string }
type ShareRow = { standing_code: string; lot_code: number; share_pct: number }

export default async function StandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ surface?: string; level?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.standingPage
  const isFr = locale === 'fr'

  const [levels, { data: lotsRaw }, { data: sharesRaw }] = await Promise.all([
    getStandingLevels(),
    db.from('lots').select('code, name_ar, name_fr').eq('is_active', true).order('code'),
    db.from('standing_lot_shares').select('standing_code, lot_code, share_pct'),
  ])

  if (levels.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-16">
        <h1 className="display text-3xl font-semibold">{t.title}</h1>
        <p className="mt-4 leading-8 text-muted">{t.disclaimer}</p>
      </div>
    )
  }

  const lots = (lotsRaw ?? []) as Lot[]
  const shares = (sharesRaw ?? []) as ShareRow[]

  const surface = SURFACES.includes(Number(sp.surface)) ? Number(sp.surface) : DEFAULT_SURFACE
  const selected = levels.find((l) => l.code === sp.level) ?? levels[Math.floor(levels.length / 2)]

  const sharesOf = (code: string): LotShare[] =>
    lots.map((lot) => ({
      lotCode: lot.code,
      lotNameAr: lot.name_ar,
      lotNameFr: lot.name_fr,
      sharePct:
        shares.find((s) => s.standing_code === code && s.lot_code === lot.code)?.share_pct ?? 0,
    }))

  const lotName = (l: { lotNameAr: string; lotNameFr?: string | null }) =>
    (isFr && l.lotNameFr) || l.lotNameAr

  const breakdown = lotBreakdown(selected.price, sharesOf(selected.code), surface)
  const maxPerM2 = Math.max(1, ...breakdown.map((b) => b.perM2))
  const levelName = (lv: (typeof levels)[number]) => ((isFr && lv.nameFr) || lv.nameAr) as string

  const link = (over: { surface?: number; level?: string }) =>
    path(
      locale,
      `/standing?surface=${over.surface ?? surface}&level=${over.level ?? selected.code}`
    )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-12">
      <h1 className="display text-3xl font-semibold">{t.title}</h1>
      <p className="mt-4 max-w-3xl leading-8 text-muted">{t.lede}</p>

      {/* اختيار المساحة */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t.surfaceLabel}</span>
        {SURFACES.map((s) => (
          <Link
            key={s}
            href={link({ surface: s })}
            className={`num rounded border px-3 py-1.5 text-sm transition ${
              s === surface
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-muted hover:border-line-strong'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* بطاقات المستويات */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {levels.map((lv) => {
          const active = lv.code === selected.code
          return (
            <Link
              key={lv.code}
              href={link({ level: lv.code })}
              className={`rounded border p-5 transition ${
                active
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="display font-semibold">{levelName(lv)}</span>
                <span className="num text-xs text-faint">{lv.code}</span>
              </div>
              <div className="num mt-2 text-lg font-semibold text-brand">
                {formatNumber(lv.price)}{' '}
                <span className="text-xs font-normal text-muted">{perM2Label(locale)}</span>
              </div>
              <div className="num mt-1 text-sm text-muted">
                {formatMoney(lv.price * surface, locale)}
              </div>
              <p className="mt-3 text-xs leading-6 text-muted">
                {(isFr && lv.descriptionFr) || lv.descriptionAr}
              </p>
              {active && (
                <span className="mt-3 inline-block rounded bg-brand px-2 py-0.5 text-xs text-white">
                  {t.currentBadge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* التوزيع */}
      <section className="mt-12">
        <h2 className="display text-xl font-semibold">{t.breakdownTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{t.breakdownLede}</p>

        {/* على التليفون: عمود «الدينار للمتر» ينزل تحت اسم اللوط بدل ما يدفع
            الجدول إلى تمرير أفقي لا يراه المستعمل ولا يخمّن أنّه موجود */}
        <div className="mt-5 rounded border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2">
                <th className="px-3 py-3 text-start text-xs font-semibold text-muted sm:px-4">
                  {t.lotCol}
                </th>
                <th className="hidden px-4 py-3 text-start text-xs font-semibold text-muted sm:table-cell">
                  {t.perM2Col}
                </th>
                <th className="px-3 py-3 text-start text-xs font-semibold text-muted sm:px-4">
                  {t.totalCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((line) => (
                <tr key={line.lotCode} className="border-t border-line">
                  <td className="px-3 py-2.5 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="num w-6 shrink-0 text-xs text-faint">{line.lotCode}</span>
                      <span className="flex-1 sm:min-w-32">
                        {lotName(line)}
                        <span className="num mt-0.5 block text-xs text-faint sm:hidden">
                          {formatNumber(line.perM2, 1)} {perM2Label(locale)}
                        </span>
                      </span>
                      <span
                        className="hidden h-1.5 rounded-full bg-gold-light sm:block"
                        style={{ width: `${Math.round((line.perM2 / maxPerM2) * 90)}px` }}
                        aria-hidden="true"
                      />
                    </div>
                  </td>
                  <td className="num hidden px-4 py-2.5 text-muted sm:table-cell">
                    {formatNumber(line.perM2, 1)}
                  </td>
                  <td className="num px-3 py-2.5 sm:px-4">{formatMoney(line.total, locale)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong bg-surface-2 font-semibold">
                <td className="px-3 py-3 sm:px-4">{t.totalLabel}</td>
                <td className="num hidden px-4 py-3 sm:table-cell">{formatNumber(selected.price)}</td>
                <td className="num px-3 py-3 sm:px-4">
                  {formatMoney(breakdownTotal(breakdown), locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* المقارنة */}
      <section className="mt-12">
        <h2 className="display text-xl font-semibold">{t.compareTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{t.compareLede}</p>

        <div className="mt-5 flex flex-col gap-3">
          {levels
            .filter((lv) => lv.code !== selected.code)
            .map((lv) => {
              const pv = plusValue(selected.price, lv.price, surface)
              const up = pv.diff > 0
              const diffs = biggestDifferences(
                breakdown,
                lotBreakdown(lv.price, sharesOf(lv.code), surface),
                3
              )
              return (
                <div key={lv.code} className="rounded border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <Link
                      href={link({ level: lv.code })}
                      className="-my-2 inline-flex min-h-11 items-center font-medium text-brand hover:underline"
                    >
                      {fmt(up ? t.upgradeTo : t.downgradeTo, { level: levelName(lv) })}
                    </Link>
                    <span
                      className={`num rounded px-3 py-1 text-sm font-medium ${
                        up ? 'bg-gold-soft text-gold' : 'bg-brand-soft text-brand'
                      }`}
                    >
                      {fmt(up ? t.diffMore : t.diffLess, {
                        amount: formatMoney(Math.abs(pv.diff), locale),
                      })}
                    </span>
                  </div>

                  {diffs.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <span className="text-xs text-faint">{t.whereTitle}</span>
                      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        {diffs.map((d) => (
                          <li key={d.lotCode}>
                            {(isFr && d.lotNameFr) || d.lotNameAr}{' '}
                            <span className="num text-ink-soft">
                              {formatSignedMoney(d.diff, locale)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </section>

      <p className="mt-8 text-xs leading-6 text-faint">{t.htNote}</p>
      <p className="mt-3 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
        {t.disclaimer}
      </p>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded border border-line bg-surface p-4 sm:p-6">
        <div>
          <h2 className="font-semibold">{t.ctaTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.ctaBody}</p>
        </div>
        <Link
          href={path(locale, '/demande?type=build_on_land')}
          className="rounded bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {dict.nav.cta}
        </Link>
      </section>
    </div>
  )
}
