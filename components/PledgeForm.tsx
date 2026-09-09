'use client'

import { useActionState, useState } from 'react'
import { Chip, Field } from '@/components/form-controls'
import { submitPledgeAction, type PledgeState } from '@/lib/actions/support'
import { PUBLIC_PLEDGE_KINDS, composePledgeLabel } from '@/lib/support'
import type { Dictionary } from '@/lib/i18n'

const initial: PledgeState = { ok: false }

export type PledgeNeed = { id: string; kind: string; label: string }
export type PledgeCase = { id: string; title: string; needs: PledgeNeed[] }

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] outline-none transition focus:border-brand'

/**
 * تعهّد عيني من العموم.
 *
 * كان المساهم يكتب «50 كيس إسمنت» في خانة حرّة والفريق يخمّن أيّ حاجة
 * يقصد. الآن يختار الحالة، فتظهر **حاجياتها المفتوحة نفسها** رقائق يؤشّر
 * عليها — والفريق يستلم تعهّداً يسمّي الحاجة بمعرّفها. الخانة الحرّة تبقى
 * لما ليس في القائمة.
 *
 * لا حقل مبلغ ولا وسيلة دفع ولا حساب بنكي: غياب هذه الحقول قرار، لا نقص.
 */
export default function PledgeForm({ t, cases }: { t: Dictionary['soutien']; cases: PledgeCase[] }) {
  const [state, formAction, pending] = useActionState(submitPledgeAction, initial)
  const [caseId, setCaseId] = useState('')
  const [needIds, setNeedIds] = useState<string[]>([])
  const [kind, setKind] = useState('')
  const [other, setOther] = useState('')
  const [consent, setConsent] = useState(false)

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-brand bg-brand-soft p-4 text-sm leading-7 text-brand-deep sm:p-6">
        {t.pledgeThanks}
      </div>
    )
  }

  const selected = cases.find((c) => c.id === caseId) ?? null
  const openNeeds = selected?.needs ?? []
  const chosen = openNeeds.filter((n) => needIds.includes(n.id))
  // النوع: من أوّل حاجة مختارة، وإلّا ما اختاره بنفسه
  const effectiveKind = chosen[0]?.kind ?? kind
  const label = composePledgeLabel(chosen.map((n) => n.label), other)
  const canSubmit = consent && Boolean(effectiveKind) && Boolean(label) && !pending

  const pickCase = (id: string) => {
    setCaseId(id)
    setNeedIds([])
  }
  const toggleNeed = (id: string) =>
    setNeedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {/* مصيدة الآليات — champ piège */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {state.error && (
        <div role="alert" className="rounded-lg border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm text-[#8c2f22]">
          {state.error === 'rateLimited'
            ? t.pledgeRateLimited
            : state.error === 'server'
              ? t.pledgeServerError
              : t.pledgeError}
        </div>
      )}

      {/* ---------- الحالة ---------- */}
      <div>
        <span className="mb-2 block text-sm font-medium">{t.pledgeCasePick}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <Chip on={caseId === ''} onClick={() => pickCase('')} block>
            {t.pledgeCaseAny}
          </Chip>
          {cases.map((c) => (
            <Chip key={c.id} on={caseId === c.id} onClick={() => pickCase(c.id)} block>
              {c.title}
              <span className="block text-[11px] font-normal opacity-70">
                {c.needs.length > 0 ? `${c.needs.length} ${t.needsShort}` : t.noNeedsShort}
              </span>
            </Chip>
          ))}
        </div>
        <input type="hidden" name="support_case_id" value={caseId} />
      </div>

      {/* ---------- حاجيات الحالة المختارة ---------- */}
      {selected && openNeeds.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium">{t.pledgeNeedsPick}</span>
          <p className="mb-2 text-xs text-muted">{t.pledgeNeedsHint}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {openNeeds.map((n) => (
              <Chip key={n.id} on={needIds.includes(n.id)} onClick={() => toggleNeed(n.id)} block check>
                {n.label}
                <span className="block text-[11px] font-normal opacity-70">{t.kinds[n.kind] ?? n.kind}</span>
              </Chip>
            ))}
          </div>
          {needIds.map((id) => (
            <input key={id} type="hidden" name="need_ids" value={id} />
          ))}
        </div>
      )}
      {selected && openNeeds.length === 0 && (
        <p className="rounded-lg border border-gold/40 bg-gold-soft px-3 py-2 text-sm leading-7">{t.pledgeNeedsNone}</p>
      )}

      {/* ---------- النوع: حين لا تسمّيه حاجة مختارة ---------- */}
      {chosen.length === 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium">{t.pledgeKindPick}</span>
          <div className="flex flex-wrap gap-2">
            {PUBLIC_PLEDGE_KINDS.map((k) => (
              <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
                {t.kinds[k] ?? k}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <input type="hidden" name="kind" value={effectiveKind} />

      {/* ---------- ما ليس في القائمة ---------- */}
      <Field label={selected && openNeeds.length > 0 ? t.pledgeOther : t.pledgeLabel} hint={chosen.length ? t.optional : undefined}>
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          className={inputCls}
          placeholder={t.pledgeLabelHint}
          maxLength={200}
        />
      </Field>
      <input type="hidden" name="label" value={label} />

      {/* ---------- من ---------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.pledgeName} required>
          <input name="full_name" required minLength={3} className={inputCls} />
        </Field>
        <Field label={t.pledgePhone} required>
          <input name="phone" inputMode="tel" dir="ltr" required className={`${inputCls} num`} />
        </Field>
        <Field label={t.pledgeEmail} hint={t.optional}>
          <input name="email" type="email" dir="ltr" className={inputCls} />
        </Field>
        <Field label={t.pledgeNote} hint={t.optional}>
          <input name="note" className={inputCls} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-sm leading-6">
        <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[#1d3a5f]" />
        <span>{t.pledgeConsent}</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {pending ? t.pledgeSubmitting : t.pledgeSubmit}
      </button>

      <p className="text-xs leading-6 text-faint">{t.noMoneyNote}</p>
    </form>
  )
}
