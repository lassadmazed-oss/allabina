'use client'

import { useActionState } from 'react'
import { submitPledgeAction, type PledgeState } from '@/lib/actions/support'
import { PUBLIC_PLEDGE_KINDS } from '@/lib/support'
import type { Dictionary } from '@/lib/i18n'

const initial: PledgeState = { ok: false }

/**
 * تعهّد عيني من العموم. لا حقل مبلغ ولا وسيلة دفع ولا حساب بنكي:
 * غياب هذه الحقول هنا قرار، لا نقص.
 */
export default function PledgeForm({
  t,
  cases,
}: {
  t: Dictionary['soutien']
  cases: { id: string; title: string }[]
}) {
  const [state, formAction, pending] = useActionState(submitPledgeAction, initial)

  if (state.ok) {
    return (
      <div
        role="status"
        className="rounded border border-brand bg-brand-soft p-6 text-sm leading-7 text-brand-deep"
      >
        {t.pledgeThanks}
      </div>
    )
  }

  const field = 'mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm'

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* مصيدة الآليات — champ piège */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {state.error && (
        <div
          role="alert"
          className="rounded border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm text-[#8c2f22]"
        >
          {state.error === 'rateLimited'
            ? t.pledgeRateLimited
            : state.error === 'server'
              ? t.pledgeServerError
              : t.pledgeError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">{t.pledgeName}</span>
          <input name="full_name" required minLength={3} className={field} />
        </label>
        <label className="text-sm">
          <span className="font-medium">{t.pledgePhone}</span>
          <input name="phone" inputMode="tel" required className={`${field} num`} />
        </label>
        <label className="text-sm">
          <span className="font-medium text-muted">{t.pledgeEmail}</span>
          <input name="email" type="email" className={field} />
        </label>
        <label className="text-sm">
          <span className="font-medium">{t.pledgeKind}</span>
          <select name="kind" required defaultValue="" className={field}>
            <option value="" disabled>
              —
            </option>
            {PUBLIC_PLEDGE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.kinds[k] ?? k}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cases.length > 0 && (
        <label className="text-sm">
          <span className="font-medium text-muted">{t.pledgeCase}</span>
          <select name="support_case_id" defaultValue="" className={field}>
            <option value="">{t.pledgeCaseAny}</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-sm">
        <span className="font-medium">{t.pledgeLabel}</span>
        <input name="label" required className={field} placeholder={t.pledgeLabelHint} />
        <span className="mt-1 block text-xs text-faint">{t.pledgeLabelHint}</span>
      </label>

      <label className="text-sm">
        <span className="font-medium text-muted">{t.pledgeNote}</span>
        <textarea name="note" rows={3} className={field} />
      </label>

      <label className="flex items-start gap-2 text-sm leading-6">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>{t.pledgeConsent}</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? t.pledgeSubmitting : t.pledgeSubmit}
      </button>

      <p className="text-xs leading-6 text-faint">{t.noMoneyNote}</p>
    </form>
  )
}
