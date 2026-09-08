'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { submitSupportRequest, type SupportRequestState } from '@/lib/actions/support'
import {
  HOUSING_CONDITIONS,
  INCOME_STABILITY,
  URGENCY_LEVELS,
} from '@/lib/support-schema'
import { path, type Locale } from '@/lib/i18n'

type Delegation = { id: number; name_ar: string }

export type AskHelpStrings = {
  sectionWho: string
  sectionNeed: string
  sectionSituation: string
  fullName: string
  phone: string
  email: string
  optional: string
  delegation: string
  delegationPick: string
  needText: string
  needHint: string
  needPlaceholder: string
  urgency: string
  urgencyLabels: Record<string, string>
  housingCondition: string
  housingLabels: Record<string, string>
  householdSize: string
  dependents: string
  hasDisability: string
  incomeStability: string
  incomeLabels: Record<string, string>
  ownsLand: string
  consent: string
  submit: string
  submitting: string
  errBanner: string
  errRate: string
  errServer: string
  okTitle: string
  okBody: string
  okRefLabel: string
  okTrack: string
  noMoney: string
}

const field =
  'w-full rounded border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-brand'
const label = 'mb-1.5 block text-sm font-medium'

export default function SupportRequestForm({
  locale,
  govCode,
  delegations,
  t,
}: {
  locale: Locale
  govCode: string
  delegations: Delegation[]
  t: AskHelpStrings
}) {
  const [state, action, pending] = useActionState(submitSupportRequest, {
    ok: false,
  } as SupportRequestState)

  if (state.ok) {
    return (
      <div className="mt-8 rounded border border-line bg-surface p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h2 className="display text-2xl font-semibold">{t.okTitle}</h2>
        <p className="mt-3 leading-8 text-muted">{t.okBody}</p>

        {state.ref && (
          <div className="mt-6 rounded border border-line bg-brand-soft p-5">
            <div className="text-sm text-muted">{t.okRefLabel}</div>
            <div className="num mt-1 text-3xl font-semibold text-brand" dir="ltr">
              {state.ref}
            </div>
          </div>
        )}

        <Link
          href={path(locale, '/suivi')}
          className="mt-6 inline-block rounded border border-line px-5 py-2.5 text-sm hover:border-line-strong"
        >
          {t.okTrack}
        </Link>
      </div>
    )
  }

  const errorText =
    state.error === 'rateLimited'
      ? t.errRate
      : state.error === 'server'
        ? t.errServer
        : state.error === 'banner'
          ? t.errBanner
          : null

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="govCode" value={govCode} />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0"
        aria-hidden="true"
      />

      {errorText && (
        <p className="mb-6 rounded border border-[#e3c9c4] bg-[#fbf1ef] px-4 py-3 text-sm text-[#8c2f22]">
          {errorText}
        </p>
      )}

      {/* الحاجة أوّلاً: هي سبب وجود الاستمارة */}
      <fieldset className="rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionNeed}</legend>

        <label className="mt-2 block">
          <span className={label}>{t.needText}</span>
          <p className="mb-2 text-xs leading-6 text-faint">{t.needHint}</p>
          <textarea
            name="needText"
            rows={5}
            required
            minLength={15}
            maxLength={2000}
            placeholder={t.needPlaceholder}
            className={field}
          />
        </label>

        <label className="mt-5 block sm:w-2/3">
          <span className={label}>{t.urgency}</span>
          <select name="urgency" required defaultValue="urgent" className={field}>
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {t.urgencyLabels[u]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {/* الوضعية */}
      <fieldset className="mt-5 rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionSituation}</legend>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.housingCondition}</span>
            <select name="housingCondition" required defaultValue="" className={field}>
              <option value="" disabled>
                —
              </option>
              {HOUSING_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t.housingLabels[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>{t.incomeStability}</span>
            <select name="incomeStability" required defaultValue="" className={field}>
              <option value="" disabled>
                —
              </option>
              {INCOME_STABILITY.map((c) => (
                <option key={c} value={c}>
                  {t.incomeLabels[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>
              {t.householdSize} <span className="text-faint">({t.optional})</span>
            </span>
            <input name="householdSize" inputMode="numeric" className={field} />
          </label>

          <label className="block">
            <span className={label}>
              {t.dependents} <span className="text-faint">({t.optional})</span>
            </span>
            <input name="dependents" inputMode="numeric" className={field} />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded border border-line p-4">
          <input type="checkbox" name="hasDisability" className="size-4 accent-[#1d3a5f]" />
          <span className="text-sm">{t.hasDisability}</span>
        </label>

        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded border border-line p-4">
          <input type="checkbox" name="ownsLand" className="size-4 accent-[#1d3a5f]" />
          <span className="text-sm">{t.ownsLand}</span>
        </label>
      </fieldset>

      {/* من أنت وكيفاش نلقاوك */}
      <fieldset className="mt-5 rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionWho}</legend>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.fullName}</span>
            <input name="fullName" required maxLength={120} className={field} />
          </label>

          <label className="block">
            <span className={label}>{t.phone}</span>
            <input name="phone" required dir="ltr" className={`${field} text-left`} />
          </label>

          <label className="block">
            <span className={label}>{t.delegation}</span>
            <select name="delegationId" required defaultValue="" className={field}>
              <option value="" disabled>
                {t.delegationPick}
              </option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>
              {t.email} <span className="text-faint">({t.optional})</span>
            </span>
            <input type="email" name="email" dir="ltr" className={`${field} text-left`} />
          </label>
        </div>
      </fieldset>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded border border-line bg-surface p-4">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[#1d3a5f]" />
        <span className="text-sm leading-7">{t.consent}</span>
      </label>

      <p className="mt-4 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
        {t.noMoney}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded bg-brand px-6 py-3.5 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  )
}
