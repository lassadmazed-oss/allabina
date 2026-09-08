'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import CoordsField from '@/components/CoordsField'
import Modal from '@/components/Modal'
import ZoneInput, { type Zone } from '@/components/ZoneInput'
import PropertyMediaUpload from '@/components/PropertyMediaUpload'
import { submitProperty, type PropertyState } from '@/lib/actions/property'
import { CONDITIONS, LEGAL_STATUSES, PROPERTY_KINDS, parseLooseInt } from '@/lib/property-schema'
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
  bedrooms: string
  livingRooms: string
  bathrooms: string
  floors: string
  floorNumber: string
  yearBuilt: string
  condition: string
  garage: boolean
  garden: boolean
  terrace: boolean
  elevator: boolean
  furnished: boolean
  waterConnected: boolean
  powerConnected: boolean
  roadAccess: boolean
  frontageM: string
  buildable: boolean
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
  bedrooms: '',
  livingRooms: '',
  bathrooms: '',
  floors: '',
  floorNumber: '',
  yearBuilt: '',
  condition: '',
  garage: false,
  garden: false,
  terrace: false,
  elevator: false,
  furnished: false,
  waterConnected: false,
  powerConnected: false,
  roadAccess: false,
  frontageM: '',
  buildable: false,
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

  /** الحقول الغالطة كما جاءت من الخادم؛ lat/lng حقل واحد في الواجهة */
  const badFields = [...new Set((state.fields ?? []).map((f) => (f === 'lng' ? 'lat' : f)))]
  const invalid = (k: string) => badFields.includes(k)
  const invalidCls = (k: string) =>
    invalid(k) ? ' border-[#c0392b] ring-2 ring-[#c0392b]/25' : ''

  /**
   * القفز إلى الحقل: نافذة الخطأ تقول «وين»، والصفحة توصّلك.
   * الإحداثيات ليس لها name (حقلاها مخفيّان) فنقفز إلى خانة الرابط.
   */
  const jumpTo = (field: string) => {
    const selector =
      field === 'lat' || field === 'lng'
        ? '#coords-input'
        : field === 'kind'
          ? 'input[name="kind"]'
          : `[name="${field}"]`
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // التركيز بعد التمرير حتى لا يقطعه المتصفّح
    window.setTimeout(() => el.focus({ preventScroll: true }), 350)
  }

  const closeErrorAndJump = () => {
    setErrorOpen(false)
    if (badFields[0]) jumpTo(badFields[0])
  }

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

  const fieldErrors = badFields.map((f) => ({
    field: f,
    label: t.errors[f] ?? `${f}: ${t.errors.fallback}`,
  }))

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
        ] as [string, string][])),
    [
      t.price,
      shown(v.priceTnd, currencyLabel(locale)) +
        (shown(v.priceTnd, '') && v.negotiable ? ` — ${t.negotiable}` : ''),
    ],
    [t.legalStatus, v.legalStatus ? t.legalStatuses[v.legalStatus] : ''],
    ...(isLand
      ? ([[t.frontageM, v.frontageM ? `${v.frontageM} م` : '']] as [string, string][])
      : ([
          [t.bedrooms, v.bedrooms],
          [t.livingRooms, v.livingRooms],
          [t.bathrooms, v.bathrooms],
          v.kind === 'apartment' ? [t.floorNumber, v.floorNumber] : [t.floors, v.floors],
          [t.yearBuilt, v.yearBuilt],
          [t.condition, v.condition ? t.conditions[v.condition] : ''],
        ] as [string, string][])),
    [
      t.features,
      (
        ['garage', 'garden', 'terrace', 'elevator', 'furnished', 'waterConnected', 'powerConnected', 'roadAccess', 'buildable'] as (keyof Values)[]
      )
        .filter((k) => v[k] === true)
        .map((k) => t[k as keyof typeof t] as string)
        .join(' · '),
    ],
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
        <fieldset className="rounded border border-line bg-surface p-4 sm:p-8">
          <legend className="px-2 text-lg font-semibold">{t.sectionProperty}</legend>

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium">{t.kind}</span>
            <div className={`flex flex-wrap gap-2 rounded p-1${invalid('kind') ? ' ring-2 ring-[#c0392b]/40' : ''}`}>
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
                aria-invalid={invalid('areaM2') || undefined}
                className={`${inputCls} num${invalidCls('areaM2')}`}
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
                    aria-invalid={invalid('builtAreaM2') || undefined}
                    className={`${inputCls} num${invalidCls('builtAreaM2')}`}
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
                placeholder="150 000"
                aria-invalid={invalid('priceTnd') || undefined}
                className={`${inputCls} num${invalidCls('priceTnd')}`}
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

          {/* تفاصيل المسكن / الأرض */}
          <div className="mt-6 rounded border border-line bg-surface-2 p-5">
            <span className="block text-sm font-medium">{isLand ? t.detailsLand : t.detailsHouse}</span>
            <p className="mt-1 text-xs leading-6 text-muted">
              {isLand ? t.detailsLandHint : t.detailsHouseHint}
            </p>

            {!isLand && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <NumField label={t.bedrooms} name="bedrooms" value={v.bedrooms} onChange={(x) => set('bedrooms', x)} invalid={invalid('bedrooms')} />
                <NumField label={t.livingRooms} name="livingRooms" value={v.livingRooms} onChange={(x) => set('livingRooms', x)} invalid={invalid('livingRooms')} />
                <NumField label={t.bathrooms} name="bathrooms" value={v.bathrooms} onChange={(x) => set('bathrooms', x)} invalid={invalid('bathrooms')} />
                {v.kind === 'apartment' ? (
                  <NumField label={t.floorNumber} name="floorNumber" value={v.floorNumber} onChange={(x) => set('floorNumber', x)} invalid={invalid('floorNumber')} />
                ) : (
                  <NumField label={t.floors} name="floors" value={v.floors} onChange={(x) => set('floors', x)} invalid={invalid('floors')} />
                )}
                <NumField label={t.yearBuilt} name="yearBuilt" value={v.yearBuilt} onChange={(x) => set('yearBuilt', x)} invalid={invalid('yearBuilt')} placeholder="2015" />
                <Field label={t.condition}>
                  <select
                    name="condition"
                    value={v.condition}
                    onChange={(e) => set('condition', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {t.conditions[c]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {isLand && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <NumField label={t.frontageM} name="frontageM" value={v.frontageM} onChange={(x) => set('frontageM', x)} invalid={invalid('frontageM')} placeholder="12" />
              </div>
            )}

            <span className="mt-5 block text-xs font-medium text-muted">{t.features}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                (isLand
                  ? ['roadAccess', 'waterConnected', 'powerConnected', 'buildable']
                  : [
                      'garage',
                      'garden',
                      'terrace',
                      ...(v.kind === 'house' ? [] : ['elevator']),
                      'furnished',
                      'waterConnected',
                      'powerConnected',
                    ]) as (keyof Values)[]
              ).map((k) => {
                const on = v[k] === true
                return (
                  <label
                    key={k}
                    className={`cursor-pointer rounded border px-4 py-2 text-sm transition ${
                      on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={k}
                      checked={on}
                      onChange={(e) => set(k, e.target.checked as Values[typeof k])}
                      className="sr-only"
                    />
                    {t[k as keyof typeof t] as string}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="mt-6">
            <CoordsField t={t} inputCls={inputCls} invalid={invalid('lat')} />
            {invalid('lat') && <p className="mt-2 text-sm text-[#8c2f22]">{t.errors.lat}</p>}
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

          <PropertyMediaUpload t={t.media} />

          <p className="mt-5 rounded border border-line bg-surface-2 p-4 text-xs leading-6 text-muted">
            {t.mediaNote}
          </p>
        </fieldset>

        {/* معطيات المالك */}
        <fieldset className="rounded border border-line bg-surface p-4 sm:p-8">
          <legend className="px-2 text-lg font-semibold">{t.sectionOwner}</legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label={t.ownerName} error={err('ownerName')}>
              <input
                type="text"
                name="ownerName"
                value={v.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                aria-invalid={invalid('ownerName') || undefined}
                className={`${inputCls}${invalidCls('ownerName')}`}
              />
            </Field>
            <Field label={t.ownerPhone} error={err('ownerPhone')}>
              <input
                type="tel"
                name="ownerPhone"
                dir="ltr"
                value={v.ownerPhone}
                onChange={(e) => set('ownerPhone', e.target.value)}
                aria-invalid={invalid('ownerPhone') || undefined}
                className={`${inputCls}${invalidCls('ownerPhone')}`}
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
                  aria-invalid={invalid('ownerEmail') || undefined}
                  className={`${inputCls}${invalidCls('ownerEmail')}`}
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

          <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded border p-4 ${invalid('consent') ? 'border-[#c0392b] ring-2 ring-[#c0392b]/25' : 'border-line'}`}>
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
          className="flex min-h-12 w-full items-center justify-center rounded bg-brand px-8 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:self-start"
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
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setRecapOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded border border-line px-5 text-sm transition hover:border-line-strong active:scale-[0.99]"
            >
              {t.recapEdit}
            </button>
            <button
              type="button"
              onClick={confirmAndSubmit}
              disabled={pending || !v.consent}
              className="inline-flex min-h-11 items-center justify-center rounded bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-50"
            >
              {pending ? t.submitting : t.recapConfirm}
            </button>
          </div>
        </Modal>
      )}

      {/* نافذة الخطأ */}
      {errorOpen && state.error && (
        <Modal title={t.errorTitle} onClose={closeErrorAndJump} tone="error">
          <p className="text-sm leading-7">{t.errors[state.error] ?? t.errors.banner}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {fieldErrors.map((m) => (
                <li key={m.field}>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorOpen(false)
                      jumpTo(m.field)
                    }}
                    className="flex w-full items-start gap-2 rounded border border-[#e0b4ac] bg-[#fbeeeb] px-3 py-2 text-start text-[#8c2f22] hover:border-[#c0392b]"
                  >
                    <span aria-hidden="true">←</span>
                    <span>{m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-6 text-muted">
            {t.errorKept} {t.errorGoTo}
          </p>
          <div className="mt-5 flex flex-col sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeErrorAndJump}
              className="inline-flex min-h-11 items-center justify-center rounded bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-deep active:scale-[0.99]"
            >
              {t.errorClose}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function NumField({
  label,
  name,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        inputMode="numeric"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={`${inputCls} num${invalid ? ' border-[#c0392b] ring-2 ring-[#c0392b]/25' : ''}`}
      />
    </Field>
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
