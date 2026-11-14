import type { Metadata } from 'next'
import Link from 'next/link'
import { budgetReach, configFromParams } from '@/lib/budget-server'
import { neededFor, type Coverage } from '@/lib/budget-reach'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { THIN_NBSP, formatMoney, isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').budget
  return { title: t.pageTitle, description: t.lede }
}

const field = 'w-full rounded border border-line bg-surface px-3 py-2.5'

/**
 * «بميزانيتك توصل لوين».
 *
 * لا خانة يؤشّر فيها الحريف على «الهيكل»: الخانة تَعِد والحساب يقول.
 * المواصفات والميزانية في العنوان، فالنتيجة تُنسَخ وتُرسَل وتشتغل بلا
 * جافاسكريبت.
 */
export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.budget

  const config = configFromParams(sp)
  const budget = Number(String(sp.b ?? '').replace(/[\s,]/g, ''))
  const asked = Number.isFinite(budget) && budget > 0
  const answer = asked ? await budgetReach(config, budget) : null

  const STATE_AR: Record<Coverage, string> = {
    full: t.done,
    partial: t.partial,
    none: t.notStarted,
  }
  const nameOf = (s: { nameAr: string; nameFr: string }) =>
    locale === 'fr' ? s.nameFr : s.nameAr

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
      <p className="mt-2 leading-8 text-muted">{t.lede}</p>

      <form action={`/${locale}/budget`} className="mt-7 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t.amount}</span>
          <input
            name="b"
            inputMode="numeric"
            defaultValue={asked ? String(budget) : ''}
            placeholder={`30${THIN_NBSP}000`}
            required
            className={`num ${field} text-lg`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.surface}</span>
            <input name="s" inputMode="numeric" defaultValue={config.surface} className={`num ${field}`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.levels}</span>
            <input name="l" inputMode="numeric" defaultValue={config.levels} className={`num ${field}`} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.bedrooms}</span>
            <input name="ch" inputMode="numeric" defaultValue={config.bedrooms} className={`num ${field}`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.livingRooms}</span>
            <input name="sa" inputMode="numeric" defaultValue={config.livingRooms} className={`num ${field}`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.kitchens}</span>
            <input name="cu" inputMode="numeric" defaultValue={config.kitchens} className={`num ${field}`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.bathrooms}</span>
            <input name="sdb" inputMode="numeric" defaultValue={config.bathrooms} className={`num ${field}`} />
          </label>
        </div>

        <button
          type="submit"
          className="min-h-12 justify-self-start rounded bg-brand px-6 font-semibold text-white"
        >
          {t.submit}
        </button>
      </form>

      {answer && (
        <section className="mt-9">
          {/* ── الجواب في سطر ── */}
          <div className="rounded border border-line bg-surface p-5">
            {answer.reach.complete ? (
              <p className="text-lg font-semibold leading-8">{t.complete}</p>
            ) : answer.reach.stopAt ? (
              <p className="text-lg leading-9">
                <span className="text-muted">{t.answerTitle}</span>{' '}
                <b>
                  {answer.reach.stages
                    .filter((s) => s.state === 'full')
                    .map(nameOf)
                    .join(' · ') || '—'}
                </b>
                {' — '}
                <span className="text-muted">{t.stopAt}</span>{' '}
                <b>{nameOf(answer.reach.stopAt)}</b>{' '}
                <span className="num text-brand">
                  {isolateNumbers(String(answer.reach.stopAt.pct))}%
                </span>
              </p>
            ) : (
              <p className="leading-8">{t.nothing}</p>
            )}

            <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-faint">{t.coveredLabel}</dt>
                <dd className="num mt-0.5 font-semibold">
                  {isolateNumbers(formatMoney(answer.reach.covered, locale))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">{t.remainingLabel}</dt>
                <dd className="num mt-0.5 font-semibold text-gold">
                  {isolateNumbers(formatMoney(answer.reach.remaining, locale))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">{t.totalLabel}</dt>
                <dd className="num mt-0.5 font-semibold">
                  {isolateNumbers(formatMoney(answer.reach.total, locale))}
                </dd>
              </div>
            </dl>
          </div>

          {/* ── شطراً شطراً ── */}
          <ul className="mt-5 grid gap-2">
            {answer.reach.stages.map((s) => {
              const gap = s.state === 'partial' ? neededFor(answer.reach, s.key) : null
              return (
                <li
                  key={s.key}
                  className={`rounded border p-3.5 ${
                    s.state === 'none'
                      ? 'border-dashed border-line bg-bg'
                      : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">{nameOf(s)}</span>
                    <span
                      className={`rounded px-1.5 text-xs ${
                        s.state === 'full'
                          ? 'bg-[#e4f1ea] text-[#1d6b45]'
                          : s.state === 'partial'
                            ? 'bg-gold-soft text-gold'
                            : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {STATE_AR[s.state]}
                      {s.state === 'partial' && (
                        <>
                          {' '}
                          <span className="num">{isolateNumbers(String(s.pct))}</span>%
                        </>
                      )}
                    </span>
                    <span className="num ms-auto text-sm text-muted">
                      {isolateNumbers(formatMoney(s.cost, locale))}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 rounded bg-surface-2">
                    <div
                      className={`h-1.5 rounded ${s.state === 'full' ? 'bg-brand' : 'bg-gold'}`}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>

                  {gap !== null && (
                    <p className="mt-2 text-xs leading-6 text-muted">
                      {t.needed}{' '}
                      <b className="num text-ink">
                        {isolateNumbers(formatMoney(gap, locale))}
                      </b>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>

          <p className="mt-5 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
            <b>{t.notQuote}</b>
          </p>
          <p className="mt-2 text-xs leading-7 text-faint">
            {t.how}
            {answer.skipped > 0 && (
              <>
                {' '}
                <span className="num">{isolateNumbers(String(answer.skipped))}</span> {t.skipped}.
              </>
            )}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/demande`}
              className="rounded bg-brand px-5 py-3 font-semibold text-white"
            >
              {t.cta}
            </Link>
            <Link
              href={`/${locale}/catalogue`}
              className="rounded border border-line px-5 py-3 font-semibold"
            >
              {t.catalogue}
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
