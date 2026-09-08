'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import CoordsField from '@/components/CoordsField'
import ZoneInput, { type Zone } from '@/components/ZoneInput'
import { submitProperty, type PropertyState } from '@/lib/actions/property'
import { PROPERTY_KINDS, LEGAL_STATUSES, parseLooseInt } from '@/lib/property-schema'
import { areaLabel, currencyLabel, formatNumber } from '@/lib/format'
import type { Dictionary, Locale } from '@/lib/i18n'

type Gov = { code: string; name_ar: string; is_active: boolean }
type Deleg = { id: number; gov_code: string; name_ar: string }
type Imada = { id: number; delegation_id: number; name_ar: string }

const initial: PropertyState = { ok: false }

/** كلّ حقل نصّي في الاستمارة — متحكَّم فيه حتى لا يضيع شيء بعد خطأ */
type Values = {
  kind: string
  govCode: string
  delegationId: string
  imadaId: string
  address: string
  areaM2: string
  builtAreaM2: string
  rooms: string
  priceTnd: string
  legalStatus: string
  negotiable: boolean
  description: string
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  ownerNote: string
  consent: boolean
}

const EMPTY: Values = {
  kind: '',
  govCode: 'SFX',
  delegationId: '',
  imadaId: '',
  address: '',
  areaM2: '',
  builtAreaM2: '',
  rooms: '',
  priceTnd: '',
  legalStatus: '',
  negotiable: true,
  description: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  ownerNote: '',
  consent: false,
}

export default function PropertyForm({
  locale,
  t,
  governorates,
  delegations,
  imadas,
  zones,
}: {
  locale: Locale
  t: Dictionary['proprietaire']
  governorates: Gov[]
  delegations: Deleg[]
  imadas: Imada[]
  zones: Zone[]
}) {
  const [state, formAction, pending] = useActionState(submitProperty, initial)
  const [v, setV] = useState<Values>(EMPTY)
  const [recapOpen, setRecapOpen] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }))

  /**
   * الخطأ يجي في نافذة لا في شريط: يظهر مرّة، والقيم تبقى كما كتبها.
   * React يعيد ضبط الاستمارة بعد كلّ إرسال — لكنّ الحقول متحكَّم فيها من
   * الحالة، فتعود بنفس القيم.
   */
  useEffect(() => {
    if (state.error) {
      setRecapOpen(false)
      setErrorOpen(true)
    }
  }, [state])

  const err = (k: string) =>
    state.fields?.includes(k) ? t.errors[k] ?? t.errors.fallback : undefined

  const isLand = v.kind === 'land'
  const delegationImadas = imadas.filter((i) => String(i.delegation_id) === v.delegationId)

  /** قبل الإرسال: تحقّق سريع في المتصفّح، ثمّ الملخّص */
  const openRecap = () => {
    setRecapOpen(true)
  }

  const confirmAndSubmit = () => {
    setRecapOpen(false)
    formRef.current?.requestSubmit()
  }

  const name = (list: { id: number; name_ar: string }[], id: string) =>
    list.find((x) => String(x.id) === id)?.name_ar ?? ''

  const fieldErrors = (state.fields ?? []).map((f) => t.errors[f] ?? `${f}: ${t.errors.fallback}`)

  /** رقم كما يفهمه الخادم؛ وإن لم يكن رقماً عُرض كما كُتب — الخطأ يُسمّيه الخادم */
  const shown = (raw: string, unit: string) => {
    const n = parseLooseInt(raw)
    if (n === null || n === undefined) return ''
    return Number.isNaN(n) ? raw : `${formatNumber(n)} ${unit}`
  }

  const recapRows: [string, string][] = [
    [t.kind, v.kind ? t.kinds[v.kind] : ''],
    [t.governorate, governorates.find((g) => g.code === v.govCode)?.name_ar ?? v.govCode],
    [t.delegation, name(delegations, v.delegationId)],
    [t.imada, name(imadas, v.imadaId)],
    [t.address, v.address],
    [t.areaM2, shown(v.areaM2, areaLabel(locale))],
    ...(isLand
      ? []
      : ([
          [t.builtAreaM2, shown(v.builtAreaM2, areaLabel(locale))],
          [t.rooms, v.rooms],
        ] as [string, string][])),
    [
      t.price,
      shown(v.priceTnd, currencyLabel(locale)) +
        (shown(v.priceTnd, '') && v.negotiable ? ` — ${t.negotiable}` : ''),
    ],
    [t.legalStatus, v.legalStatus ? t.legalStatuses[v.legalStatus] : ''],
    [t.description, v.description],
    [t.ownerName, v.ownerName],
    [t.ownerPhone, v.ownerPhone],
    [t.ownerEmail, v.ownerEmail],
    [t.ownerNote, v.ownerNote],
  ]

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        noValidate
        onSubmit={(e) => {
          // الزرّ يفتح الملخّص؛ الإرسال الحقيقي من داخل النافذة فقط
          if (!recapOpen && !(e.nativeEvent as SubmitEvent).submitter?.hasAttribute('data-confirm')) {
            e.preventDefault()
            openRecap()
          }
        }}
        className="mt-8 flex flex-col gap-6"
      >
        <input type="hidden" name="locale" value={locale} />

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
                    v.kind === k
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    checked={v.kind === k}
                    onChange={(e) => set('kind', e.target.value)}
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
                value={v.govCode}
                onChange={(e) => {
                  set('govCode', e.target.value)
                  set('delegationId', '')
                  set('imadaId', '')
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

            {v.govCode === 'SFX' && (
              <Field label={t.delegation}>
                <select
                  name="delegationId"
                  value={v.delegationId}
                  onChange={(e) => {
                    set('delegationId', e.target.value)
                    set('imadaId', '')
                  }}
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
                <select
                  name="imadaId"
                  value={v.imadaId}
                  onChange={(e) => set('imadaId', e.target.value)}
                  className={inputCls}
                >
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
                <ZoneInput
                  name="address"
                  zones={zones}
                  govCode={v.govCode}
                  delegationId={v.delegationId}
                  locale={locale}
                  className={inputCls}
                  placeholder={t.addressPlaceholder}
                  value={v.address}
                  onChange={(val) => set('address', val)}
                />
              </Field>
            </div>

            <Field label={t.areaM2} error={err('areaM2')}>
              <input
                type="text"
                inputMode="numeric"
                name="areaM2"
                value={v.areaM2}
                onChange={(e) => set('areaM2', e.target.value)}
                className={`${inputCls} num`}
              />
            </Field>

            {!isLand && (
              <>
                <Field label={t.builtAreaM2}>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="builtAreaM2"
                    value={v.builtAreaM2}
                    onChange={(e) => set('builtAreaM2', e.target.value)}
                    className={`${inputCls} num`}
                  />
                </Field>
                <Field label={t.rooms}>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="rooms"
                    value={v.rooms}
                    onChange={(e) => set('rooms', e.target.value)}
                    className={`${inputCls} num`}
                  />
                </Field>
              </>
            )}

            <Field label={t.price} hint={t.priceHint} error={err('priceTnd')}>
              <input
                type="text"
                inputMode="numeric"
                name="priceTnd"
                value={v.priceTnd}
                onChange={(e) => set('priceTnd', e.target.value)}
                placeholder="150 000"
                className={`${inputCls} num`}
              />
            </Field>

            <Field label={t.legalStatus}>
              <select
                name="legalStatus"
                value={v.legalStatus}
                onChange={(e) => set('legalStatus', e.target.value)}
                className={inputCls}
              >
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
            <input
              type="checkbox"
              name="negotiable"
              checked={v.negotiable}
              onChange={(e) => set('negotiable', e.target.checked)}
              className="size-4 accent-[#1d3a5f]"
            />
            <span className="text-sm">{t.negotiable}</span>
          </label>

          <div className="mt-6">
            <CoordsField t={t} inputCls={inputCls} />
          </div>

          <div className="mt-6">
            <Field label={t.description} hint={t.descriptionHint}>
              <textarea
                name="description"
                rows={4}
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
                className={inputCls}
              />
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
              <input
                type="text"
                name="ownerName"
                value={v.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t.ownerPhone} error={err('ownerPhone')}>
              <input
                type="tel"
                name="ownerPhone"
                dir="ltr"
                value={v.ownerPhone}
                onChange={(e) => set('ownerPhone', e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t.ownerEmail} hint={t.optional} error={err('ownerEmail')}>
                <input
                  type="email"
                  name="ownerEmail"
                  dir="ltr"
                  value={v.ownerEmail}
                  onChange={(e) => set('ownerEmail', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t.ownerNote} hint={t.optional}>
                <textarea
                  name="ownerNote"
                  rows={3}
                  value={v.ownerNote}
                  onChange={(e) => set('ownerNote', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded border border-line p-4">
            <input
              type="checkbox"
              name="consent"
              checked={v.consent}
              onChange={(e) => set('consent', e.target.checked)}
              className="mt-1 size-4 accent-[#1d3a5f]"
            />
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
          {pending ? t.submitting : t.review}
        </button>

        {/* الإرسال الحقيقي — زرّ مخفيّ تضغطه نافذة الملخّص */}
        <button type="submit" data-confirm hidden aria-hidden="true" tabIndex={-1} />
      </form>

      {/* نافذة الملخّص */}
      {recapOpen && (
        <Modal title={t.recapTitle} onClose={() => setRecapOpen(false)}>
          <p className="text-sm leading-7 text-muted">{t.recapLede}</p>
          <dl className="mt-4 divide-y divide-line rounded border border-line">
            {recapRows.map(([k, val]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className={`num max-w-[60%] text-end ${val ? '' : 'text-faint'}`} dir="auto">
                  {val || t.notProvided}
                </dd>
              </div>
            ))}
          </dl>
          {!v.consent && (
            <p className="mt-3 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-sm text-gold">
              {t.errors.consent}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setRecapOpen(false)}
              className="rounded border border-line px-5 py-2.5 text-sm hover:border-line-strong"
            >
              {t.recapEdit}
            </button>
            <button
              type="button"
              onClick={confirmAndSubmit}
              disabled={pending || !v.consent}
              className="rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep disabled:opacity-50"
            >
              {pending ? t.submitting : t.recapConfirm}
            </button>
          </div>
        </Modal>
      )}

      {/* نافذة الخطأ */}
      {errorOpen && state.error && (
        <Modal title={t.errorTitle} onClose={() => setErrorOpen(false)} tone="error">
          <p className="text-sm leading-7">{t.errors[state.error] ?? t.errors.banner}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 ps-5 text-sm">
              {fieldErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-6 text-muted">{t.errorKept}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setErrorOpen(false)}
              className="rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
            >
              {t.errorClose}
            </button>
          </div>
        </Modal>
      )}
    </>
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

/** نافذة بسيطة: تُغلق بـEsc وبالنقر خارجها، وتحبس التركيز بصرياً بالتعتيم */
function Modal({
  title,
  onClose,
  tone = 'default',
  children,
}: {
  title: string
  onClose: () => void
  tone?: 'default' | 'error'
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-surface p-6 shadow-xl ${
          tone === 'error' ? 'border-[#e0b4ac]' : 'border-line'
        }`}
      >
        <h2 className={`display text-lg font-semibold ${tone === 'error' ? 'text-[#8c2f22]' : ''}`}>
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
