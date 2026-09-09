'use client'

import VoiceRecorder from '@/components/VoiceRecorder'
import { Chip, Choice, Field, Group, Stepper } from '@/components/form-controls'
import type { Dictionary } from '@/lib/i18n'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { submitSupportRequest, type SupportRequestState } from '@/lib/actions/support'
import {
  BEST_TIMES,
  BUILDING_STATES,
  FOR_WHOM,
  HEAD_STATUSES,
  HOUSING_PROBLEMS,
  HOUSING_TENURE_OFFERED,
  INCOME_RANGES,
  INCOME_STABILITY,
  LAND_STATUSES,
  NEED_KINDS,
  SAVINGS_RANGES,
  SOCIAL_COVERAGE,
  STEPS_TAKEN,
  TRIGGERS,
  URGENCY_LEVELS,
  UTILITIES,
  YES_NO_UNKNOWN,
} from '@/lib/support-schema'
import { path, type Locale } from '@/lib/i18n'

type Delegation = { id: number; name_ar: string }

export type AskHelpStrings = Dictionary['soutien']['askHelp']

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] outline-none transition focus:border-brand'

type Values = Record<string, string | boolean>

/**
 * استمارة «اطلب مساندة».
 *
 * كانت ستّة أسئلة والفريق يقيّم ستّة معايير — أغلب ما يلزم للدراسة لم
 * يكن يُسأل. الآن الأقسام تتبع المعايير: الحاجة وسببها · الدار · العايلة ·
 * الدخل والتغطية · الجهد الذاتي · التثبّت. الحكاية والاستعجال والسكن
 * والدخل لازمة كما كانت؛ **كلّ الباقي اختياري**: من في ضائقة لا يُوقَف
 * على خانة، لكن من يملأ أكثر يُدرَس أحسن — ونقولها له.
 */
export default function SupportRequestForm({
  locale,
  govCode,
  delegations,
  t,
  voice,
}: {
  locale: Locale
  govCode: string
  delegations: Delegation[]
  t: AskHelpStrings
  voice: Dictionary['voice']
}) {
  const [state, action, pending] = useActionState(submitSupportRequest, {
    ok: false,
  } as SupportRequestState)
  const [v, setV] = useState<Values>({ urgency: 'urgent', forWhom: 'self' })
  const set = (k: string, val: string | boolean) => setV((s) => ({ ...s, [k]: val }))
  const list = (k: string) => String(v[k] ?? '').split(',').filter(Boolean)
  const toggle = (k: string, item: string) =>
    setV((s) => {
      const cur = String(s[k] ?? '').split(',').filter(Boolean)
      const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]
      return { ...s, [k]: next.join(',') }
    })

  if (state.ok) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface p-5 sm:p-8">
        <span className="brick mb-5 block" aria-hidden="true" />
        <h2 className="display text-2xl font-semibold">{t.okTitle}</h2>
        <p className="mt-3 leading-8 text-muted">{t.okBody}</p>

        {state.ref && (
          <div className="mt-6 rounded-lg border border-line bg-brand-soft p-5">
            <div className="text-sm text-muted">{t.okRefLabel}</div>
            <div className="num mt-1 text-3xl font-semibold text-brand" dir="ltr">
              {state.ref}
            </div>
          </div>
        )}

        <Link
          href={path(locale, '/suivi')}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-5 text-sm transition hover:border-line-strong active:scale-[0.99]"
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

  /** رقائق اختيار واحد مع حقل مخفيّ يحمل القيمة */
  const single = (name: string, items: readonly string[], labels: Record<string, string>, grid = false) => (
    <>
      <div className={grid ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
        {items.map((k) => (
          <Chip key={k} on={v[name] === k} onClick={() => set(name, v[name] === k ? '' : k)} block={grid}>
            {labels[k]}
          </Chip>
        ))}
      </div>
      <input type="hidden" name={name} value={String(v[name] ?? '')} />
    </>
  )

  /** اختيار متعدّد: حقل مخفيّ لكلّ قيمة مختارة — getAll في الخادم */
  const many = (name: string, items: readonly string[], labels: Record<string, string>, grid = false) => (
    <>
      <div className={grid ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
        {items.map((k) => (
          <Chip key={k} on={list(name).includes(k)} onClick={() => toggle(name, k)} block={grid} check>
            {labels[k]}
          </Chip>
        ))}
      </div>
      {list(name).map((k) => (
        <input key={k} type="hidden" name={name} value={k} />
      ))}
    </>
  )

  const yesNo = (name: string, label: string) => (
    <>
      <Chip on={Boolean(v[name])} onClick={() => set(name, !v[name])} check>
        {label}
      </Chip>
      <input type="hidden" name={name} value={v[name] ? 'on' : ''} />
    </>
  )

  const req = <span className="text-[#8c2f22]">*</span>
  const renting = v.housingCondition === 'renting'
  const forOther = v.forWhom === 'relative' || v.forWhom === 'neighbor'

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="govCode" value={govCode} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute opacity-0" aria-hidden="true" />

      {errorText && (
        <p className="mb-5 rounded-lg border border-[#e3c9c4] bg-[#fbf1ef] px-4 py-3 text-sm text-[#8c2f22]">
          {errorText}
        </p>
      )}

      {/* ---------- شكون يطلب ---------- */}
      <Group title={t.forWhom}>
        {single('forWhom', FOR_WHOM, t.forWhomLabels)}
        {forOther && (
          <div className="mt-3 sm:max-w-md">
            <Field label={t.beneficiaryName} hint={t.optional}>
              <input name="beneficiaryName" maxLength={120} className={inputCls} />
            </Field>
          </div>
        )}
      </Group>

      {/* ---------- الحاجة أوّلاً: هي سبب وجود الاستمارة ---------- */}
      <Group title={t.sectionNeed}>
        <span className="mb-1 block text-sm font-medium">
          {t.needText} {req}
        </span>
        <p className="mb-2 text-xs leading-6 text-faint">{t.needHint}</p>
        <textarea
          name="needText"
          rows={5}
          required
          minLength={15}
          maxLength={2000}
          placeholder={t.needPlaceholder}
          className={inputCls}
        />
        <VoiceRecorder name="voiceNeedText" t={voice} />

        <span className="mt-5 mb-1 block text-sm font-medium">{t.needKinds}</span>
        <p className="mb-2 text-xs text-muted">{t.needKindsHint}</p>
        {many('needKinds', NEED_KINDS, t.needKindLabels, true)}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">
              {t.urgency} {req}
            </span>
            {single('urgency', URGENCY_LEVELS, t.urgencyLabels)}
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.triggers}</span>
            {many('triggers', TRIGGERS, t.triggerLabels)}
          </div>
        </div>
      </Group>

      <p className="mt-6 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-xs leading-6 text-muted">
        {t.optionalNote}
      </p>

      {/* ---------- الدار اللي فيها توّا ---------- */}
      <Group title={t.sectionHome}>
        <span className="mb-2 block text-sm font-medium">
          {t.housingCondition} {req}
        </span>
        {single('housingCondition', HOUSING_TENURE_OFFERED, t.housingLabels, true)}

        {renting && (
          <div className="mt-3 sm:max-w-xs">
            <Field label={t.rentTnd}>
              <input name="rentTnd" inputMode="numeric" className={inputCls} />
            </Field>
          </div>
        )}

        <span className="mt-5 mb-2 block text-sm font-medium">{t.housingProblems}</span>
        {many('housingProblems', HOUSING_PROBLEMS, t.housingProblemLabels, true)}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label={t.roomsCount}>
            <Stepper name="roomsCount" min={0} max={20} value={v.roomsCount} onChange={(x) => set('roomsCount', x)} />
          </Field>
          <Field label={t.yearsThere}>
            <Stepper name="yearsThere" min={0} max={80} value={v.yearsThere} onChange={(x) => set('yearsThere', x)} />
          </Field>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.utilities}</span>
            {many('utilities', UTILITIES, t.utilityLabels)}
          </div>
        </div>

        <span className="mt-5 mb-2 block text-sm font-medium">{t.buildingState}</span>
        {single('buildingState', BUILDING_STATES, t.buildingStateLabels)}
      </Group>

      {/* ---------- العايلة ---------- */}
      <Group title={t.sectionFamily}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.householdSize}>
            <Stepper name="householdSize" min={1} max={30} value={v.householdSize} onChange={(x) => set('householdSize', x)} />
          </Field>
          <Field label={t.childrenCount}>
            <Stepper name="childrenCount" min={0} max={20} value={v.childrenCount} onChange={(x) => set('childrenCount', x)} />
          </Field>
          <Field label={t.elderlyCount}>
            <Stepper name="elderlyCount" min={0} max={10} value={v.elderlyCount} onChange={(x) => set('elderlyCount', x)} />
          </Field>
        </div>
        <input type="hidden" name="dependents" value={String(Number(v.childrenCount || 0) + Number(v.elderlyCount || 0))} />

        <span className="mt-5 mb-2 block text-sm font-medium">{t.headStatus}</span>
        {single('headStatus', HEAD_STATUSES, t.headStatusLabels)}

        <div className="mt-4 flex flex-wrap items-start gap-3">
          {yesNo('hasDisability', t.hasDisability)}
          {v.hasDisability && (
            <input name="disabilityNote" maxLength={200} placeholder={t.disabilityNote} className={`${inputCls} sm:max-w-sm`} />
          )}
        </div>
      </Group>

      {/* ---------- الدخل والتغطية ---------- */}
      <Group title={t.sectionIncome}>
        <span className="mb-2 block text-sm font-medium">
          {t.incomeStability} {req}
        </span>
        {single('incomeStability', INCOME_STABILITY, t.incomeLabels, true)}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">{t.incomeRange}</span>
            {single('incomeRange', INCOME_RANGES, t.incomeRangeLabels)}
          </div>
          <Field label={t.mainEarnerJob}>
            <input name="mainEarnerJob" maxLength={200} className={inputCls} />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">{t.socialCoverage}</span>
            {many('socialCoverage', SOCIAL_COVERAGE, t.socialCoverageLabels)}
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.existingAid}</span>
            {single('existingAid', YES_NO_UNKNOWN, t.yesNoLabels)}
          </div>
        </div>
      </Group>

      {/* ---------- الجهد الذاتي ---------- */}
      <Group title={t.sectionEffort}>
        <div className="flex flex-wrap gap-2">
          {yesNo('ownsLand', t.ownsLand)}
          {yesNo('hasMaterials', t.hasMaterials)}
          {yesNo('familyHelp', t.familyHelp)}
          {yesNo('canWork', t.canWork)}
        </div>

        {v.ownsLand && (
          <>
            <span className="mt-4 mb-2 block text-sm font-medium">{t.landStatus}</span>
            {single('landStatus', LAND_STATUSES, t.landStatusLabels)}
          </>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium">{t.savingsRange}</span>
            {single('savingsRange', SAVINGS_RANGES, t.savingsLabels)}
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.stepsTaken}</span>
            {many('stepsTaken', STEPS_TAKEN, t.stepsLabels)}
          </div>
        </div>
      </Group>

      {/* ---------- التثبّت ---------- */}
      <Group title={t.sectionVerify}>
        <div className="flex flex-wrap items-center gap-3">
          {yesNo('canVisit', t.canVisit)}
          <div>
            <span className="mb-1.5 block text-xs text-muted">{t.bestTime}</span>
            {single('bestTime', BEST_TIMES, t.bestTimeLabels)}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t.referenceNote}>
            <input name="referenceNote" maxLength={200} className={inputCls} />
          </Field>
          <Field label={t.addressNote}>
            <input name="addressNote" maxLength={200} className={inputCls} />
          </Field>
        </div>
      </Group>

      {/* ---------- كيفاش نلقاوك ---------- */}
      <Group title={t.sectionWho}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fullName} required>
            <input name="fullName" required maxLength={120} className={inputCls} />
          </Field>
          <Field label={t.phone} required>
            <input name="phone" required dir="ltr" className={`${inputCls} text-left`} />
          </Field>
          <Field label={t.altPhone} hint={t.optional}>
            <input name="altPhone" dir="ltr" maxLength={20} className={`${inputCls} text-left`} />
          </Field>
          <Field label={t.email} hint={t.optional}>
            <input type="email" name="email" dir="ltr" className={`${inputCls} text-left`} />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium">
              {t.delegation} {req}
            </span>
            <div className="flex flex-wrap gap-2">
              {delegations.map((d) => (
                <Chip key={d.id} on={v.delegationId === String(d.id)} onClick={() => set('delegationId', String(d.id))}>
                  {d.name_ar}
                </Chip>
              ))}
            </div>
            <input type="hidden" name="delegationId" value={String(v.delegationId ?? '')} required />
          </div>
        </div>
      </Group>

      <Choice
        name="consent"
        value="on"
        multi
        on={Boolean(v.consent)}
        onChange={() => set('consent', !v.consent)}
        title={t.consent}
      />

      <p className="mt-4 rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
        {t.noMoney}
      </p>

      <button
        type="submit"
        disabled={pending || !v.consent || !v.delegationId || !v.housingCondition || !v.incomeStability}
        className="mt-5 w-full rounded-lg bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  )
}
