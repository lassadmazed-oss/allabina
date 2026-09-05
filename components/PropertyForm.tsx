'use client'

import { useActionState, useState } from 'react'
import CoordsField from '@/components/CoordsField'
import { submitProperty, type PropertyState } from '@/lib/actions/property'
import { PROPERTY_KINDS, LEGAL_STATUSES } from '@/lib/property-schema'
import type { Dictionary, Locale } from '@/lib/i18n'

type Gov = { code: string; name_ar: string; is_active: boolean }
type Deleg = { id: number; gov_code: string; name_ar: string }
type Imada = { id: number; delegation_id: number; name_ar: string }

const initial: PropertyState = { ok: false }

export default function PropertyForm({
  locale,
  t,
  governorates,
  delegations,
  imadas,
}: {
  locale: Locale
  t: Dictionary['proprietaire']
  governorates: Gov[]
  delegations: Deleg[]
  imadas: Imada[]
}) {
  const [state, formAction, pending] = useActionState(submitProperty, initial)
  const [kind, setKind] = useState('')
  const [gov, setGov] = useState('SFX')
  const [delegationId, setDelegationId] = useState('')

  const err = (k: string) =>
    state.fields?.includes(k) ? t.errors[k] ?? t.errors.fallback : undefined

  const isLand = kind === 'land'
  const delegationImadas = imadas.filter((i) => String(i.delegation_id) === delegationId)

  return (
    <form action={formAction} noValidate className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />

      {state.error && (
        <div
          role="alert"
          className="rounded border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm text-[#8c2f22]"
        >
          {t.errors[state.error] ?? t.errors.banner}
        </div>
      )}

      {/* معطيات العقار */}
      <fieldset className="rounded border border-line bg-surface p-6 sm:p-8">
        <legend className="px-2 text-lg font-semibold">{t.sectionProperty}</legend>

        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium">{t.kind}</span>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_KINDS.map((k) => (
              <label
                key={k}
                className={`cursor-pointer rounded border px-5 py-2.5 text-sm transition ${
                  kind === k
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={(e) => setKind(e.target.value)}
                  className="sr-only"
                />
                {t.kinds[k]}
              </label>
            ))}
          </div>
          {err('kind') && <p className="mt-2 text-sm text-[#8c2f22]">{err('kind')}</p>}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label={t.governorate} error={err('govCode')}>
            <select
              name="govCode"
              value={gov}
              onChange={(e) => {
                setGov(e.target.value)
                setDelegationId('')
              }}
              className={inputCls}
            >
              {governorates.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name_ar}
                </option>
              ))}
            </select>
          </Field>

          {gov === 'SFX' && (
            <Field label={t.delegation}>
              <select
                name="delegationId"
                value={delegationId}
                onChange={(e) => setDelegationId(e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {delegations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_ar}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {delegationImadas.length > 0 && (
            <Field label={t.imada}>
              <select name="imadaId" className={inputCls} defaultValue="">
                <option value="">—</option>
                {delegationImadas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name_ar}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="sm:col-span-2">
            <Field label={t.address} hint={t.addressHint}>
              <input type="text" name="address" className={inputCls} />
            </Field>
          </div>

          <Field label={t.areaM2} error={err('areaM2')}>
            <input type="number" inputMode="numeric" name="areaM2" className={inputCls} />
          </Field>

          {!isLand && (
            <>
              <Field label={t.builtAreaM2}>
                <input type="number" inputMode="numeric" name="builtAreaM2" className={inputCls} />
              </Field>
              <Field label={t.rooms}>
                <input type="number" inputMode="numeric" name="rooms" className={inputCls} />
              </Field>
            </>
          )}

          <Field label={t.price} error={err('priceTnd')}>
            <input type="number" inputMode="numeric" name="priceTnd" className={inputCls} />
          </Field>

          <Field label={t.legalStatus}>
            <select name="legalStatus" className={inputCls} defaultValue="">
              <option value="">—</option>
              {LEGAL_STATUSES.map((l) => (
                <option key={l} value={l}>
                  {t.legalStatuses[l]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded border border-line p-4">
          <input type="checkbox" name="negotiable" defaultChecked className="size-4 accent-[#1d3a5f]" />
          <span className="text-sm">{t.negotiable}</span>
        </label>

        <div className="mt-6">
          <CoordsField t={t} inputCls={inputCls} />
        </div>

        <div className="mt-6">
          <Field label={t.description} hint={t.descriptionHint}>
            <textarea name="description" rows={4} className={inputCls} />
          </Field>
        </div>

        <p className="mt-5 rounded border border-line bg-surface-2 p-4 text-xs leading-6 text-muted">
          {t.mediaNote}
        </p>
      </fieldset>

      {/* معطيات المالك */}
      <fieldset className="rounded border border-line bg-surface p-6 sm:p-8">
        <legend className="px-2 text-lg font-semibold">{t.sectionOwner}</legend>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label={t.ownerName} error={err('ownerName')}>
            <input type="text" name="ownerName" className={inputCls} />
          </Field>
          <Field label={t.ownerPhone} error={err('ownerPhone')}>
            <input type="tel" name="ownerPhone" dir="ltr" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.ownerEmail} error={err('ownerEmail')}>
              <input type="email" name="ownerEmail" dir="ltr" className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t.ownerNote}>
              <textarea name="ownerNote" rows={3} className={inputCls} />
            </Field>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded border border-line p-4">
          <input type="checkbox" name="consent" className="mt-1 size-4 accent-[#1d3a5f]" />
          <span className="text-sm leading-7">{t.consent}</span>
        </label>
        {err('consent') && <p className="mt-2 text-sm text-[#8c2f22]">{err('consent')}</p>}

        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="absolute opacity-0"
          style={{ insetInlineStart: '-9999px' }}
          aria-hidden="true"
        />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-brand px-8 py-3 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  )
}

const inputCls =
  'w-full rounded border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition focus:border-brand'

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-[#8c2f22]">{error}</span>}
    </label>
  )
}
