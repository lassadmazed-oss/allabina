'use client'

import { useActionState, useMemo, useRef, useState } from 'react'
import Modal from '@/components/Modal'
import { joinNetwork, type NetworkState } from '@/lib/actions/network'
import { AVAILABILITIES, LEGAL_STATUSES, type CategoryRow, type FamilyRow, type SkillRow } from '@/lib/network'
import type { Locale } from '@/lib/i18n'

type Delegation = { id: number; name_ar: string }
type Zone = { id: number; name_ar: string }

export type NetworkStrings = {
  sectionIdentity: string
  sectionTrade: string
  sectionGeo: string
  sectionAvailability: string
  fullName: string
  companyName: string
  companyHint: string
  phone: string
  whatsapp: string
  email: string
  optional: string
  family: string
  category: string
  categoryPick: string
  extraCategories: string
  extraHint: string
  skills: string
  skillsHint: string
  skillsEmpty: string
  legalStatus: string
  legalHint: string
  legalLabels: Record<string, string>
  years: string
  bio: string
  bioPlaceholder: string
  governorate: string
  delegation: string
  zone: string
  address: string
  addressPlaceholder: string
  interventionZones: string
  interventionHint: string
  radius: string
  radiusHint: string
  availability: string
  availabilityLabels: Record<string, string>
  availableFrom: string
  consent: string
  submit: string
  submitting: string
  errBanner: string
  errRate: string
  errDuplicate: string
  errServer: string
  notApproved: string
  review: string
  recapTitle: string
  recapLede: string
  recapEdit: string
  recapConfirm: string
  notProvided: string
}

const field =
  'w-full rounded border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-brand'
const label = 'mb-1.5 block text-sm font-medium'

export default function IntervenantForm({
  locale,
  govCode,
  families,
  categories,
  skills,
  delegations,
  zones,
  t,
}: {
  locale: Locale
  govCode: string
  families: FamilyRow[]
  categories: CategoryRow[]
  skills: SkillRow[]
  delegations: Delegation[]
  zones: Zone[]
  t: NetworkStrings
}) {
  const [state, action, pending] = useActionState(joinNetwork, { ok: false } as NetworkState)

  const [family, setFamily] = useState(families[0]?.code ?? '')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [availability, setAvailability] = useState<string>('available')
  const formRef = useRef<HTMLFormElement>(null)
  const [recap, setRecap] = useState<[string, string][] | null>(null)

  /**
   * الملخّص يُقرأ من الاستمارة نفسها وقت الطلب — الحقول غير متحكَّم فيها،
   * فلا نكرّر حالتها. الأرقام تُترجم إلى أسماء من القوائم الممرَّرة.
   */
  const buildRecap = (): [string, string][] => {
    const fd = new FormData(formRef.current!)
    const v = (k: string) => String(fd.get(k) ?? '').trim()
    const many = (k: string) => fd.getAll(k).map(String)
    const byId = <T extends { id: number }>(rows: T[], id: string) => rows.find((r) => String(r.id) === id)
    const cat = byId(categories, v('categoryId'))
    const fam = families.find((f) => f.code === family)
    return [
      [t.fullName, v('fullName')],
      [t.companyName, v('companyName')],
      [t.phone, v('phone')],
      [t.whatsapp, v('whatsapp')],
      [t.email, v('email')],
      [t.family, fam ? name(fam) : ''],
      [t.category, cat ? name(cat) : ''],
      [t.legalStatus, t.legalLabels[v('legalStatus')] ?? v('legalStatus')],
      [t.years, v('yearsExperience')],
      [t.skills, many('skillIds').map((id) => byId(skills, id)).filter(Boolean).map((s) => name(s!)).join(' · ')],
      [t.extraCategories, many('extraCategoryIds').map((id) => byId(categories, id)).filter(Boolean).map((c) => name(c!)).join(' · ')],
      [t.bio, v('bio')],
      [t.delegation, byId(delegations, v('delegationId'))?.name_ar ?? ''],
      [t.zone, byId(zones, v('zoneId'))?.name_ar ?? ''],
      [t.address, v('address')],
      [t.interventionZones, many('zoneDelegationIds').map((id) => byId(delegations, id)?.name_ar).filter(Boolean).join(' · ')],
      [t.radius, v('radiusKm') ? `${v('radiusKm')} km` : ''],
      [t.availability, t.availabilityLabels[v('availability')] ?? v('availability')],
      [t.availableFrom, v('availableFrom')],
    ]
  }

  const name = (row: { name_ar: string; name_fr: string | null }) =>
    locale === 'fr' ? row.name_fr || row.name_ar : row.name_ar

  const familyCategories = useMemo(
    () => categories.filter((c) => c.family_code === family),
    [categories, family]
  )
  const categorySkills = useMemo(
    () => (categoryId === '' ? [] : skills.filter((s) => s.category_id === categoryId)),
    [skills, categoryId]
  )

  const bad = (f: string) => state.fields?.includes(f)
  const errorText =
    state.error === 'rateLimited'
      ? t.errRate
      : state.error === 'duplicate'
        ? t.errDuplicate
        : state.error === 'server'
          ? t.errServer
          : state.error === 'banner'
            ? t.errBanner
            : null

  return (
    <>
    <form
      ref={formRef}
      action={action}
      className="mt-8"
      onSubmit={(e) => {
        // الزرّ الظاهر يفتح الملخّص؛ الإرسال الفعلي من داخل النافذة فقط
        if (!(e.nativeEvent as SubmitEvent).submitter?.hasAttribute('data-confirm')) {
          e.preventDefault()
          if (formRef.current?.reportValidity()) setRecap(buildRecap())
        }
      }}
    >
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

      {/* ---- الهوية ---- */}
      <fieldset className="rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionIdentity}</legend>
        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.fullName}</span>
            <input name="fullName" required maxLength={120} className={field} />
            {bad('fullName') && <span className="mt-1 block text-sm text-[#8c2f22]">•</span>}
          </label>

          <label className="block">
            <span className={label}>
              {t.companyName} <span className="text-faint">({t.optional})</span>
            </span>
            <input name="companyName" maxLength={160} className={field} />
            <span className="mt-1 block text-xs text-faint">{t.companyHint}</span>
          </label>

          <label className="block">
            <span className={label}>{t.phone}</span>
            <input name="phone" required dir="ltr" className={`${field} text-left`} />
            {bad('phone') && <span className="mt-1 block text-sm text-[#8c2f22]">•</span>}
          </label>

          <label className="block">
            <span className={label}>
              {t.whatsapp} <span className="text-faint">({t.optional})</span>
            </span>
            <input name="whatsapp" dir="ltr" className={`${field} text-left`} />
          </label>

          <label className="block sm:col-span-2">
            <span className={label}>
              {t.email} <span className="text-faint">({t.optional})</span>
            </span>
            <input type="email" name="email" dir="ltr" className={`${field} text-left`} />
          </label>
        </div>
      </fieldset>

      {/* ---- الاختصاص ---- */}
      <fieldset className="mt-5 rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionTrade}</legend>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.family}</span>
            <select
              value={family}
              onChange={(e) => {
                setFamily(e.target.value)
                setCategoryId('')
              }}
              className={field}
            >
              {families.map((f) => (
                <option key={f.code} value={f.code}>
                  {name(f)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>{t.category}</span>
            <select
              name="categoryId"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              className={field}
            >
              <option value="">{t.categoryPick}</option>
              {familyCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {name(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>{t.legalStatus}</span>
            <select name="legalStatus" required defaultValue="independent" className={field}>
              {LEGAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.legalLabels[s]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-faint">{t.legalHint}</span>
          </label>

          <label className="block">
            <span className={label}>
              {t.years} <span className="text-faint">({t.optional})</span>
            </span>
            <input name="yearsExperience" inputMode="numeric" className={field} />
          </label>
        </div>

        {/* Savoir-faire */}
        <div className="mt-5">
          <span className={label}>{t.skills}</span>
          <p className="mb-3 text-xs leading-6 text-faint">{t.skillsHint}</p>
          {categorySkills.length === 0 ? (
            <p className="rounded border border-dashed border-line px-3 py-3 text-sm text-faint">
              {t.skillsEmpty}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categorySkills.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input type="checkbox" name="skillIds" value={s.id} className="size-4 accent-[#1d3a5f]" />
                  {name(s)}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* اختصاصات إضافية */}
        <div className="mt-5">
          <span className={label}>
            {t.extraCategories} <span className="text-faint">({t.optional})</span>
          </span>
          <p className="mb-3 text-xs leading-6 text-faint">{t.extraHint}</p>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.id !== categoryId)
              .map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input
                    type="checkbox"
                    name="extraCategoryIds"
                    value={c.id}
                    className="size-4 accent-[#1d3a5f]"
                  />
                  {name(c)}
                </label>
              ))}
          </div>
        </div>

        <label className="mt-5 block">
          <span className={label}>
            {t.bio} <span className="text-faint">({t.optional})</span>
          </span>
          <textarea
            name="bio"
            rows={3}
            maxLength={1500}
            placeholder={t.bioPlaceholder}
            className={field}
          />
        </label>
      </fieldset>

      {/* ---- الجغرافيا ---- */}
      <fieldset className="mt-5 rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionGeo}</legend>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.delegation}</span>
            <select name="delegationId" className={field} defaultValue="">
              <option value="">—</option>
              {delegations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={label}>
              {t.zone} <span className="text-faint">({t.optional})</span>
            </span>
            <select name="zoneId" className={field} defaultValue="">
              <option value="">—</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name_ar}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className={label}>
              {t.address} <span className="text-faint">({t.optional})</span>
            </span>
            <input
              name="address"
              maxLength={200}
              placeholder={t.addressPlaceholder}
              className={field}
            />
          </label>
        </div>

        <div className="mt-5">
          <span className={label}>{t.interventionZones}</span>
          <p className="mb-3 text-xs leading-6 text-faint">{t.interventionHint}</p>
          <div className="flex flex-wrap gap-2">
            {delegations.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft"
              >
                <input
                  type="checkbox"
                  name="zoneDelegationIds"
                  value={d.id}
                  className="size-4 accent-[#1d3a5f]"
                />
                {d.name_ar}
              </label>
            ))}
          </div>
        </div>

        <label className="mt-5 block sm:w-1/2">
          <span className={label}>
            {t.radius} <span className="text-faint">({t.optional})</span>
          </span>
          <input name="radiusKm" inputMode="numeric" className={field} />
          <span className="mt-1 block text-xs text-faint">{t.radiusHint}</span>
        </label>
      </fieldset>

      {/* ---- التوفّر ---- */}
      <fieldset className="mt-5 rounded border border-line bg-surface p-5">
        <legend className="px-2 text-sm font-semibold">{t.sectionAvailability}</legend>
        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={label}>{t.availability}</span>
            <select
              name="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className={field}
            >
              {AVAILABILITIES.map((a) => (
                <option key={a} value={a}>
                  {t.availabilityLabels[a]}
                </option>
              ))}
            </select>
          </label>

          {availability === 'available_from' && (
            <label className="block">
              <span className={label}>{t.availableFrom}</span>
              <input type="date" name="availableFrom" className={field} />
            </label>
          )}
        </div>
      </fieldset>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded border border-line bg-surface p-4">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[#1d3a5f]" />
        <span className="text-sm leading-7">{t.consent}</span>
      </label>

      <p className="mt-4 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
        {t.notApproved}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded bg-brand px-6 py-3.5 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.submitting : t.review}
      </button>
      <button type="submit" data-confirm hidden aria-hidden="true" tabIndex={-1} />
    </form>

    {recap && (
      <Modal title={t.recapTitle} onClose={() => setRecap(null)}>
        <p className="text-sm leading-7 text-muted">{t.recapLede}</p>
        <dl className="mt-4 divide-y divide-line rounded border border-line">
          {recap.map(([k, val]) => (
            <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className={`max-w-[60%] text-end ${val ? '' : 'text-faint'}`} dir="auto">
                {val || t.notProvided}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => setRecap(null)}
            className="inline-flex min-h-11 items-center justify-center rounded border border-line px-5 text-sm transition hover:border-line-strong active:scale-[0.99]"
          >
            {t.recapEdit}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setRecap(null)
              formRef.current?.requestSubmit(
                formRef.current.querySelector<HTMLButtonElement>('button[data-confirm]') ?? undefined
              )
            }}
            className="inline-flex min-h-11 items-center justify-center rounded bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? t.submitting : t.recapConfirm}
          </button>
        </div>
      </Modal>
    )}
    </>
  )
}
