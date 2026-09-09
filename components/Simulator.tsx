'use client'

import { useState } from 'react'
import { toAsciiDigits } from '@/lib/digits'
import Link from 'next/link'
import { computeCapacity, formatTND, monthlyPayment, type FinanceSettings } from '@/lib/finance'
import { buildableArea, type TierPrice } from '@/lib/pricing'
import { fmt, path, type Dictionary, type Locale } from '@/lib/i18n'
import { areaLabel, formatNumber, formatPercent, formatRange, perM2Label } from '@/lib/format'

type Product = {
  id: number
  bank: string
  name: string
  target: string
  purpose: string | null
  max_share_pct: number | null
  max_years: number | null
  own_share_note: string | null
  verified_at: string | null
}

export default function Simulator({
  locale,
  t,
  labels,
  assumptions,
  bankTermsNote,
  tiers,
  referencePrice,
  products,
}: {
  locale: Locale
  t: Dictionary['sim']
  labels: Dictionary['labels']
  assumptions: FinanceSettings
  bankTermsNote: string
  tiers: TierPrice[]
  referencePrice: number
  products: Product[]
}) {
  const [income, setIncome] = useState(1500)
  const [spouse, setSpouse] = useState(0)
  const [loans, setLoans] = useState(0)
  const [down, setDown] = useState(20000)
  const [years, setYears] = useState(assumptions.maxYears)
  const [rate, setRate] = useState(assumptions.annualRatePct)
  const [dti, setDti] = useState(assumptions.maxDtiPct)

  const perM2 = `${perM2Label(locale)} HT`
  const m2 = areaLabel(locale)

  const settings: FinanceSettings = {
    annualRatePct: rate,
    maxDtiPct: dti,
    maxYears: Math.max(years, 1),
    registrationFeesPct: assumptions.registrationFeesPct,
  }

  const capacity = computeCapacity({
    monthlyIncome: income,
    spouseIncome: spouse,
    existingLoans: loans,
    downPayment: down,
    years,
    settings,
  })

  const payment = monthlyPayment(capacity.maxLoan, rate, years)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="rounded border border-line bg-gold-soft p-5 text-sm leading-7">
          <strong>{t.scenarioWarn}</strong> {t.scenarioBody}
        </div>

        <div className="rounded border border-line bg-surface p-4 sm:p-8">
          <h2 className="text-lg font-semibold">{t.yourData}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Num label={t.income} unit={t.tnd} value={income} onChange={setIncome} />
            <Num label={t.spouse} unit={t.tnd} value={spouse} onChange={setSpouse} />
            <Num label={t.loans} unit={t.perMonth} value={loans} onChange={setLoans} />
            <Num label={t.down} unit={t.tnd} value={down} onChange={setDown} />
          </div>

          <h2 className="mt-10 text-lg font-semibold">{t.assumptionsTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.assumptionsLede}</p>
          <div className="mt-5 flex flex-col gap-6">
            <Slider
              label={t.years}
              value={years}
              min={5}
              max={30}
              step={1}
              onChange={setYears}
              display={fmt(t.yearsUnit, { n: years })}
            />
            <Slider
              label={t.rate}
              value={rate}
              min={2}
              max={16}
              step={0.25}
              onChange={setRate}
              display={formatPercent(rate, 2)}
            />
            <Slider
              label={t.dti}
              value={dti}
              min={20}
              max={60}
              step={1}
              onChange={setDti}
              display={formatPercent(dti)}
            />
          </div>
        </div>

        {products.length > 0 && (
          <div className="rounded border border-line bg-surface p-4 sm:p-8">
            <h2 className="text-lg font-semibold">{t.productsTitle}</h2>
            <p className="mt-1 text-sm text-muted">{t.productsLede}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {products.map((p) => (
                <div key={p.id} className="rounded border border-line p-4">
                  <div className="text-xs text-gold">{p.bank}</div>
                  <div className="mt-0.5 font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-muted">
                    {p.target === 'individual' ? t.forIndividuals : t.forProfessionals}
                  </div>
                  <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {p.max_share_pct != null && (
                      <span>
                        {t.upTo} <b className="text-brand">{formatPercent(Number(p.max_share_pct))}</b> {t.ofCost}
                      </span>
                    )}
                    {p.max_years != null && (
                      <span>
                        {t.upTo} <b className="text-brand">{p.max_years}</b> {t.yearsWord}
                      </span>
                    )}
                  </div>
                  {!p.verified_at && <div className="mt-2 text-xs text-faint">{t.unverified}</div>}
                </div>
              ))}
            </div>
            {/* البنوك المسجّلة هي ما وثّقناه لا ما نوصي به: قائمة قصيرة
                تُقرأ حصريةً إن لم يُقَل العكس صراحةً. */}
            <p className="mt-4 text-xs leading-6 text-faint">{t.productsNotExclusive}</p>
          </div>
        )}

        <div className="rounded border border-line bg-surface p-4 sm:p-8">
          <h2 className="text-lg font-semibold">{t.buildTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-muted">{t.buildLede}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {tiers.map((tier) => {
              const area = buildableArea(capacity.maxBudget, tier.price)
              const areaMin = buildableArea(capacity.maxBudget, tier.max)
              const areaMax = buildableArea(capacity.maxBudget, tier.min)
              return (
                <div key={tier.tier} className="rounded border border-line p-4">
                  <div className="font-semibold">{tier.label}</div>
                  <div className="num mt-1 text-xs text-muted">
                    <bdi dir="ltr">{formatRange(tier.min, tier.max)}</bdi> {perM2}
                  </div>
                  <div className="num mt-3 text-2xl font-semibold text-brand">
                    <bdi>{formatNumber(Math.round(area))}</bdi> {m2}
                  </div>
                  <div className="num mt-1 text-xs text-faint">
                    {t.range}:{' '}
                    <bdi dir="ltr">
                      {formatRange(Math.round(areaMin), Math.round(areaMax))}
                    </bdi>{' '}
                    {m2}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-xs leading-6 text-faint">
            {t.refPrice}{' '}
            <span className="num">
              <bdi dir="ltr">{formatNumber(referencePrice)}</bdi> {perM2}
            </span>
            . {t.refPriceEnd}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded border border-line bg-brand-deep p-4 sm:p-6 text-white">
          <div className="text-sm text-[#9FBBAB]">{t.resultTitle}</div>
          <div className="num mt-1 text-3xl font-semibold">
            <bdi>{formatTND(capacity.maxBudget, locale)}</bdi>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <Line k={t.monthly} v={formatTND(payment, locale)} />
            <Line k={t.loanAmount} v={formatTND(capacity.maxLoan, locale)} />
            <Line k={t.ownShare} v={formatTND(down, locale)} />
            <Line k={t.duration} v={fmt(t.yearsUnit, { n: years })} />
          </dl>

          <Link
            href={path(locale, '/demande')}
            className="mt-6 block rounded bg-gold-light px-5 py-3 text-center font-medium text-brand-deep transition hover:bg-[#c08c46]"
          >
            {t.resultCta}
          </Link>
        </div>

        <p className="mt-4 rounded border border-line bg-surface p-4 text-xs leading-6 text-muted">
          {bankTermsNote}
        </p>
      </aside>

      {/* شريط حيّ على التليفون: النتيجة تحت السلّم، والمستعمل يحرّك المدخلات
          ويقرأ الرقم يتبدّل بلا ما ينزل ويطلع في كلّ مرّة */}
      <div
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        className="sticky bottom-0 z-30 -mx-4 flex items-center gap-4 border-t border-brand bg-brand-deep px-4 pt-3 text-white lg:hidden"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] leading-5 text-[#9FBBAB]">{t.resultTitle}</div>
          <div className="num truncate text-lg font-semibold">
            <bdi>{formatTND(capacity.maxBudget, locale)}</bdi>
          </div>
        </div>
        <div className="min-w-0 text-end">
          <div className="text-[11px] leading-5 text-[#9FBBAB]">{t.monthly}</div>
          <div className="num truncate text-sm">
            <bdi>{formatTND(payment, locale)}</bdi>
          </div>
        </div>
      </div>
    </div>
  )
}

function Num({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
        {label}
        <span className="text-xs font-normal text-faint">{unit}</span>
      </span>
      {/* نصّ لا number: مع number يُبقي React «0200» في الحقل وهو يحسب 200؛
          والصفر يُعرض خانةً فارغة فلا يُكتب قبله شيء */}
      <input
        type="text"
        inputMode="numeric"
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Number(toAsciiDigits(e.target.value).replace(/\D/g, '')) || 0))}
        className="num w-full rounded border border-line bg-surface px-3.5 py-2.5 outline-none transition focus:border-brand"
      />
    </label>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display: string
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-medium">
        {label}
        <span className="num text-brand">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#1d3a5f]"
      />
    </label>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#2C4437] pb-2">
      <dt className="text-[#9FBBAB]">{k}</dt>
      <dd className="num font-medium">
        <bdi>{v}</bdi>
      </dd>
    </div>
  )
}
