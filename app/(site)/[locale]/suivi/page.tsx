import Link from 'next/link'
import OwnerAccessForm from '@/components/OwnerAccessForm'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { getPublicStats, lookupRequest } from '@/lib/tracking'
import { formatNumber } from '@/lib/format'
import { COUNTED_STATES, type PublicState } from '@/lib/public-state'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.suivi.pageTitle }
}

const STATE_STYLE: Record<PublicState, string> = {
  resolved: 'border-brand bg-brand-soft text-brand',
  in_progress: 'border-gold-light bg-gold-soft text-gold',
  waiting: 'border-line-strong bg-surface-2 text-muted',
  closed: 'border-line-strong bg-surface-2 text-muted',
}

export default async function SuiviPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; phone?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const dateLocale = locale === 'ar' ? 'fr-TN' : 'fr-FR'

  const submitted = Boolean(sp.ref || sp.phone)
  const [stats, result] = await Promise.all([
    getPublicStats(),
    submitted ? lookupRequest({ ref: sp.ref, phone: sp.phone }) : Promise.resolve(null),
  ])

  const errorMessage =
    result && !result.found
      ? result.reason === 'rate_limited'
        ? t.suivi.tooMany
        : result.reason === 'no_input'
          ? t.suivi.needInput
          : t.suivi.notFound
      : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
      <h1 className="display text-3xl font-semibold">{t.suivi.title}</h1>
      <p className="mt-4 max-w-3xl leading-8 text-muted">{t.suivi.intro}</p>

      {/* الاستعلام عن ملفّ — Consultation d'un dossier */}
      <section className="mt-8 rounded border border-line bg-surface p-4 sm:p-8">
        <h2 className="text-lg font-semibold">{t.suivi.lookupTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.suivi.lookupLede}</p>

        <form method="GET" className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.suivi.refCode}</span>
            <input
              name="ref"
              defaultValue={sp.ref ?? ''}
              dir="ltr"
              required
              placeholder="LB-2026-000001"
              className="num w-full rounded border border-line px-3.5 py-2.5 outline-none focus:border-brand"
            />
          </label>
          <span className="hidden items-end pb-3 text-sm text-faint sm:flex">{t.suivi.and}</span>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.suivi.phone}</span>
            <input
              name="phone"
              defaultValue={sp.phone ?? ''}
              dir="ltr"
              required
              placeholder="20123456"
              className="num w-full rounded border border-line px-3.5 py-2.5 outline-none focus:border-brand"
            />
          </label>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center rounded bg-brand px-6 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] sm:w-auto sm:self-end"
          >
            {t.suivi.submit}
          </button>
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="mt-5 rounded border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm text-[#8c2f22]"
          >
            {errorMessage} {t.suivi.notFoundEnd}{' '}
            <Link href={path(locale, '/demande')} className="underline">
              {t.suivi.newRequest}
            </Link>
            .
          </div>
        )}

        {result?.found && (
          <div className="mt-6 rounded border border-line bg-ground p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-xs text-muted">{t.suivi.refCode}</div>
                <div className="num text-xl font-semibold text-brand" dir="ltr">
                  {result.refCode}
                </div>
              </div>
              <span
                className={`rounded border px-3 py-1.5 text-sm font-medium ${STATE_STYLE[result.state]}`}
              >
                {t.suivi.states[result.state]}
              </span>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-muted">{t.suivi.lastUpdate}</dt>
                <dd className="mt-0.5 leading-7">{result.update ?? t.suivi.noUpdateYet}</dd>
              </div>
              <div>
                <dt className="text-muted">{t.suivi.nextStep}</dt>
                <dd className="mt-0.5 leading-7">
                  {result.nextStep ?? t.suivi.stateDesc[result.state]}
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-line pt-3 text-xs text-faint">
              {t.suivi.registeredOn}{' '}
              <span className="num">
                {new Date(result.createdAt).toLocaleDateString(dateLocale)}
              </span>
              {result.updatedAt && (
                <>
                  {' · '}
                  {t.suivi.updatedOn}{' '}
                  <span className="num">
                    {new Date(result.updatedAt).toLocaleDateString(dateLocale)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* التعديل — صاحب المطلب يصلّح ما سجّله */}
      <section className="mt-8 rounded border border-brand/30 bg-brand-soft p-4 sm:p-8">
        <h2 className="display text-lg font-semibold text-brand-deep">{t.suivi.edit.title}</h2>
        <p className="mt-2 max-w-3xl leading-8 text-ink-soft">{t.suivi.edit.lede}</p>
        <OwnerAccessForm locale={locale} t={t.suivi} defaultRef={sp.ref ?? ''} />
      </section>

      {/* الحالات الثلاث — Les trois états */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">{t.suivi.statesTitle}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {COUNTED_STATES.map((state) => (
            <div key={state} className="rounded border border-line bg-surface p-5">
              <span
                className={`inline-block rounded border px-2.5 py-1 text-xs font-medium ${STATE_STYLE[state]}`}
              >
                {t.suivi.states[state]}
              </span>
              <p className="mt-3 text-sm leading-7 text-muted">{t.suivi.stateDesc[state]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* صورة عامّة على الخدمة — Aperçu général */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">{t.suivi.statsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.suivi.statsLede}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t.suivi.statsReceived} value={stats.received} tone="ink" />
          <Stat label={t.suivi.statsResolved} value={stats.resolved} tone="brand" />
          <Stat label={t.suivi.statsInProgress} value={stats.in_progress} tone="gold" />
          <Stat label={t.suivi.statsWaiting} value={stats.waiting} tone="muted" />
        </div>
        <p className="mt-5 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
          {t.suivi.disclaimer}
        </p>
        <p className="mt-3 text-xs leading-6 text-faint">{t.suivi.privacyNote}</p>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'ink' | 'brand' | 'gold' | 'muted'
}) {
  const color = {
    ink: 'text-ink',
    brand: 'text-brand',
    gold: 'text-gold',
    muted: 'text-muted',
  }[tone]

  return (
    <div className="rounded border border-line bg-surface p-5">
      <div className={`num text-3xl font-semibold ${color}`}>{formatNumber(value)}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  )
}
