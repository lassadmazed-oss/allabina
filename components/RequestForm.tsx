'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { submitRequest, type SubmitState } from '@/lib/actions/request'
import { updateOwnRequest, type EditState } from '@/lib/actions/request-edit'
import ZoneInput, { type Zone } from '@/components/ZoneInput'
import {
  REQUEST_TYPES,
  EMPLOYMENT_TYPES,
  HORIZONS,
  TITLE_STATUSES,
  URGENCIES,
  FLEXIBILITIES,
  LEVELS,
  PROBLEM_KINDS,
  FINANCING_STATES,
} from '@/lib/schema'
import { HOUSING_CONDITIONS, INCOME_STABILITY } from '@/lib/support-schema'
import { CLIENT_DOC_CODES } from '@/lib/documents'
import { computeCapacity, formatTND, type FinanceSettings } from '@/lib/finance'
import { buildCostRange, tierByKey, type TierPrice } from '@/lib/pricing'
import { fmt, type Dictionary, type Locale } from '@/lib/i18n'
import { areaLabel, currencyLabel, formatRange, perM2Label } from '@/lib/format'

type Gov = { code: string; name_ar: string; is_active: boolean }
type Deleg = { id: number; gov_code: string; name_ar: string }
type Imada = { id: number; delegation_id: number; name_ar: string }

const STORAGE_KEY = 'allabina.demande.v2'
const initial: SubmitState = { ok: false }
const AREAS = [60, 80, 100, 120]

/** أيّ خطوة يقع فيها كلّ حقل — يستعملها الرجوع التلقائي عند الخطأ */
const FIELD_STEP: Record<string, number> = {
  requestType: 1,
  govCode: 2,
  delegationId: 2,
  imadaId: 2,
  landLocation: 2,
  desiredAreaM2: 2,
  bedrooms: 2,
  horizon: 2,
  standing: 2,
  landAreaM2: 3,
  titleStatus: 3,
  hasWater: 3,
  hasPower: 3,
  hasRoad: 3,
  hasPermit: 3,
  levels: 2,
  bathrooms: 2,
  livingRooms: 2,
  kitchens: 2,
  householdSize: 4,
  dependents: 4,
  housingCondition: 4,
  incomeStability: 4,
  problemType: 4,
  financingState: 4,
  monthlyIncome: 5,
  spouseIncome: 5,
  otherIncome: 5,
  existingLoans: 5,
  downPayment: 5,
  maxMonthly: 5,
  employment: 5,
  seniorityYears: 5,
  isExpat: 5,
  expatCountry: 5,
  fullName: 6,
  phone: 6,
  email: 6,
  consent: 6,
}

/** اسم كلّ حقل كما يراه الحريف — يُستعمل في لافتة الخطأ */
function fieldLabels(t: Dictionary['form']): Record<string, string> {
  return {
    requestType: t.s1Title,
    govCode: t.governorate,
    horizon: t.horizon,
    desiredAreaM2: t.area,
    bedrooms: t.bedrooms,
    standing: t.standingTitle,
    landAreaM2: t.landArea,
    titleStatus: t.titleStatus,
    monthlyIncome: t.income,
    spouseIncome: t.spouseIncome,
    otherIncome: t.otherIncome,
    existingLoans: t.existingLoans,
    downPayment: t.downPayment,
    maxMonthly: t.maxMonthly,
    employment: t.employment,
    seniorityYears: t.seniority,
    expatCountry: t.expatCountry,
    levels: t.levels,
    bathrooms: t.bathrooms,
    livingRooms: t.livingRooms,
    kitchens: t.kitchens,
    householdSize: t.householdSize,
    dependents: t.dependents,
    housingCondition: t.housingCondition,
    incomeStability: t.incomeStability,
    problemType: t.problemType,
    financingState: t.financingState,
    fullName: t.fullName,
    phone: t.phone,
    email: t.email,
    // قصّ جملة الموافقة الطويلة يعطي «…وتست…» في لائحة الأخطاء — نسمّيها باسمها
    consent: t.consentShort,
  }
}

export default function RequestForm({
  locale,
  t,
  labels,
  governorates,
  delegations,
  imadas,
  zones,
  assumptions,
  bankTermsNote,
  tiers,
  initialType = '',
  mode = 'create',
  initialValues,
}: {
  locale: Locale
  t: Dictionary['form']
  labels: Dictionary['labels']
  governorates: Gov[]
  delegations: Deleg[]
  imadas: Imada[]
  zones: Zone[]
  assumptions: FinanceSettings
  bankTermsNote: string
  tiers: TierPrice[]
  initialType?: string
  /** 'edit' = صاحب المطلب يصلّح مطلباً موجوداً، لا يبعث واحداً جديداً */
  mode?: 'create' | 'edit'
  /** القيم المسجّلة — مطلوبة في وضع التعديل */
  initialValues?: Record<string, string | boolean>
}) {
  const isEdit = mode === 'edit'
  const [state, formAction, pending] = useActionState<SubmitState | EditState, FormData>(
    isEdit ? updateOwnRequest : submitRequest,
    initial
  )
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<Record<string, string | boolean>>(
    isEdit && initialValues
      ? initialValues
      : {
          requestType: initialType,
          govCode: 'SFX',
          horizon: '',
          employment: '',
        }
  )

  // مسوّدة المطلب الجديد لا تُقرأ ولا تُكتب وقت التعديل: كانت تدفن
  // معطيات الملفّ الحقيقية تحت مسوّدة قديمة تركها صاحبها في المتصفّح.
  useEffect(() => {
    if (isEdit) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setValues((v) => ({
          ...JSON.parse(saved),
          ...(v.requestType ? { requestType: v.requestType } : {}),
        }))
      }
    } catch {}
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {}
  }, [values, isEdit])

  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }))
  const num = (k: string) => Number(values[k] || 0)
  const perM2 = perM2Label(locale)
  const m2 = areaLabel(locale)

  const flexibility = String(values.flexibility ?? '')
    .split(',')
    .filter(Boolean)

  const docs = String(values.documents ?? '')
    .split(',')
    .filter(Boolean)

  const toggleDoc = (code: string) =>
    setValues((v) => {
      const cur = String(v.documents ?? '').split(',').filter(Boolean)
      const next = cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]
      return { ...v, documents: next.join(',') }
    })

  /**
   * التبديل يقرأ الحالة السابقة لا اللقطة المرسومة: نقرتان متتاليتان قبل
   * إعادة الرسم كانتا تُلغي إحداهما الأخرى.
   */
  const toggleFlexibility = (f: string) =>
    setValues((s) => {
      const current = String(s.flexibility ?? '').split(',').filter(Boolean)
      const next = current.includes(f) ? current.filter((x) => x !== f) : [...current, f]
      return { ...s, flexibility: next.join(',') }
    })

  const isBuild = values.requestType === 'build_on_land'
  const needsStanding = isBuild || values.requestType === 'land_and_house'
  /** من يبني أو يرمّم يعرف كم غرفة وكم طابق؛ من يشري شقّة جاهزة لا */
  const needsSpecs =
    isBuild ||
    values.requestType === 'land_and_house' ||
    values.requestType === 'renovation'
  const selectedTier = tierByKey(tiers, String(values.standing ?? ''))
  const areaForCost = Number(values.desiredAreaM2 || 0)
  const costRange =
    selectedTier && areaForCost > 0 ? buildCostRange(areaForCost, selectedTier) : null
  const delegationImadas = imadas.filter(
    (i) => String(i.delegation_id) === String(values.delegationId ?? '')
  )

  const steps = useMemo(
    () => (isBuild ? t.stepNames : t.stepNames.filter((_, i) => i !== 2)),
    [isBuild, t.stepNames]
  )
  const order = isBuild ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6]
  const stepIndex = order.indexOf(step)

  const capacity = computeCapacity({
    monthlyIncome: num('monthlyIncome'),
    spouseIncome: num('spouseIncome'),
    otherIncome: num('otherIncome'),
    existingLoans: num('existingLoans'),
    downPayment: num('downPayment'),
    settings: assumptions,
  })

  const canNext = () => {
    if (step === 1) return Boolean(values.requestType)
    if (step === 2) return Boolean(values.govCode && values.horizon)
    // من صرّح أنّ فلوسه حاضرة يُسأل عن الميزانية المتوفّرة لا عن الدخل
    if (step === 5)
      return values.cashReady
        ? num('downPayment') > 0 && Boolean(values.employment)
        : num('monthlyIncome') > 0 && Boolean(values.employment)
    return true
  }

  const go = (dir: 1 | -1) => {
    const next = order[stepIndex + dir]
    if (next) setStep(next)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const err = (k: string) =>
    state.fields?.includes(k)
      ? t.errors[k === 'consent' ? 'consentRequired' : k] ?? t.errors.fallback
      : undefined

  const fieldNames = fieldLabels(t)

  /** أسماء الحقول الخاطئة كما يقرأها الحريف */
  const badFields = (state.fields ?? []).map((f) => fieldNames[f] ?? f)

  // عند فشل التحقّق: نرجّعو الحريف للخطوة اللي فيها المشكل ونحطّو المؤشّر في الحقل
  useEffect(() => {
    if (!state.fields?.length) return
    const first = [...state.fields].sort(
      (a, b) => (FIELD_STEP[a] ?? 6) - (FIELD_STEP[b] ?? 6)
    )[0]
    const target = FIELD_STEP[first] ?? 6
    if (order.includes(target)) setStep(target)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // نستنّى الخطوة تتعرض قبل ما نحطّو المؤشّر
      const timer = window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[name="${first}"]`)
        el?.focus({ preventScroll: false })
      }, 250)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form
      action={formAction}
      noValidate
      /**
       * Enter داخل أيّ حقل يُرسل الاستمارة كاملةً — ولو كنّا في الخطوة الأولى.
       * فيرجع الحريف بأخطاء حقول ما وصلهاش بعد. هنا Enter = «التالي».
       * TEXTAREA مستثنى (Enter سطر جديد)، وآخر خطوة يبقى فيها الإرسال مقصوداً.
       */
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.shiftKey) return
        const el = e.target as HTMLElement
        if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return
        if (stepIndex === order.length - 1) return
        e.preventDefault()
        if (canNext()) go(1)
      }}
      className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-10"
    >
      <input type="hidden" name="locale" value={locale} />

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-brand">
            {fmt(t.stepOf, { i: stepIndex + 1, n: steps.length })}
          </span>
          <span className="text-faint">{steps[stepIndex]}</span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-brand' : 'bg-line'}`}
            />
          ))}
        </div>
      </div>

      {state.error && (
        <div
          role="alert"
          className="mb-6 rounded border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm leading-7 text-[#8c2f22]"
        >
          {t.errors[state.error] ?? t.genericError}
          {badFields.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              {badFields.map((f) => (
                <li key={f} className="rounded bg-[#f4dcd6] px-2 py-0.5 text-xs font-medium">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 1 */}
      <fieldset className={step === 1 ? 'block' : 'hidden'}>
        <legend className="display mb-2 text-2xl font-semibold">{t.s1Title}</legend>
        <p className="mb-6 text-muted">{t.s1Lede}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {REQUEST_TYPES.map((rt) => (
            <label
              key={rt}
              className={`cursor-pointer rounded border p-5 transition ${
                values.requestType === rt
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="requestType"
                value={rt}
                checked={values.requestType === rt}
                onChange={(e) =>
                  setValues((v) => ({ ...v, requestType: e.target.value, cashReady: false }))
                }
                className="sr-only"
              />
              <span className="brick mb-3 block" aria-hidden="true" />
              <span className="block font-semibold">{labels.requestType[rt]}</span>
            </label>
          ))}
        </div>

        {/* مسار بلا بنك: من عنده التمويل حاضر لا يحتاج دراسة قدرة على
            الاقتراض، يحتاج مقاولاً وعرضاً. اختياره يضبط نوع المطلب
            «بناء فوق أرض» ويرفع الأسئلة البنكية من طريقه. */}
        <label
          className={`mt-3 flex cursor-pointer items-start gap-3 rounded border p-5 transition ${
            values.cashReady
              ? 'border-gold bg-gold-soft'
              : 'border-line bg-surface hover:border-line-strong'
          }`}
        >
          <input
            type="checkbox"
            name="cashReady"
            checked={Boolean(values.cashReady)}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                cashReady: e.target.checked,
                ...(e.target.checked
                  ? { requestType: 'build_on_land', financingState: 'self_funded' }
                  : { financingState: '' }),
              }))
            }
            className="mt-1 size-4 accent-[#a8781f]"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t.cashReadyTitle}</span>
              <span className="rounded bg-gold px-2 py-0.5 text-xs font-medium text-white">
                {t.cashReadyBadge}
              </span>
            </span>
            <span className="mt-1 block text-sm leading-7 text-muted">{t.cashReadyBody}</span>
          </span>
        </label>

        {err('requestType') && (
          <p className="mt-3 text-sm text-[#8c2f22]">{err('requestType')}</p>
        )}
      </fieldset>

      {/* 2 */}
      <fieldset className={step === 2 ? 'block' : 'hidden'}>
        <legend className="display mb-2 text-2xl font-semibold">{t.s2Title}</legend>
        <p className="mb-6 text-muted">{t.s2Lede}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.governorate} error={err('govCode')}>
            <select
              name="govCode"
              value={String(values.govCode ?? '')}
              onChange={(e) => set('govCode', e.target.value)}
              className={inputCls}
            >
              {governorates.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name_ar}
                  {g.is_active ? '' : ` ${t.comingSoon}`}
                </option>
              ))}
            </select>
          </Field>

          {values.govCode === 'SFX' && (
            <Field label={t.delegation} hint={t.optional}>
              <select
                name="delegationId"
                value={String(values.delegationId ?? '')}
                onChange={(e) => set('delegationId', e.target.value)}
                className={inputCls}
              >
                <option value="">{t.choose}</option>
                {delegations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_ar}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {delegationImadas.length > 0 && (
            <Field label={t.imada} hint={t.optional}>
              <select
                name="imadaId"
                value={String(values.imadaId ?? '')}
                onChange={(e) => set('imadaId', e.target.value)}
                className={inputCls}
              >
                <option value="">{t.choose}</option>
                {delegationImadas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name_ar}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="sm:col-span-2">
            <Field label={t.landLocation} hint={t.landLocationHint}>
              <ZoneInput
                name="landLocation"
                zones={zones}
                govCode={String(values.govCode ?? 'SFX')}
                delegationId={String(values.delegationId ?? '')}
                locale={locale}
                value={String(values.landLocation ?? '')}
                onChange={(v) => set('landLocation', v)}
                className={inputCls}
                placeholder={t.landLocationPlaceholder}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6">
          <span className="mb-2 block text-sm font-medium">{t.area}</span>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set('desiredAreaM2', String(a))}
                className={`rounded border px-5 py-2.5 text-sm transition ${
                  String(values.desiredAreaM2) === String(a)
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                {a} {m2}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              name="desiredAreaM2"
              placeholder={t.otherArea}
              value={String(values.desiredAreaM2 ?? '')}
              onChange={(e) => set('desiredAreaM2', e.target.value)}
              className={`${inputCls} w-36`}
            />
          </div>
          {err('desiredAreaM2') && (
            <p className="mt-2 text-sm text-[#8c2f22]">{err('desiredAreaM2')}</p>
          )}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label={t.bedrooms} hint={t.optional} error={err('bedrooms')}>
            <input
              type="number"
              inputMode="numeric"
              name="bedrooms"
              min={1}
              max={6}
              value={String(values.bedrooms ?? '')}
              onChange={(e) => set('bedrooms', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.horizon} error={err('horizon')}>
            <select
              name="horizon"
              value={String(values.horizon ?? '')}
              onChange={(e) => set('horizon', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {labels.horizon[h]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {needsStanding && (
          <div className="mt-8">
            <span className="mb-1 block text-sm font-medium">{t.standingTitle}</span>
            <p className="mb-3 text-sm text-muted">{t.standingLede}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((tier) => (
                <label
                  key={tier.tier}
                  className={`cursor-pointer rounded border p-4 transition ${
                    values.standing === tier.tier
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="standing"
                    value={tier.tier}
                    checked={values.standing === tier.tier}
                    onChange={(e) => set('standing', e.target.value)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{tier.label}</span>
                  <span className="num mt-1 block text-sm text-brand">
                    <bdi dir="ltr">{formatRange(tier.min, tier.max)}</bdi> {perM2}
                  </span>
                  <span className="mt-2 block text-xs leading-6 text-muted">
                    {tier.description}
                  </span>
                </label>
              ))}
            </div>

            {costRange && selectedTier && (
              <div className="mt-4 rounded border border-line bg-surface-2 p-4 text-sm">
                {fmt(t.costFor, { area: areaForCost, tier: selectedTier.label })}{' '}
                <span className="num font-semibold text-brand">
                  <bdi dir="ltr">{formatRange(costRange.min, costRange.max)}</bdi>{' '}
                  {currencyLabel(locale)}
                </span>
                <div className="mt-1 text-xs text-faint">{t.costNote}</div>
              </div>
            )}
          </div>
        )}

        {/* درجة الاستعجال */}
        <div className="mt-8">
          <span className="mb-1 block text-sm font-medium">{t.urgencyTitle}</span>
          <p className="mb-3 text-sm text-muted">{t.urgencyLede}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {URGENCIES.map((u) => (
              <label
                key={u}
                className={`cursor-pointer rounded border px-4 py-3 text-sm transition ${
                  values.urgency === u
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  value={u}
                  checked={values.urgency === u}
                  onChange={(e) => set('urgency', e.target.value)}
                  className="sr-only"
                />
                {labels.urgency[u]}
              </label>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs text-muted">{t.urgencyNote}</span>
            <input
              type="text"
              name="urgencyNote"
              value={String(values.urgencyNote ?? '')}
              onChange={(e) => set('urgencyNote', e.target.value)}
              className={inputCls}
              placeholder={t.urgencyNotePlaceholder}
            />
          </label>
        </div>

        {/* المرونة */}
        <div className="mt-8">
          <span className="mb-1 block text-sm font-medium">{t.flexTitle}</span>
          <p className="mb-3 text-sm text-muted">{t.flexLede}</p>
          <div className="flex flex-wrap gap-2">
            {FLEXIBILITIES.map((f) => {
              const on = flexibility.includes(f)
              return (
                <label
                  key={f}
                  className={`cursor-pointer rounded border px-4 py-2 text-sm transition ${
                    on
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="flexibility"
                    value={f}
                    checked={on}
                    onChange={() => toggleFlexibility(f)}
                    className="sr-only"
                  />
                  {labels.flexibility[f]}
                </label>
              )
            })}
          </div>
        </div>

        {/* حكاية المشكل */}
        <div className="mt-8">
          <span className="mb-1 block text-sm font-medium">{t.problemTitle}</span>
          <p className="mb-3 text-sm text-muted">{t.problemLede}</p>
          <textarea
            name="problemNote"
            rows={4}
            value={String(values.problemNote ?? '')}
            onChange={(e) => set('problemNote', e.target.value)}
            className={inputCls}
            placeholder={t.problemPlaceholder}
          />
        </div>

        {/* مواصفات الدار — كانت تُعمَّر في اللوحة بعد مكالمة. صاحبها
            يعرفها، وهي مدخل العرض التقديري. */}
        {needsSpecs && (
          <div className="mt-8 rounded border border-line bg-surface p-4 sm:p-5">
            <span className="mb-1 block text-sm font-medium">{t.specsTitle}</span>
            <p className="mb-4 text-sm leading-7 text-muted">{t.specsLede}</p>

            <Field label={t.levels}>
              <div className="grid gap-2 sm:grid-cols-2">
                {LEVELS.map((lv) => (
                  <label
                    key={lv}
                    className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded border px-3 text-sm transition ${
                      String(values.levels ?? '') === String(lv)
                        ? 'border-brand bg-brand-soft'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="radio"
                      name="levels"
                      value={lv}
                      checked={String(values.levels ?? '') === String(lv)}
                      onChange={() => set('levels', String(lv))}
                      className="size-4 accent-[#1d3a5f]"
                    />
                    {t.levelLabels[lv]}
                  </label>
                ))}
              </div>
            </Field>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label={t.bathrooms} hint={t.optional} error={err('bathrooms')}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="bathrooms"
                  min={1}
                  max={6}
                  value={String(values.bathrooms ?? '')}
                  onChange={(e) => set('bathrooms', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t.livingRooms} hint={t.optional} error={err('livingRooms')}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="livingRooms"
                  min={1}
                  max={4}
                  value={String(values.livingRooms ?? '')}
                  onChange={(e) => set('livingRooms', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t.kitchens} hint={t.optional} error={err('kitchens')}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="kitchens"
                  min={1}
                  max={3}
                  value={String(values.kitchens ?? '')}
                  onChange={(e) => set('kitchens', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="mt-5">
              <span className="mb-2 block text-sm font-medium">{t.extrasTitle}</span>
              <div className="flex flex-wrap gap-2">
                {(['garage', 'terrasse', 'jardin'] as const).map((k) => (
                  <label
                    key={k}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-4 text-sm transition ${
                      values[k]
                        ? 'border-brand bg-brand-soft'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={k}
                      checked={Boolean(values[k])}
                      onChange={(e) => set(k, e.target.checked)}
                      className="size-4 accent-[#1d3a5f]"
                    />
                    {t[k]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {/* 3 */}
      {isBuild && (
        <fieldset className={step === 3 ? 'block' : 'hidden'}>
          <legend className="display mb-2 text-2xl font-semibold">{t.s3Title}</legend>
          <p className="mb-6 text-muted">{t.s3Lede}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.landArea} error={err('landAreaM2')}>
              <input
                type="number"
                inputMode="numeric"
                name="landAreaM2"
                value={String(values.landAreaM2 ?? '')}
                onChange={(e) => set('landAreaM2', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={t.titleStatus}>
              <select
                name="titleStatus"
                value={String(values.titleStatus ?? '')}
                onChange={(e) => set('titleStatus', e.target.value)}
                className={inputCls}
              >
                <option value="">{t.choose}</option>
                {TITLE_STATUSES.map((ts) => (
                  <option key={ts} value={ts}>
                    {labels.titleStatus[ts]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['hasWater', t.hasWater],
                ['hasPower', t.hasPower],
                ['hasRoad', t.hasRoad],
                ['hasPermit', t.hasPermit],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-3 rounded border border-line bg-surface p-4"
              >
                <input
                  type="checkbox"
                  name={k}
                  checked={Boolean(values[k])}
                  onChange={(e) => set(k, e.target.checked)}
                  className="size-4 accent-[#1d3a5f]"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* 4 — عائلتك ووضعك: كان المستشار يسألها في مكالمة ويكتبها في
          «المسار الاجتماعي». صاحبها يعرفها أحسن، ويكتبها مرّة واحدة. */}
      <fieldset className={step === 4 ? 'block' : 'hidden'}>
        <legend className="display mb-2 text-2xl font-semibold">{t.s6Title}</legend>
        <p className="mb-6 leading-8 text-muted">{t.s6Lede}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.householdSize} hint={t.optional} error={err('householdSize')}>
            <input
              type="number"
              inputMode="numeric"
              name="householdSize"
              min={1}
              max={30}
              value={String(values.householdSize ?? '')}
              onChange={(e) => set('householdSize', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.dependents} hint={t.optional} error={err('dependents')}>
            <input
              type="number"
              inputMode="numeric"
              name="dependents"
              min={0}
              max={25}
              value={String(values.dependents ?? '')}
              onChange={(e) => set('dependents', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.housingCondition} hint={t.optional} error={err('housingCondition')}>
            <select
              name="housingCondition"
              value={String(values.housingCondition ?? '')}
              onChange={(e) => set('housingCondition', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {HOUSING_CONDITIONS.map((k) => (
                <option key={k} value={k}>
                  {t.housingLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.incomeStability} hint={t.optional} error={err('incomeStability')}>
            <select
              name="incomeStability"
              value={String(values.incomeStability ?? '')}
              onChange={(e) => set('incomeStability', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {INCOME_STABILITY.map((k) => (
                <option key={k} value={k}>
                  {t.incomeLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.problemType} hint={t.optional} error={err('problemType')}>
            <select
              name="problemType"
              value={String(values.problemType ?? '')}
              onChange={(e) => set('problemType', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {PROBLEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.problemLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          {!values.cashReady && (
          <Field label={t.financingState} hint={t.optional} error={err('financingState')}>
            <select
              name="financingState"
              value={String(values.financingState ?? '')}
              onChange={(e) => set('financingState', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {FINANCING_STATES.map((k) => (
                <option key={k} value={k}>
                  {t.financingLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          )}
        </div>

        {/* الكراء: أوضح دليل على القدرة الشهرية — يدفعه فعلاً كلّ شهر */}
        <div className="mt-6 rounded border border-line bg-surface p-4 sm:p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="isRenting"
              checked={Boolean(values.isRenting)}
              onChange={(e) => set('isRenting', e.target.checked)}
              className="mt-1 size-4 accent-[#1d3a5f]"
            />
            <span className="text-sm leading-7 font-medium">{t.isRenting}</span>
          </label>

          {values.isRenting && (
            <div className="mt-4">
              <Field label={t.rentTnd} hint={t.rentHint} error={err('rentTnd')}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="rentTnd"
                  min={0}
                  max={20000}
                  value={String(values.rentTnd ?? '')}
                  onChange={(e) => set('rentTnd', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <p className="mt-2 text-xs leading-6 text-faint">{t.rentWhy}</p>
            </div>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="hasDisability"
            checked={Boolean(values.hasDisability)}
            onChange={(e) => set('hasDisability', e.target.checked)}
            className="mt-1 size-4 accent-[#1d3a5f]"
          />
          <span className="text-sm leading-7">{t.hasDisability}</span>
        </label>
      </fieldset>

      {/* 5 — القدرة المالية */}
      <fieldset className={step === 5 ? 'block' : 'hidden'}>
        <legend className="display mb-2 text-2xl font-semibold">{t.s4Title}</legend>
        <p className="mb-6 text-muted">{t.s4Lede}</p>
        {values.cashReady && (
          <p className="mb-6 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
            {t.cashReadyNote}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.income} error={err('monthlyIncome')}>
            <input
              type="number"
              inputMode="numeric"
              name="monthlyIncome"
              value={String(values.monthlyIncome ?? '')}
              onChange={(e) => set('monthlyIncome', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.spouseIncome} hint={t.optional}>
            <input
              type="number"
              inputMode="numeric"
              name="spouseIncome"
              value={String(values.spouseIncome ?? '')}
              onChange={(e) => set('spouseIncome', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.otherIncome} hint={t.optional}>
            <input
              type="number"
              inputMode="numeric"
              name="otherIncome"
              value={String(values.otherIncome ?? '')}
              onChange={(e) => set('otherIncome', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.existingLoans} hint={t.existingLoansHint}>
            <input
              type="number"
              inputMode="numeric"
              name="existingLoans"
              value={String(values.existingLoans ?? '')}
              onChange={(e) => set('existingLoans', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={values.cashReady ? t.budgetReady : t.downPayment}>
            <input
              type="number"
              inputMode="numeric"
              name="downPayment"
              value={String(values.downPayment ?? '')}
              onChange={(e) => set('downPayment', e.target.value)}
              className={inputCls}
            />
          </Field>
          {!values.cashReady && (
          <Field label={t.maxMonthly} hint={t.optional}>
            <input
              type="number"
              inputMode="numeric"
              name="maxMonthly"
              value={String(values.maxMonthly ?? '')}
              onChange={(e) => set('maxMonthly', e.target.value)}
              className={inputCls}
            />
          </Field>
          )}
          <Field label={t.employment} error={err('employment')}>
            <select
              name="employment"
              value={String(values.employment ?? '')}
              onChange={(e) => set('employment', e.target.value)}
              className={inputCls}
            >
              <option value="">{t.choose}</option>
              {EMPLOYMENT_TYPES.map((emp) => (
                <option key={emp} value={emp}>
                  {labels.employment[emp]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.seniority} hint={t.optional}>
            <input
              type="number"
              inputMode="numeric"
              name="seniorityYears"
              max={50}
              value={String(values.seniorityYears ?? '')}
              onChange={(e) => set('seniorityYears', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="isExpat"
            checked={Boolean(values.isExpat)}
            onChange={(e) => set('isExpat', e.target.checked)}
            className="size-4 accent-[#1d3a5f]"
          />
          <span className="text-sm">{t.isExpat}</span>
        </label>
        {values.isExpat && (
          <div className="mt-4">
            <Field label={t.expatCountry}>
              <input
                type="text"
                name="expatCountry"
                value={String(values.expatCountry ?? '')}
                onChange={(e) => set('expatCountry', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {num('monthlyIncome') > 0 && (
          <div className="mt-6 rounded border border-line bg-brand-soft p-5">
            <div className="text-sm font-medium text-brand">{t.estimateTitle}</div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Stat label={t.maxPayment} value={formatTND(capacity.maxPayment, locale)} />
              <Stat label={t.maxLoan} value={formatTND(capacity.maxLoan, locale)} />
              <Stat label={t.maxBudget} value={formatTND(capacity.maxBudget, locale)} />
            </div>
            <p className="mt-3 text-xs leading-6 text-muted">{bankTermsNote}</p>
          </div>
        )}

        {/* السكن الاجتماعي */}
        <div className="mt-8 rounded border border-line bg-surface-2 p-5">
          <span className="block text-sm font-medium">{t.socialTitle}</span>
          <p className="mt-1 text-sm leading-7 text-muted">{t.socialLede}</p>

          <div className="mt-4 flex flex-col gap-3 text-sm">
            {(
              [
                ['foprolosInterest', t.foprolos],
                ['isFirstHome', t.firstHome],
                ['hasSocialHousing', t.hasSocialHousing],
                ['cnssAffiliated', t.cnssAffiliated],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2.5 leading-6">
                <input
                  type="checkbox"
                  name={key}
                  checked={values[key] === true}
                  onChange={(e) => set(key, e.target.checked)}
                  className="mt-1 size-4 accent-[#1d3a5f]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {values.cnssAffiliated === true && (
            <label className="mt-4 block max-w-56">
              <span className="mb-1.5 block text-xs text-muted">{t.cnssYears}</span>
              <input
                type="number"
                name="cnssYears"
                min={0}
                max={60}
                value={String(values.cnssYears ?? '')}
                onChange={(e) => set('cnssYears', e.target.value)}
                className={`${inputCls} num`}
              />
            </label>
          )}

          <p className="mt-4 text-xs leading-6 text-faint">{t.socialNote}</p>
        </div>
      </fieldset>

      {/* 6 — الاتصال والوثائق */}
      <fieldset className={step === 6 ? 'block' : 'hidden'}>
        <legend className="display mb-2 text-2xl font-semibold">{t.s5Title}</legend>
        <p className="mb-6 text-muted">{t.s5Lede}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.fullName} error={err('fullName')}>
            <input
              type="text"
              name="fullName"
              value={String(values.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.phone} error={err('phone')} hint={t.phoneHint}>
            <input
              type="tel"
              inputMode="tel"
              name="phone"
              dir="ltr"
              value={String(values.phone ?? '')}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.email} hint={t.optional} error={err('email')}>
              <input
                type="email"
                name="email"
                dir="ltr"
                value={String(values.email ?? '')}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* الوثائق — تصريح لا تثبّت. الفريق كان يكتشف النقص في المكالمة
            الأولى، وصاحب الملفّ يعرفه من الآن. */}
        <div className="mt-8 rounded border border-line bg-surface p-4 sm:p-5">
          <span className="mb-1 block text-sm font-medium">{t.docsTitle}</span>
          <p className="mb-4 text-sm leading-7 text-muted">{t.docsLede}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLIENT_DOC_CODES.map((code) => {
              const on = docs.includes(code)
              return (
                <label
                  key={code}
                  className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded border px-3 text-sm transition ${
                    on ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="documents"
                    value={code}
                    checked={on}
                    onChange={() => toggleDoc(code)}
                    className="size-4 accent-[#1d3a5f]"
                  />
                  {t.docLabels[code]}
                </label>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-6 text-faint">{t.docsNote}</p>
        </div>

        {/* الموافقة تُعطى مرّة عند الإرسال الأوّل. طلبها من جديد على كلّ
            تصحيح يوحي بأنّها قابلة للسحب بنسيان خانة — وهي ليست كذلك. */}
        {isEdit ? (
          <p className="mt-6 rounded border border-line bg-surface px-4 py-3 text-xs leading-6 text-muted">
            {t.editConsentNote}
          </p>
        ) : (
          <>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded border border-line bg-surface p-4">
              <input
                type="checkbox"
                name="consent"
                checked={Boolean(values.consent)}
                onChange={(e) => set('consent', e.target.checked)}
                className="mt-1 size-4 accent-[#1d3a5f]"
              />
              <span className="text-sm leading-7">{t.consent}</span>
            </label>
            {err('consent') && <p className="mt-2 text-sm text-[#8c2f22]">{err('consent')}</p>}
          </>
        )}

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

      {/* على التليفون يلتصق شريط التنقّل بأسفل الشاشة: «التالي» تحت الإبهام
          في كلّ الخطوات، بلا نزول إلى آخر استمارة طويلة */}
      <div
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        className="sticky bottom-0 z-30 -mx-4 mt-8 flex items-center gap-3 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-10 sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none"
      >
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={stepIndex === 0}
          className="min-h-12 shrink-0 rounded border border-line px-5 text-sm transition hover:border-line-strong disabled:opacity-40"
        >
          {t.back}
        </button>

        {stepIndex < order.length - 1 ? (
          <button
            type="button"
            onClick={() => canNext() && go(1)}
            disabled={!canNext()}
            className="min-h-12 flex-1 rounded bg-brand px-8 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-40 sm:flex-none"
          >
            {t.next}
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 flex-1 rounded bg-brand px-8 font-medium text-white transition hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60 sm:flex-none"
          >
            {pending ? t.submitting : isEdit ? t.saveEdit : t.submit}
          </button>
        )}
      </div>
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
    <label
      className={`block ${
        error
          ? '[&_input]:border-[#c0796b] [&_select]:border-[#c0796b] [&_textarea]:border-[#c0796b]'
          : ''
      }`}
    >
      <span className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-sm text-[#8c2f22]">{error}</span>}
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-0.5 text-lg font-medium text-brand">
        <bdi>{value}</bdi>
      </div>
    </div>
  )
}
