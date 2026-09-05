import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db, getBuildTiers } from '@/lib/supabase/server'
import { formatTND } from '@/lib/finance'
import { buildCostRange, tierByKey } from '@/lib/pricing'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { areaLabel, currencyLabel, formatNumber, formatRange } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function MerciPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>
}) {
  const { locale: raw, ref } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const refCode = decodeURIComponent(ref)

  const { data: request } = await db
    .from('housing_requests')
    .select('id, ref_code, full_name, request_type, gov_code, desired_area_m2, status, standing')
    .eq('ref_code', refCode)
    .single()

  if (!request) notFound()

  const { data: score } = await db
    .from('scores')
    .select('band, max_budget_tnd, max_loan_tnd, breakdown')
    .eq('request_id', request.id)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const maxPayment = (score?.breakdown as { maxPayment?: number } | null)?.maxPayment ?? 0
  const { tiers } = await getBuildTiers(request.gov_code, locale)
  const tier = tierByKey(tiers, request.standing)
  const costRange =
    tier && request.desired_area_m2 ? buildCostRange(request.desired_area_m2, tier) : null

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <div className="rounded border border-line bg-surface p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          {fmt(t.merci.title, { name: request.full_name.split(' ')[0] })}
        </h1>
        <p className="mt-3 leading-8 text-muted">
          {score ? t.labels.citizenMsg[score.band] : t.merci.fallbackMsg}
        </p>

        <div className="mt-8 rounded border border-line bg-brand-soft p-6">
          <div className="text-sm text-muted">{t.merci.refLabel}</div>
          <div className="num mt-1 text-3xl font-semibold text-brand" dir="ltr">
            {request.ref_code}
          </div>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            {t.merci.refBody}{' '}
            <Link href={path(locale, '/suivi')} className="font-medium text-brand underline">
              {t.merci.trackLink}
            </Link>
            .
          </p>
        </div>

        {score && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Box label={t.form.maxPayment} value={formatTND(maxPayment, locale)} />
            <Box label={t.form.maxLoan} value={formatTND(Number(score.max_loan_tnd ?? 0), locale)} />
            <Box
              label={t.form.maxBudget}
              value={formatTND(Number(score.max_budget_tnd ?? 0), locale)}
            />
          </div>
        )}

        {costRange && tier && (
          <div className="mt-6 rounded border border-line bg-gold-soft p-5">
            <div className="text-sm font-medium">
              {t.merci.buildCost} {tier.label}
            </div>
            <div className="num mt-1 text-xl font-semibold text-brand">
              <bdi dir="ltr">{formatRange(costRange.min, costRange.max)}</bdi>{' '}
              {currencyLabel(locale)}
            </div>
            <p className="mt-2 text-xs leading-6 text-ink-soft">{t.merci.buildCostNote}</p>
          </div>
        )}

        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">{t.merci.summary}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Row
              k={t.merci.type}
              v={t.labels.requestType[request.request_type] ?? request.request_type}
            />
            <Row
              k={t.merci.gov}
              v={request.gov_code === 'SFX' ? (locale === 'ar' ? 'صفاقس' : 'Sfax') : request.gov_code}
            />
            <Row
              k={t.merci.areaWanted}
              v={
                request.desired_area_m2
                  ? `${formatNumber(request.desired_area_m2)} ${areaLabel(locale)}`
                  : t.merci.undefined
              }
            />
            <Row
              k={t.merci.standing}
              v={tier ? tier.label : t.merci.undefined}
            />
            <Row k={t.merci.status} v={t.labels.status[request.status] ?? request.status} />
          </dl>
        </div>

        <p className="mt-8 text-xs leading-6 text-faint">{t.sim.scenarioBody}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={path(locale)}
          className="rounded border border-line px-6 py-3 text-sm hover:border-line-strong"
        >
          {t.merci.home}
        </Link>
        <Link
          href={path(locale, '/simulateur')}
          className="rounded bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {t.merci.trySim}
        </Link>
      </div>
    </div>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-lg font-medium text-brand">
        <bdi>{value}</bdi>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  )
}
