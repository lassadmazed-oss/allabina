'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatMoney, formatNumber } from '@/lib/format'
import { candidateFit, simulate, type SimTerms } from '@/lib/property-sim'
import { saveMatchAction } from '@/lib/actions/property-admin'

export type SimCandidate = {
  id: string
  name: string
  ref: string
  band: string | null
  score: number
  reasons: string[]
  /** JSON أسباب المطابقة كما يحفظها saveMatchAction */
  reasonsJson: string
  budget: number | null
  /** null = الملفّ المالي غير معبّأ */
  income: number | null
  existingLoans: number
  downPayment: number
  saved: boolean
}

const tnd = (v: number) => formatMoney(Math.round(v), 'ar')

/**
 * محاكي العقار ومن يناسبه.
 *
 * التسبقة والمدّة والنسبة تتبدّل، والقسط والدخل اللازم يتحسبو فوراً — ومعهم
 * كلّ حريف مطابق: تكفي تسبقته؟ يتحمّل القسط؟ وإلّا كم ينقص وبأيّ ثمن يولّي
 * في متناوله. من هنا يُحفظ التطابق، ويُفتح ملفّ الحريف على حلوله أو رسالته.
 */
export default function PropertySimulator({
  propertyId,
  price,
  defaults,
  candidates,
  canEdit,
  note,
}: {
  propertyId: string
  price: number | null
  defaults: SimTerms & { maxYears: number }
  candidates: SimCandidate[]
  canEdit: boolean
  note: string
}) {
  const [downPct, setDownPct] = useState(20)
  const [years, setYears] = useState(defaults.years)
  const [ratePct, setRatePct] = useState(defaults.ratePct)
  const terms: SimTerms = { downPct, years, ratePct, dtiPct: defaults.dtiPct }
  const sim = useMemo(() => (price ? simulate(price, { downPct, years, ratePct, dtiPct: defaults.dtiPct }) : null), [price, downPct, years, ratePct, defaults.dtiPct])

  const rows = candidates.map((c) => ({
    c,
    fit: sim && c.income !== null ? candidateFit(sim, { income: c.income, existingLoans: c.existingLoans, downPayment: c.downPayment }, terms) : null,
  }))
  const readyNow = rows.filter((r) => r.fit?.downOk && r.fit.paymentOk).length

  return (
    <section id="clients" className="scroll-mt-6 rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="display text-lg font-bold text-ink">المحاكي: من يقدر على هذا العقار؟</h2>
        {sim && (
          <span className="text-sm text-muted">
            بهذه الشروط: <b className="num text-[#1f6b3f]">{readyNow}</b> من <span className="num">{candidates.length}</span> حرفاء مطابقين يقدرو الآن
          </span>
        )}
      </div>

      {!price ? (
        <p className="p-5 text-sm text-muted">الثمن غير مصرّح به — المحاكاة تحتاج ثمناً. المطابقة تبقى تحت.</p>
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <Slider label="التسبقة" value={downPct} min={0} max={60} step={5} suffix="%" onChange={setDownPct} />
            <Slider label="مدّة القرض" value={years} min={5} max={defaults.maxYears} step={1} suffix=" سنة" onChange={setYears} />
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">النسبة السنوية التقديرية</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={25}
                  step={0.25}
                  value={ratePct}
                  onChange={(e) => setRatePct(Math.max(0, Number(e.target.value) || 0))}
                  className="num h-9 w-20 rounded-lg border border-line bg-ground px-2 text-center"
                />
                <span className="text-muted">%</span>
              </span>
            </label>
            <p className="text-[11px] leading-5 text-faint">{note}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <Tile label="التسبقة" value={tnd(sim!.down)} />
            <Tile label="القرض" value={tnd(sim!.loan)} />
            <Tile label="القسط الشهري" value={tnd(sim!.monthly)} strong />
            <Tile label="الدخل الأدنى اللازم" value={tnd(sim!.incomeNeeded)} hint={`سقف استدانة ${formatNumber(defaults.dtiPct)}%`} />
          </dl>
        </div>
      )}

      <div className="border-t border-line">
        <div className="px-5 pb-2 pt-4 text-sm font-semibold text-ink">
          الحرفاء المطابقون — وحلّ كلّ واحد
        </div>
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">ما فمّاش حريف مطابق توّا في هالمنطقة وهالميزانية.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ c, fit }) => {
              const ok = fit?.downOk && fit.paymentOk
              let hint: string
              if (!fit) hint = c.income === null ? 'الملفّ المالي غير معبّأ — كمّله قبل أيّ اقتراح.' : 'حدّد ثمناً للمحاكاة.'
              else if (ok) hint = 'يقدر عليه بهذه الشروط — اقترحه عليه في رسالته.'
              else if (!fit.paymentOk)
                hint = `في متناوله حتى ثمن ≈ ${tnd(fit.affordablePrice)}${price ? ` (تفاوض بـ${tnd(Math.max(0, price - fit.affordablePrice))})` : ''} — أو مدّة أطول أو تسبقة أكبر.`
              else hint = `ينقصه ${tnd(fit.downShort)} من التسبقة — مساهمة عائلية أو تفاوض على الثمن.`

              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span
                    className={`num flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      c.score >= 75 ? 'bg-brand text-white' : 'bg-brand-soft text-brand'
                    }`}
                    title="نسبة المطابقة"
                  >
                    {c.score}%
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/admin/${c.id}`} className="font-semibold text-ink hover:text-brand hover:underline">
                        {c.name}
                      </Link>
                      <span className="num text-xs text-faint" dir="ltr">
                        {c.ref}
                      </span>
                      {c.band && <span className="rounded bg-surface-2 px-1.5 text-[11px] text-muted">صنف {c.band}</span>}
                      {c.budget ? <span className="num text-xs text-muted">ميزانية {tnd(c.budget)}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {fit && (
                        <>
                          <Pill ok={fit.downOk} text={fit.downOk ? 'التسبقة تكفي' : `ينقص ${tnd(fit.downShort)} تسبقة`} />
                          <Pill ok={fit.paymentOk} text={fit.paymentOk ? 'يتحمّل القسط' : `القسط يفوق قدرته بـ${tnd(fit.paymentShort)}`} />
                        </>
                      )}
                      {c.reasons.map((r) => (
                        <span key={r} className="rounded bg-ground px-1.5 py-0.5 text-muted">
                          {r}
                        </span>
                      ))}
                    </div>
                    <p className={`mt-1 text-xs ${ok ? 'text-[#1f6b3f]' : 'text-gold'}`}>{hint}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {c.saved ? (
                      <span className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand">محفوظ للمتابعة</span>
                    ) : (
                      canEdit && (
                        <form action={saveMatchAction}>
                          <input type="hidden" name="request_id" value={c.id} />
                          <input type="hidden" name="property_id" value={propertyId} />
                          <input type="hidden" name="score" value={c.score} />
                          <input type="hidden" name="reasons" value={c.reasonsJson} />
                          <button className="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-deep">
                            احفظ للمتابعة
                          </button>
                        </form>
                      )
                    )}
                    <Link href={`/admin/${c.id}#sec-brief`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-brand hover:border-brand">
                      حلول الملفّ
                    </Link>
                    <Link href={`/admin/${c.id}#sec-proposal`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-brand hover:border-brand">
                      رسالة للحريف
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between">
        <span className="text-muted">{label}</span>
        <b className="num text-ink">
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-brand"
      />
    </label>
  )
}

function Tile({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? 'bg-brand text-white' : 'bg-ground'}`}>
      <dt className={`text-xs ${strong ? 'text-white/80' : 'text-muted'}`}>{label}</dt>
      <dd className="num mt-1 text-lg font-bold leading-tight">{value}</dd>
      {hint && <dd className={`mt-0.5 text-[11px] ${strong ? 'text-white/70' : 'text-faint'}`}>{hint}</dd>}
    </div>
  )
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 font-medium ${ok ? 'bg-[#e6f0e9] text-[#1f6b3f]' : 'bg-gold-soft text-gold'}`}>
      {ok ? '✓ ' : '! '}
      {text}
    </span>
  )
}
