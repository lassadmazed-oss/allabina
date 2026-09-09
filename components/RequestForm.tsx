'use client'

import VoiceRecorder from '@/components/VoiceRecorder'
import { Chip, Choice, Field, Group, Stepper } from '@/components/form-controls'
import { isValidPhone, toAsciiDigits } from '@/lib/digits'
import { FIELD_STEP } from '@/lib/request-flow'
import Modal from '@/components/Modal'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { submitRequest, type SubmitState } from '@/lib/actions/request'
import { updateOwnRequest, type EditState } from '@/lib/actions/request-edit'
import ZoneInput, { type Zone } from '@/components/ZoneInput'
import {
  REQUEST_TYPES,
  SELECTABLE_REQUEST_TYPES,
  EMPLOYMENT_TYPES,
  HORIZONS,
  TITLE_STATUSES,
  URGENCIES,
  FLEXIBILITIES,
  LEVELS,
  PROBLEM_KINDS,
  FINANCING_STATES,
} from '@/lib/schema'
import {
  HOUSING_CONDITIONS,
  HOUSING_TENURE_OFFERED,
  INCOME_STABILITY,
} from '@/lib/support-schema'
import {
  applicableDocuments,
  groupDocuments,
  requiredProgress,
  type CatalogDoc,
} from '@/lib/request-documents'
import { computeCapacity, formatTND, type FinanceSettings } from '@/lib/finance'
import { buildCostRange, tierByKey, type TierPrice } from '@/lib/pricing'
import { fmt, path, type Dictionary, type Locale } from '@/lib/i18n'
import type { ConstructionSystem } from '@/lib/construction'
import {
  APARTMENT_STATES,
  EXISTING_BUILDING,
  FLOOR_PREFS,
  OWNERSHIPS,
  PLAN_STATES,
  RENOVATION_WORKS,
  URBAN_PLAN_STATES,
  elevatorMakesSense,
  requestFlow,
} from '@/lib/request-flow'
import { areaLabel, currencyLabel, formatRange, perM2Label } from '@/lib/format'

type Gov = { code: string; name_ar: string; is_active: boolean }
type Deleg = { id: number; gov_code: string; name_ar: string }
type Imada = { id: number; delegation_id: number; name_ar: string }

const STORAGE_KEY = 'allabina.demande.v2'
const initial: SubmitState = { ok: false }
const AREAS = [60, 80, 100, 120]
/** مقاسات القطع الشائعة في صفاقس */
const LAND_AREAS = [200, 300, 400, 500]
/** الزيادات — كلّ واحدة عمود في project_configs ومتغيّر في صيغ البوردرو */
const EXTRAS = ['garage', 'terrasse', 'jardin', 'cloture', 'majel', 'piscine', 'annexe', 'solar', 'ascenseur'] as const



/**
 * أيقونة لكلّ مسار.
 *
 * كانت البطاقات السبع متطابقة: نفس الطوبة الحمراء فوق كلّ واحدة، والفرق
 * بينها سطر نصّ. فتُقرأ البطاقات واحدة واحدة بدل أن تُميَّز بنظرة —
 * وهذه أوّل شاشة يراها الحريف.
 */
const TYPE_ICON: Record<string, string> = {
  // أرض وعليها بناء
  build_on_land: 'M3 17h18v2H3v-2Zm2-2V9l7-5 7 5v6H5Zm4-2h6v-4H9v4Z',
  // قطعة أرض بعلامة بحث
  land_and_house: 'M2 19h20v2H2v-2ZM4 17V8l6-4 6 4v9H4Zm14.5-9a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  // عمارة
  apartment: 'M4 21V3h10v6h6v12H4Zm3-3h3v-3H7v3Zm0-5h3v-3H7v3Zm0-5h3V5H7v3Zm5 10h3v-3h-3v3Zm0-5h3v-3h-3v3Zm0-5h3V5h-3v3Zm5 10h2v-3h-2v3Zm0-5h2v-3h-2v3Z',
  economic: 'M4 21V9l8-6 8 6v12H4Zm6-2h4v-6h-4v6Z',
  rent_to_own: 'M3 20V8l9-6 9 6v12h-7v-6h-4v6H3Z',
  // مطرقة على بيت
  renovation: 'M3 19h18v2H3v-2ZM5 17V9l7-5 7 5v8H5Zm5-3 2-2 2 2-2 2-2-2Z',
  // علامة استفهام
  other: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 15.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm1.7-5.4c-.6.4-.7.6-.7 1v.4h-2v-.5c0-1.2.5-1.9 1.4-2.5.7-.5.9-.8.9-1.3 0-.7-.5-1.2-1.3-1.2s-1.4.5-1.4 1.4H8.6c0-2 1.4-3.3 3.4-3.3s3.3 1.2 3.3 3c0 1.2-.5 1.9-1.6 2.5Z',
}

/** اسم كلّ حقل كما يراه الحريف — يُستعمل في لافتة الخطأ */
function fieldLabels(t: Dictionary['form']): Record<string, string> {
  return {
    requestType: t.s1Title,
    govCode: t.governorate,
    horizon: t.horizon,
    desiredAreaM2: t.area,
    desiredLandM2: t.desiredLandM2,
    bedrooms: t.bedrooms,
    standing: t.standingTitle,
    constructionSystem: t.systemTitle,
    apartmentState: t.apartmentStateTitle,
    floorPref: t.floorPref,
    works: t.worksTitle,
    currentAreaM2: t.currentArea,
    extensionAreaM2: t.extensionArea,
    inUrbanPlan: t.inUrbanPlan,
    existingBuilding: t.existingBuilding,
    hasPlans: t.hasPlans,
    ownership: t.ownership,
    buildingAge: t.buildingAge,
    homeTitleStatus: t.titleStatus,
    homePermit: t.homePermit,
    landLocation: t.landLocation,
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
  systems = [],
  initialType = '',
  mode = 'create',
  initialValues,
  docCatalog,
  voice,
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
  /** أنظمة البناء المتاحة — فارغة تعني إخفاء الاختيار لا تعطيله */
  systems?: ConstructionSystem[]
  initialType?: string
  /** 'edit' = صاحب المطلب يصلّح مطلباً موجوداً، لا يبعث واحداً جديداً */
  mode?: 'create' | 'edit'
  /** القيم المسجّلة — مطلوبة في وضع التعديل */
  initialValues?: Record<string, string | boolean>
  /** دليل الوثائق من القاعدة — الترشيح حسب الملفّ يقع هنا */
  docCatalog: CatalogDoc[]
  /** نصوص زرّ التسجيل — تُمرَّر صراحةً لا عبر القاموس كاملاً */
  voice: Dictionary['voice']
}) {
  const isEdit = mode === 'edit'
  const [state, formAction, pending] = useActionState<SubmitState | EditState, FormData>(
    isEdit ? updateOwnRequest : submitRequest,
    initial
  )
  const [step, setStep] = useState(1)
  const [recapOpen, setRecapOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
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
        const draft = JSON.parse(saved) as Record<string, string | boolean>
        setValues((v) => ({
          ...draft,
          ...(v.requestType ? { requestType: v.requestType } : {}),
        }))
        // حقول الاتّصال غير مقيَّدة، فالمسوّدة تُكتب فيها بأيدينا
        for (const k of UNCONTROLLED) {
          const el = formRef.current?.elements.namedItem(k)
          if (el instanceof HTMLInputElement && draft[k]) el.value = String(draft[k])
        }
      }
    } catch {}
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    } catch {}
  }, [values, isEdit])

  /**
   * الحقول التي مسّها الحريف بعد آخر إرسال.
   *
   * `useActionState` يحتفظ بقائمة الأخطاء حتّى الإرسال التالي، فتبقى
   * «رقم الهاتف» معروضةً خطأً بعد أن يكتبه. الشكوى تصير كاذبة، ومن
   * يقرأ شكوى كاذبة مرّة يكفّ عن قراءة اللافتة أصلاً.
   */
  const [fixedFields, setFixedFields] = useState<string[]>([])
  /** مشاكل وجدناها نحن قبل الإرسال (الاتّصال) — لا من الخادم */
  const [localFields, setLocalFields] = useState<string[]>([])

  const set = (k: string, v: string | boolean) => {
    setValues((s) => ({ ...s, [k]: v }))
    setFixedFields((f) => (f.includes(k) ? f : [...f, k]))
  }
  const num = (k: string) => Number(values[k] || 0)

  /**
   * يقرأ ما في الحقول فعلاً إلى الحالة.
   *
   * الملء التلقائي في بعض المتصفّحات (الهاتف خاصّة) يكتب الاسم والهاتف في
   * الحقل ولا يخبر React، فتبقى الحالة فارغة: الملخّص لا يرى الاتّصال،
   * ثمّ يُعاد الرسم فيُمحى المكتوب ويصل الخادم فارغاً — وقع فعلاً.
   */
  const syncFromDom = () => {
    const form = formRef.current
    if (!form) return values
    const next = { ...values }
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement) || !el.name) continue
      if (el.type === 'checkbox') {
        if (el.name === 'consent') next.consent = el.checked
        continue
      }
      if (el.type === 'hidden' || el.type === 'radio' || el.type === 'file') continue
      if (el.value !== String(next[el.name] ?? '')) next[el.name] = el.value
    }
    setValues(next)
    return next
  }

  /** ما ينقص في الاتّصال — نفس شروط الخادم، قبل أن نزعجه */
  const contactProblems = (v: Record<string, string | boolean>) => {
    const bad: string[] = []
    if (String(v.fullName ?? '').trim().length < 3) bad.push('fullName')
    if (!isValidPhone(String(v.phone ?? ''))) bad.push('phone')
    if (!v.consent) bad.push('consent')
    return bad
  }

  const focusField = (name: string) =>
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(), 250)
  const perM2 = perM2Label(locale)
  const m2 = areaLabel(locale)

  const flexibility = String(values.flexibility ?? '')
    .split(',')
    .filter(Boolean)

  const docs = String(values.documents ?? '')
    .split(',')
    .filter(Boolean)

  /** «بالكراء» جواب في الحيازة، لا سؤال ثانٍ يناقضه */
  const isRenting = values.housingCondition === 'renting'

  /**
   * الخيارات المعروضة + قيمة الملفّ إن كانت من قائمة قديمة.
   *
   * بلا هذا يفتح صاحب ملفّ قديم صفحة التعديل فيجد الخانة فارغة، ويحفظ
   * فيُمحى جوابه بلا أن يقصد — والمحو الصامت أسوأ من خيار زائد.
   */
  const tenureOptions = HOUSING_CONDITIONS.filter(
    (k) =>
      (HOUSING_TENURE_OFFERED as readonly string[]).includes(k) ||
      k === values.housingCondition
  )

  /** تبديل قيمة في حقل متعدّد مخزَّن كنصّ بفواصل */
  const toggleIn = (field: string, code: string) =>
    setValues((v) => {
      const cur = String(v[field] ?? '').split(',').filter(Boolean)
      const next = cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]
      return { ...v, [field]: next.join(',') }
    })

  /**
   * الأوراق التي تخصّ هذا الملفّ بالذات، تُعاد كلّما تبدّل جواب يؤثّر
   * فيها: نوع المطلب، نوع الشغل، فلوس حاضرة، كاري، أقساط، فوبرولوس،
   * إعاقة، وضع السكن، استقرار الدخل.
   */
  const docSections = useMemo(() => {
    const applicable = applicableDocuments(docCatalog, {
      requestType: String(values.requestType ?? ''),
      employment: String(values.employment ?? ''),
      cashReady: Boolean(values.cashReady),
      isRenting,
      existingLoans: Number(values.existingLoans || 0),
      foprolosInterest: Boolean(values.foprolosInterest),
      hasDisability: Boolean(values.hasDisability),
      housingCondition: String(values.housingCondition ?? ''),
      // ما عاد يُسأل في الاستمارة؛ يبقى في الملفّات القديمة وحدها
      housingProblems: [],
      incomeStability: String(values.incomeStability ?? ''),
      ownership: String(values.ownership ?? ''),
      works: String(values.works ?? '').split(',').filter(Boolean),
    })
    return groupDocuments(applicable)
  }, [
    docCatalog,
    values.requestType,
    values.employment,
    values.cashReady,
    isRenting,
    values.existingLoans,
    values.foprolosInterest,
    values.hasDisability,
    values.housingCondition,
    values.incomeStability,
    values.ownership,
    values.works,
  ])


  const docProgress = requiredProgress(
    docSections.flatMap((s) => s.docs),
    docs
  )

  const toggleDoc = (code: string) => toggleIn('documents', code)

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

  /**
   * الخريطة الواحدة: نوع المطلب → ما يظهر. كانت الشروط مبعثرة هنا
   * (isBuild · needsStanding · needsSpecs · wantsLand) فتُقرأ الشفرة لا
   * القاعدة. الآن lib/request-flow.ts يقرّر، والاستمارة تسأله.
   */
  const worksList = String(values.works ?? '').split(',').filter(Boolean)
  const flow = useMemo(
    () =>
      requestFlow({
        requestType: String(values.requestType ?? ''),
        apartmentState: String(values.apartmentState ?? ''),
        works: String(values.works ?? '').split(',').filter(Boolean),
        levels: Number(values.levels || 1),
        ownership: String(values.ownership ?? ''),
        hasDisability: Boolean(values.hasDisability),
      }),
    [
      values.requestType,
      values.apartmentState,
      values.works,
      values.levels,
      values.ownership,
      values.hasDisability,
    ]
  )
  const toggleWork = (w: string) =>
    setValues((v) => {
      const cur = String(v.works ?? '').split(',').filter(Boolean)
      const next = cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]
      return { ...v, works: next.join(',') }
    })

  const wantsLand = flow.has('landArea')
  const needsStanding = flow.has('standing')
  const needsSpecs =
    flow.has('levels') || flow.has('bathrooms') || flow.has('livingRooms') || flow.has('kitchens') || flow.has('extras')
  /** الخطوة المالية مطويّة لمن اختار «مشكل آخر» حتى يفتحها بنفسه */
  const [financeOpen, setFinanceOpen] = useState(false)

  const selectedTier = tierByKey(tiers, String(values.standing ?? ''))
  const areaForCost = Number(values.desiredAreaM2 || 0)
  const costRange =
    selectedTier && areaForCost > 0 ? buildCostRange(areaForCost, selectedTier) : null
  const delegationImadas = imadas.filter(
    (i) => String(i.delegation_id) === String(values.delegationId ?? '')
  )

  // الشريط العلوي يعرض خطوات هذا المسار فعلاً: «الأرض» لمن يملكها،
  // «الدار الحالية» لمن يرمّم، ولا ثالثة لغيرهما
  const steps = useMemo(
    () =>
      flow.steps.map((n) =>
        n === 3 && flow.has('homeStep') ? t.stepHome : t.stepNames[n - 1]
      ),
    [flow, t.stepNames, t.stepHome]
  )
  const order = flow.steps
  const stepIndex = order.indexOf(step)

  /**
   * ما سيُرسل، مقسَّماً بأقسامه.
   *
   * يُبنى من `values` لا من الـDOM: الحقول المخفيّة في خطوات لم تُفتح
   * موجودة في الحالة، فيظهر الملخّص كاملاً مهما كانت الخطوة الحالية.
   * وكلّ قسم يحمل رقم خطوته حتى يرجع إليها بضغطة واحدة.
   */
  const recapSections = useMemo(() => {
    const pick = (list: readonly { code?: string; id?: number; name_ar?: string }[], id: unknown) => {
      const key = String(id ?? '')
      const hit = list.find((x) => String(x.id ?? x.code) === key)
      return hit?.name_ar ?? ''
    }
    const val = (k: string) => String(values[k] ?? '').trim()
    // القواميس مكتوبة بمفاتيح ثابتة؛ القراءة بمفتاح محسوب تحتاج تليين
    const look = (m: Record<string, string> | object, k: unknown) =>
      (m as Record<string, string>)[String(k ?? '')] ?? ''
    const flag = (k: string) => (values[k] ? t.hasIt : '')
    const money = (k: string) => (num(k) > 0 ? formatTND(num(k), locale) : '')
    const list = (k: string, labels: Record<string, string>) =>
      String(values[k] ?? '')
        .split(',')
        .filter(Boolean)
        .map((x) => labels[x] ?? x)
        .join(' · ')

    const rows: { section: keyof typeof t.recapSections; step: number; items: [string, string][] }[] = [
      {
        section: 'request',
        step: 1,
        items: [
          [t.s1Title, look(labels.requestType, values.requestType)],
          [t.urgencyTitle, look(labels.urgency, values.urgency)],
          [t.problemTitle, val('problemNote')],
        ],
      },
      {
        section: 'place',
        step: 2,
        items: [
          [t.governorate, pick(governorates, values.govCode)],
          [t.delegation, pick(delegations, values.delegationId)],
          [t.landLocation, val('landLocation')],
          [wantsLand ? t.builtArea : t.area, val('desiredAreaM2') ? `${val('desiredAreaM2')} ${m2}` : ''],
          [t.desiredLandM2, val('desiredLandM2') ? `${val('desiredLandM2')} ${m2}` : ''],
          [t.bedrooms, val('bedrooms')],
          [t.horizon, look(labels.horizon, values.horizon)],
          [t.standingTitle, selectedTier?.label ?? ''],
          [t.flexTitle, list('flexibility', labels.flexibility)],
        ],
      },
      {
        section: 'land',
        step: 3,
        items: [
          [t.landArea, val('landAreaM2') ? `${val('landAreaM2')} ${m2}` : ''],
          [t.titleStatus, look(labels.titleStatus, values.titleStatus)],
          [t.hasWater, flag('hasWater')],
          [t.hasPower, flag('hasPower')],
          [t.hasRoad, flag('hasRoad')],
          [t.hasPermit, flag('hasPermit')],
        ],
      },
      {
        section: 'family',
        step: 4,
        items: [
          [t.householdSize, val('householdSize')],
          [t.dependents, val('dependents')],
          [t.hasDisability, flag('hasDisability')],
          [t.housingCondition, look(t.housingLabels, values.housingCondition)],
          [t.rentTnd, money('rentTnd')],
        ],
      },
      {
        section: 'money',
        step: 5,
        items: [
          [t.cashReadyTitle, flag('cashReady')],
          [t.incomeStability, look(t.incomeLabels, values.incomeStability)],
          [t.financingState, look(t.financingLabels, values.financingState)],
          [t.problemType, look(t.problemLabels, values.problemType)],
          [t.income, money('monthlyIncome')],
          [t.spouseIncome, money('spouseIncome')],
          [t.otherIncome, money('otherIncome')],
          [t.existingLoans, money('existingLoans')],
          [t.downPayment, money('downPayment')],
          [t.maxMonthly, money('maxMonthly')],
          [t.employment, look(labels.employment, values.employment)],
          [t.seniority, val('seniorityYears')],
          [t.foprolos, flag('foprolosInterest')],
        ],
      },
      {
        section: 'contact',
        step: 6,
        items: [
          [t.fullName, val('fullName')],
          [t.phone, val('phone')],
          [t.email, val('email')],
        ],
      },
      {
        section: 'docs',
        step: 6,
        items: [
          [
            t.docsTitle,
            docSections
              .flatMap((sec) => sec.docs)
              .filter((d) => docs.includes(d.code))
              .map((d) => d.nameAr)
              .join(' · '),
          ],
        ],
      },
    ]

    // قسم بلا جواب واحد لا يُعرض: الملخّص يقول ما قاله، لا ما سكت عنه
    return rows
      .filter((r) => order.includes(r.step))
      // الاتّصال يُعرض دائماً — مطلوب، وغيابه يُقال بشرطة لا بالصمت
      .map((r) => ({
        ...r,
        items:
          r.section === 'contact'
            ? r.items.map(([k, v]): [string, string] => [k, v || '—'])
            : r.items.filter(([, v]) => v),
      }))
      .filter((r) => r.items.length > 0)
  }, [values, docSections, docs, order, selectedTier, wantsLand, governorates, delegations, labels, t, m2, locale])

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
    if (step === 2)
      return Boolean(
        values.govCode && values.horizon && (!flow.locationRequired || values.landLocation)
      )
    // المستأجر لا يرمّم: الخطوة تقف هنا وتقول له لماذا
    if (step === 3) return flow.blocked === null
    // «مشكل آخر»: الخطوة المالية مطويّة، والمرور بلا فتحها مقصود
    if (step === 5 && flow.financeOptional && !financeOpen) return true
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

  /** خطأ ما زال قائماً: من القاعدة، ولم يمسّه الحريف بعد */
  const openFields = [...new Set([...(state.fields ?? []), ...localFields])].filter(
    (f) => !fixedFields.includes(f)
  )

  const err = (k: string) =>
    openFields.includes(k)
      ? t.errors[k === 'consent' ? 'consentRequired' : k] ?? t.errors.fallback
      : undefined

  const fieldNames = fieldLabels(t)

  /**
   * اللافتة تخصّ الخطوة المعروضة وحدها.
   *
   * كانت فوق الخطوات كلّها: من يُرسل ناقصاً ثمّ يرجع إلى الخطوة الأولى
   * يجد شكوى عن «الاسم واللقب» و«رقم الهاتف» — حقول في الخطوة السادسة
   * لم يصل إليها. الشكوى في غير مكانها تُربك ولا تُرشد.
   */
  const badFields = openFields
    .filter((f) => (FIELD_STEP[f] ?? 6) === step)
    .map((f) => fieldNames[f] ?? f)

  /** خطأ خارج هذه الخطوة: نقول أين هو بدل أن نصمت */
  const elsewhereStep = openFields
    .map((f) => FIELD_STEP[f] ?? 6)
    .filter((n) => n !== step)
    .sort((a, b) => a - b)[0]

  /**
   * خطأ حقول صُلّحت كلّها لا يُعرض: `useActionState` يحتفظ بالردّ القديم
   * حتّى الإرسال التالي، فتبقى اللافتة قائمة بعد أن يزول سببها.
   * أمّا أخطاء الخادم والحدّ الزمني فتُعرض دائماً — ليست عن حقل.
   */
  const isFieldError = state.error === 'banner' || localFields.length > 0
  const showBanner = Boolean(
    (state.error || localFields.length > 0) &&
      (!isFieldError || badFields.length > 0 || elsewhereStep !== undefined)
  )

  useEffect(() => {
    if (state.error) setRecapOpen(false)
  }, [state])

  // عند فشل التحقّق: نرجّعو الحريف للخطوة اللي فيها المشكل ونحطّو المؤشّر في الحقل
  useEffect(() => {
    // ردّ جديد من الخادم: ما اعتُبر مصلَّحاً سقط، والقائمة الجديدة هي الحقيقة
    setFixedFields([])
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

  /** الاستعجال: أعلى الخطوة لمن يرمّم أو عنده مشكل، وفي مكانه المعتاد للبقيّة */
  const urgencyGroup = () => (
    <Group title={t.grpTime}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-2 block text-sm font-medium">
            {t.horizon} <span className="text-[#8c2f22]">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {HORIZONS.map((h) => (
              <Chip key={h} on={values.horizon === h} onClick={() => set('horizon', h)}>
                {labels.horizon[h]}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="horizon" value={String(values.horizon ?? '')} />
          {err('horizon') && <p className="mt-2 text-sm text-[#8c2f22]">{err('horizon')}</p>}
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium">{t.urgencyTitle}</span>
          <div className="flex flex-wrap gap-2">
            {URGENCIES.map((u) => (
              <Chip key={u} on={values.urgency === u} onClick={() => set('urgency', u)}>
                {labels.urgency[u]}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="urgency" value={String(values.urgency ?? '')} />
        </div>
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
      <VoiceRecorder name="voiceUrgencyNote" t={voice} />
    </Group>
  )

  return (
    <>
    <form
      ref={formRef}
      action={formAction}
      noValidate
      /**
       * الزرّ يفتح الملخّص؛ الإرسال الحقيقي يجي من زرّ مخفيّ داخل
       * النافذة وحده. في وضع التعديل لا ملخّص: صاحبه يرى ملفّه أمامه.
       */
      onSubmit={(e) => {
        if (isEdit) return
        const submitter = (e.nativeEvent as SubmitEvent).submitter
        if (!submitter?.hasAttribute('data-confirm')) {
          e.preventDefault()
          // ما في الحقول فعلاً، ثمّ الاتّصال قبل الملخّص: الخادم آخر من يكتشف نقصاً
          const synced = syncFromDom()
          const missing = contactProblems(synced)
          if (missing.length) {
            setLocalFields(missing)
            setStep(6)
            window.scrollTo({ top: 0, behavior: 'smooth' })
            focusField(missing[0])
            return
          }
          setLocalFields([])
          setRecapOpen(true)
        }
      }}
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

      {/* الخطوات: أرقام تُنقر للرجوع، والاسم للحالية وحدها — لا شريط صامت */}
      <nav className="mb-5" aria-label={fmt(t.stepOf, { i: stepIndex + 1, n: steps.length })}>
        <ol className="flex items-center gap-1.5">
          {steps.map((name, i) => {
            const done = i < stepIndex
            const cur = i === stepIndex
            return (
              <li key={name} className={`flex items-center gap-1.5 ${cur ? "flex-1" : ""}`}>
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => setStep(order[i])}
                  aria-current={cur ? "step" : undefined}
                  className={`num flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                    cur
                      ? "bg-brand text-white"
                      : done
                        ? "bg-brand-soft text-brand hover:bg-brand hover:text-white"
                        : "bg-surface-2 text-faint"
                  }`}
                >
                  {i + 1}
                </button>
                {cur && <span className="truncate text-sm font-medium">{name}</span>}
                {i < steps.length - 1 && (
                  <span className={`h-px w-3 sm:w-5 ${done ? "bg-brand" : "bg-line"}`} aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {showBanner && (
        <div
          role="alert"
          className="mb-6 rounded border border-[#e0b4ac] bg-[#fbeeeb] p-4 text-sm leading-7 text-[#8c2f22]"
        >
          {isFieldError && badFields.length === 0 && elsewhereStep !== undefined
            ? fmt(t.errors.elsewhere, { step: steps[order.indexOf(elsewhereStep)] ?? '' })
            : t.errors[state.error ?? 'banner'] ?? t.genericError}
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
        <legend className="display mb-1 text-xl font-semibold">{t.s1Title}</legend>
        <p className="mb-4 text-sm text-muted">{t.s1Lede}</p>
        {/* بطاقة لكلّ مسار: أيقونة تميّزها بنظرة، وسطر يقول لمن هي.
            «فلوسي حاضرة» خرجت من هنا: هي حالة تمويل لا نوع مطلب — كانت
            تفرض «بناء فوق أرضي» على من عنده مال ويريد شقّة. */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SELECTABLE_REQUEST_TYPES.map((rt) => {
            const on = values.requestType === rt
            return (
              <label
                key={rt}
                className={`group relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                  on
                    ? "border-brand bg-brand-soft shadow-[0_1px_0_0_var(--color-brand)]"
                    : "border-line bg-surface hover:border-brand/40 hover:bg-brand-soft/40"
                }`}
              >
                <input
                  type="radio"
                  name="requestType"
                  value={rt}
                  checked={on}
                  onChange={(e) => set('requestType', e.target.value)}
                  className="sr-only"
                />
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition ${
                    on ? "bg-brand text-white" : "bg-surface-2 text-muted group-hover:text-brand"
                  }`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" className="size-5">
                    <path fill="currentColor" d={TYPE_ICON[rt]} />
                  </svg>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-6">
                    {labels.requestType[rt]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {labels.requestTypeHint[rt]}
                  </span>
                </span>

                {on && (
                  <svg
                    viewBox="0 0 20 20"
                    className="absolute top-2.5 size-4 text-brand"
                    style={{ insetInlineEnd: '0.625rem' }}
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M10 0a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.1-5.6 5.6a1 1 0 0 1-1.4 0L5.3 10.3a1 1 0 1 1 1.4-1.4l1.7 1.7 4.9-4.9a1 1 0 1 1 1.4 1.4Z"
                    />
                  </svg>
                )}
              </label>
            )
          })}
        </div>

        {err('requestType') && (
          <p className="mt-3 text-sm text-[#8c2f22]">{err('requestType')}</p>
        )}
      </fieldset>

      {/* 2 — بحسب الخريطة: كلّ مسار يرى أسئلته */}
      <fieldset className={step === 2 ? 'block' : 'hidden'}>
        <legend className="display mb-1 text-xl font-semibold">
          {flow.type === 'other' ? t.s2TitleOther : t.s2Title}
        </legend>
        <p className="mb-4 text-sm text-muted">{flow.type === 'other' ? t.s2LedeOther : t.s2Lede}</p>

        {/* «مشكل آخر»: الحكاية أوّلاً — هي سبب اختيار هذا المسار */}
        {flow.type === 'other' && (
          <Group title={t.problemTitle} lede={t.problemLede}>
            <textarea
              name="problemNote"
              rows={5}
              value={String(values.problemNote ?? '')}
              onChange={(e) => set('problemNote', e.target.value)}
              className={inputCls}
              placeholder={t.problemPlaceholder}
            />
            <VoiceRecorder name="voiceProblemNote" t={voice} />
          </Group>
        )}

        {/* ---------- الاستعجال: أعلى الخطوة لمن يرمّم أو عنده مشكل ---------- */}
        {(flow.type === 'other' || flow.type === 'renovation') && urgencyGroup()}

        {flow.type === 'other' && (
          <Group title={t.grpObstacle}>
            <div>
              <span className="mb-2 block text-sm font-medium">{t.problemType} <span className="text-xs font-normal text-faint">{t.optional}</span></span>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROBLEM_KINDS.map((k) => (
                  <Chip key={k} on={values.problemType === k} onClick={() => set('problemType', values.problemType === k ? '' : k)} block>
                    {t.problemLabels[k]}
                  </Chip>
                ))}
              </div>
              <input type="hidden" name="problemType" value={String(values.problemType ?? '')} />
              {err('problemType') && <p className="mt-2 text-sm text-[#8c2f22]">{err('problemType')}</p>}
            </div>
          </Group>
        )}

        {/* ---------- المكان: نفس الحقل، أربع حقائق ---------- */}
        <Group title={t.grpPlace}>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Field
                label={
                  flow.location === 'own_land'
                    ? t.locationOwnLand
                    : flow.location === 'existing_home'
                      ? t.locationHome
                      : flow.location === 'current'
                        ? t.locationCurrent
                        : t.locationWish
                }
                hint={flow.locationRequired ? undefined : t.landLocationHint}
                error={err('landLocation')}
              >
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
              {flow.locationRequired && (
                <p className="mt-1.5 text-xs leading-6 text-muted">{t.locationRequiredHint}</p>
              )}
            </div>
          </div>
        </Group>

        {/* ---------- الدار ---------- */}
        {(flow.has('builtArea') || flow.has('currentArea') || flow.has('bedrooms') || flow.has('works') || flow.has('apartmentState')) && (
          <Group title={t.grpHome}>
            {/* الترميم: شنوّة بالضبط — السؤال الذي يفتح ويغلق كلّ ما بعده */}
            {flow.has('works') && (
              <div className="mb-5">
                <span className="mb-1 block text-sm font-medium">{t.worksTitle}</span>
                <p className="mb-2 text-xs text-muted">{t.worksLede}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {RENOVATION_WORKS.map((w) => (
                    <Choice
                      key={w}
                      name="works"
                      value={w}
                      multi
                      on={worksList.includes(w)}
                      onChange={() => toggleWork(w)}
                      title={t.workLabels[w]}
                      hint={t.workHints[w]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* الشقّة: جاهزة أم على المخطّط — الثانية تفتح التشطيب */}
            {flow.has('apartmentState') && (
              <div className="mb-5">
                <span className="mb-2 block text-sm font-medium">{t.apartmentStateTitle}</span>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {APARTMENT_STATES.map((st) => (
                    <Choice
                      key={st}
                      name="apartmentState"
                      value={st}
                      on={values.apartmentState === st}
                      onChange={() => set('apartmentState', st)}
                      title={t.apartmentStateLabels[st]}
                      hint={t.apartmentStateHints[st]}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className={`grid gap-5 ${wantsLand ? "lg:grid-cols-2" : ""}`}>
              {flow.has('builtArea') && (
                <div>
                  <span className="mb-2 block text-sm font-medium">
                    {flow.type === 'apartment' ? t.areaApartment : wantsLand ? t.builtArea : t.areaBuild}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AREAS.map((a) => (
                      <Chip
                        key={a}
                        on={String(values.desiredAreaM2) === String(a)}
                        onClick={() => set('desiredAreaM2', String(a))}
                      >
                        <span className="num">{a}</span> {m2}
                      </Chip>
                    ))}
                    <input
                      type="number"
                      inputMode="numeric"
                      name="desiredAreaM2"
                      placeholder={t.otherArea}
                      value={String(values.desiredAreaM2 ?? '')}
                      onChange={(e) => set('desiredAreaM2', e.target.value)}
                      className={`${inputCls} w-32`}
                    />
                  </div>
                  {err('desiredAreaM2') && (
                    <p className="mt-2 text-sm text-[#8c2f22]">{err('desiredAreaM2')}</p>
                  )}
                </div>
              )}

              {flow.has('currentArea') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.currentArea} error={err('currentAreaM2')}>
                    <input
                      type="number"
                      inputMode="numeric"
                      name="currentAreaM2"
                      min={20}
                      max={2000}
                      value={String(values.currentAreaM2 ?? '')}
                      onChange={(e) => set('currentAreaM2', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  {flow.has('extensionArea') && (
                    <Field label={t.extensionArea} error={err('extensionAreaM2')}>
                      <input
                        type="number"
                        inputMode="numeric"
                        name="extensionAreaM2"
                        min={5}
                        max={500}
                        value={String(values.extensionAreaM2 ?? '')}
                        onChange={(e) => set('extensionAreaM2', e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  )}
                </div>
              )}

              {wantsLand && (
                <div>
                  <span className="mb-2 block text-sm font-medium">{t.desiredLandM2}</span>
                  <div className="flex flex-wrap gap-2">
                    {LAND_AREAS.map((a) => (
                      <Chip
                        key={a}
                        on={String(values.desiredLandM2) === String(a)}
                        onClick={() => set('desiredLandM2', String(a))}
                      >
                        <span className="num">{a}</span> {m2}
                      </Chip>
                    ))}
                    <input
                      type="number"
                      inputMode="numeric"
                      name="desiredLandM2"
                      min={50}
                      max={5000}
                      placeholder={t.otherArea}
                      value={String(values.desiredLandM2 ?? '')}
                      onChange={(e) => set('desiredLandM2', e.target.value)}
                      className={`${inputCls} w-32`}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-faint">{t.desiredLandHint}</p>
                  {err('desiredLandM2') && (
                    <p className="mt-2 text-sm text-[#8c2f22]">{err('desiredLandM2')}</p>
                  )}
                </div>
              )}
            </div>

            {/* الشقّة: أين في العمارة — معايير مطابقة مباشرة */}
            {flow.has('floorPref') && (
              <div className="mt-5">
                <span className="mb-2 block text-sm font-medium">{t.floorPref}</span>
                <div className="flex flex-wrap gap-2">
                  {FLOOR_PREFS.map((fp) => (
                    <Chip
                      key={fp}
                      on={values.floorPref === fp}
                      onClick={() => set('floorPref', fp)}
                    >
                      {t.floorLabels[fp]}
                    </Chip>
                  ))}
                  <Chip on={Boolean(values.elevatorNeeded)} onClick={() => set('elevatorNeeded', !values.elevatorNeeded)} check>
                    {t.elevatorNeeded}
                  </Chip>
                  <Chip on={Boolean(values.parkingNeeded)} onClick={() => set('parkingNeeded', !values.parkingNeeded)} check>
                    {t.parkingNeeded}
                  </Chip>
                </div>
                <input type="hidden" name="floorPref" value={String(values.floorPref ?? '')} />
                <input type="hidden" name="elevatorNeeded" value={values.elevatorNeeded ? "on" : ""} />
                <input type="hidden" name="parkingNeeded" value={values.parkingNeeded ? "on" : ""} />
                {flow.disabilityHint === 'ground_or_elevator' && (
                  <p className="mt-2 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6">{t.disabilityGround}</p>
                )}
              </div>
            )}

            {flow.has('bedrooms') && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field as="div" label={t.bedrooms} hint={t.optional} error={err('bedrooms')}>
                  <Stepper name="bedrooms" min={1} max={6} value={values.bedrooms} onChange={(v) => set('bedrooms', v)} />
                </Field>
              </div>
            )}
          </Group>
        )}


        {/* ---------- طريقة البناء — لمن يبني شيئاً ---------- */}
        {flow.has('constructionSystem') && systems.length > 1 && (
          <Group
            title={t.systemTitle}
            lede={t.systemLede}
            aside={
              <a
                href={path(locale, '/systemes')}
                target="_blank"
                rel="noopener"
                className="text-xs text-brand underline underline-offset-2"
              >
                {t.systemMore} ↗
              </a>
            }
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {systems.map((sys) => (
                <Choice
                  key={sys.code}
                  name="constructionSystem"
                  value={sys.code}
                  on={values.constructionSystem === sys.code}
                  onChange={() => set('constructionSystem', sys.code)}
                  title={(locale === 'fr' ? sys.name_fr : sys.name_ar) || sys.name_ar}
                  hint={
                    (locale === 'fr' ? sys.citizen_summary_fr : sys.citizen_summary_ar) ||
                    sys.citizen_summary_ar
                  }
                />
              ))}
            </div>
            {err('constructionSystem') && (
              <p className="mt-2 text-sm text-[#8c2f22]">{err('constructionSystem')}</p>
            )}
          </Group>
        )}

        {/* ---------- مستوى التشطيب — حين يُختار تشطيب ---------- */}
        {needsStanding && (
          <Group title={t.standingTitle} lede={t.standingLede}>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.map((tier) => (
                <Choice
                  key={tier.tier}
                  name="standing"
                  value={tier.tier}
                  on={values.standing === tier.tier}
                  onChange={() => set('standing', tier.tier)}
                  title={tier.label}
                  meta={
                    <span className="num text-brand">
                      <bdi dir="ltr">{formatRange(tier.min, tier.max)}</bdi> {perM2}
                    </span>
                  }
                  hint={tier.description}
                />
              ))}
            </div>

            {costRange && selectedTier && (
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-brand/20 bg-brand-soft px-4 py-3 text-sm">
                <span>{fmt(t.costFor, { area: areaForCost, tier: selectedTier.label })}</span>
                <b className="num text-brand">
                  <bdi dir="ltr">{formatRange(costRange.min, costRange.max)}</bdi>{" "}
                  {currencyLabel(locale)}
                </b>
                <span className="basis-full text-xs text-faint">{t.costNote}</span>
              </div>
            )}
          </Group>
        )}

        {/* ---------- المواصفات — حين تُصمَّم دار ---------- */}
        {needsSpecs && (
          <Group title={t.specsTitle} lede={t.specsLede}>
            {flow.has('levels') && (
              <>
                <span className="mb-2 block text-sm font-medium">{t.levels}</span>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {LEVELS.map((lv) => (
                    <Chip
                      key={lv}
                      on={String(values.levels ?? '') === String(lv)}
                      onClick={() => set('levels', String(lv))}
                      block
                    >
                      {t.levelLabels[lv]}
                    </Chip>
                  ))}
                </div>
                <input type="hidden" name="levels" value={String(values.levels ?? '')} />
              </>
            )}

            {(flow.has('bathrooms') || flow.has('livingRooms') || flow.has('kitchens')) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {flow.has('bathrooms') && (
                  <Field as="div" label={t.bathrooms} hint={t.optional} error={err('bathrooms')}>
                    <Stepper name="bathrooms" min={1} max={6} value={values.bathrooms} onChange={(v) => set('bathrooms', v)} />
                  </Field>
                )}
                {flow.has('livingRooms') && (
                  <Field as="div" label={t.livingRooms} hint={t.optional} error={err('livingRooms')}>
                    <Stepper name="livingRooms" min={1} max={4} value={values.livingRooms} onChange={(v) => set('livingRooms', v)} />
                  </Field>
                )}
                {flow.has('kitchens') && (
                  <Field as="div" label={t.kitchens} hint={t.optional} error={err('kitchens')}>
                    <Stepper name="kitchens" min={1} max={3} value={values.kitchens} onChange={(v) => set('kitchens', v)} />
                  </Field>
                )}
              </div>
            )}

            {flow.has('extras') && (
              <>
                <span className="mt-5 mb-1 block text-sm font-medium">{t.extrasTitle}</span>
                <p className="mb-2 text-xs text-muted">{t.extrasLede}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {flow.extras
                    .filter((k) => k !== 'ascenseur' || elevatorMakesSense(Number(values.levels || 1)))
                    .map((k) => (
                      <Chip key={k} on={Boolean(values[k])} onClick={() => set(k, !values[k])} block check>
                        {t[k]}
                        {k === 'ascenseur' && (
                          <span className="block text-[11px] font-normal text-faint">{t.ascenseurHint}</span>
                        )}
                      </Chip>
                    ))}
                </div>
                {flow.disabilityHint === 'elevator' && (
                  <p className="mt-2 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6">{t.disabilityElevator}</p>
                )}
              </>
            )}
            {/* الزيادات تسافر كحقول مستقلّة: كلّ واحدة متغيّر في صيغ البوردرو */}
            {EXTRAS.map((k) => (
              <input key={k} type="hidden" name={k} value={flow.extras.includes(k) && values[k] ? "on" : ""} />
            ))}
          </Group>
        )}

        {/* ---------- الاستعجال — للبقيّة في مكانه المعتاد ---------- */}
        {flow.type !== 'other' && flow.type !== 'renovation' && urgencyGroup()}

        {/* ---------- المرونة: خيارات هذا المسار وحده ---------- */}
        {flow.flexibility.length > 0 && (
          <Group title={t.flexTitle} lede={t.flexLede}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {flow.flexibility.map((f) => (
                <Choice
                  key={f}
                  name="flexibility"
                  value={f}
                  multi
                  on={flexibility.includes(f)}
                  onChange={() => toggleFlexibility(f)}
                  title={labels.flexibility[f]}
                  hint={labels.flexibilityHint[f]}
                />
              ))}
            </div>
            {flexibility.includes('title') && (
              <p className="mt-2 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6">{t.titleWarning}</p>
            )}
          </Group>
        )}

        {/* ---------- الحكاية — لكلّ المسارات، آخر الخطوة إلّا لصاحب المشكل ---------- */}
        {flow.type !== 'other' && (
          <Group title={t.problemTitle} lede={t.problemLede}>
            <textarea
              name="problemNote"
              rows={4}
              value={String(values.problemNote ?? '')}
              onChange={(e) => set('problemNote', e.target.value)}
              className={inputCls}
              placeholder={t.problemPlaceholder}
            />
            <VoiceRecorder name="voiceProblemNote" t={voice} />
          </Group>
        )}
      </fieldset>

      {/* 3 — الأرض لمن يملكها · الدار الحالية لمن يرمّم · لا ثالثة لغيرهما */}
      {flow.has('landStep') && (
        <fieldset className={step === 3 ? 'block' : 'hidden'}>
          <legend className="display mb-1 text-xl font-semibold">{t.s3Title}</legend>
          <p className="mb-4 text-sm text-muted">{t.s3Lede}</p>
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

          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {(
              [
                ['hasWater', t.hasWater],
                ['hasPower', t.hasPower],
                ['hasRoad', t.hasRoad],
                ['hasPermit', t.hasPermit],
              ] as const
            ).map(([k, label]) => (
              <Chip key={k} on={Boolean(values[k])} onClick={() => set(k, !values[k])} block check>
                {label}
              </Chip>
            ))}
          </div>
          {(['hasWater', 'hasPower', 'hasRoad', 'hasPermit'] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={values[k] ? "on" : ""} />
          ))}

          {/* الأسئلة الثلاثة التي يسألها المستشار في أوّل مكالمة اليوم */}
          <div className="mt-6 grid gap-5">
            <div>
              <span className="mb-1 block text-sm font-medium">{t.inUrbanPlan}</span>
              <p className="mb-2 text-xs text-muted">{t.urbanHint}</p>
              <div className="flex flex-wrap gap-2">
                {URBAN_PLAN_STATES.map((v) => (
                  <Chip key={v} on={values.inUrbanPlan === v} onClick={() => set('inUrbanPlan', v)}>
                    {t.urbanLabels[v]}
                  </Chip>
                ))}
              </div>
              <input type="hidden" name="inUrbanPlan" value={String(values.inUrbanPlan ?? '')} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium">{t.existingBuilding}</span>
              <div className="flex flex-wrap gap-2">
                {EXISTING_BUILDING.map((v) => (
                  <Chip key={v} on={values.existingBuilding === v} onClick={() => set('existingBuilding', v)}>
                    {t.existingLabels[v]}
                  </Chip>
                ))}
              </div>
              <input type="hidden" name="existingBuilding" value={String(values.existingBuilding ?? '')} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium">{t.hasPlans}</span>
              <div className="flex flex-wrap gap-2">
                {PLAN_STATES.map((v) => (
                  <Chip key={v} on={values.hasPlans === v} onClick={() => set('hasPlans', v)}>
                    {t.plansLabels[v]}
                  </Chip>
                ))}
              </div>
              <input type="hidden" name="hasPlans" value={String(values.hasPlans ?? '')} />
            </div>
          </div>
        </fieldset>
      )}

      {flow.has('homeStep') && (
        <fieldset className={step === 3 ? 'block' : 'hidden'}>
          <legend className="display mb-1 text-xl font-semibold">{t.sHomeTitle}</legend>
          <p className="mb-4 text-sm text-muted">{t.sHomeLede}</p>

          <span className="mb-2 block text-sm font-medium">{t.ownership}</span>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {OWNERSHIPS.map((o) => (
              <Choice
                key={o}
                name="ownership"
                value={o}
                on={values.ownership === o}
                onChange={() => set('ownership', o)}
                title={t.ownershipLabels[o]}
              />
            ))}
          </div>

          {/* المستأجر لا يرمّم ما لا يملكه: نقولها بلطف ونفتح له المسار الصحيح */}
          {flow.blocked === 'tenant' && (
            <div className="mt-4 rounded-lg border border-gold/50 bg-gold-soft p-4 text-sm leading-7">
              <p>{t.renterStop}</p>
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, requestType: 'other', ownership: '' }))}
                className="mt-2 rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-deep"
              >
                {t.renterStopCta}
              </button>
            </div>
          )}

          {flow.blocked === null && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label={t.buildingAge} hint={t.optional} error={err('buildingAge')}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="buildingAge"
                  min={0}
                  max={200}
                  value={String(values.buildingAge ?? '')}
                  onChange={(e) => set('buildingAge', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t.titleStatus} hint={t.optional}>
                <select
                  name="homeTitleStatus"
                  value={String(values.homeTitleStatus ?? '')}
                  onChange={(e) => set('homeTitleStatus', e.target.value)}
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
              {flow.structural && (
                <div className="sm:col-span-2">
                  <Chip on={Boolean(values.homePermit)} onClick={() => set('homePermit', !values.homePermit)} check>
                    {t.homePermit}
                  </Chip>
                </div>
              )}
              <input type="hidden" name="homePermit" value={values.homePermit ? "on" : ""} />
            </div>
          )}
        </fieldset>
      )}

      {/* 4 — عائلتك ووضعك: كان المستشار يسألها في مكالمة ويكتبها في
          «المسار الاجتماعي». صاحبها يعرفها أحسن، ويكتبها مرّة واحدة. */}
      <fieldset className={step === 4 ? 'block' : 'hidden'}>
        <legend className="display mb-1 text-xl font-semibold">{t.s6Title}</legend>
        <p className="mb-4 text-sm text-muted">{t.s6Lede}</p>

        <Group title={t.grpFamily} lede={t.grpFamilyLede}>
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
        </Group>

        {/* السكن والكراء في مكان واحد: الكراء وصفٌ لوضعية السكن لا للدخل */}
        <Group title={t.grpHousing} lede={t.grpHousingLede}>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.housingCondition} <span className="text-xs font-normal text-faint">{t.optional}</span></span>
            <div className="grid gap-2 sm:grid-cols-2">
              {tenureOptions.map((k) => (
                <Chip key={k} on={values.housingCondition === k} onClick={() => set('housingCondition', values.housingCondition === k ? '' : k)} block>
                  {t.housingLabels[k]}
                </Chip>
              ))}
            </div>
            <input type="hidden" name="housingCondition" value={String(values.housingCondition ?? '')} />
            {err('housingCondition') && <p className="mt-2 text-sm text-[#8c2f22]">{err('housingCondition')}</p>}
          </div>

          {/* الكراء يظهر مع جوابه لا في خانة منفصلة: من قال «بالكراء»
              يُسأل عن مبلغه في نفس اللحظة، ومن بدّل جوابه يختفي السؤال.
              سؤالان لنفس الشيء يعطيان جوابين متناقضين يوماً ما. */}
          {isRenting && (
            <Field label={t.rentTnd} hint={t.rentHint} error={err('rentTnd')}>
              <input
                type="number"
                inputMode="numeric"
                name="rentTnd"
                min={0}
                max={20000}
                value={String(values.rentTnd ?? '')}
                onChange={(e) => set('rentTnd', e.target.value)}
                className={`${inputCls} sm:max-w-xs`}
              />
              <span className="mt-2 block text-xs leading-6 text-faint">{t.rentWhy}</span>
            </Field>
          )}

        </Group>

      </fieldset>

      {/* 5 — القدرة المالية */}
      <fieldset className={step === 5 ? 'block' : 'hidden'}>
        <legend className="display mb-1 text-xl font-semibold">{t.s4Title}</legend>
        <p className="mb-4 text-sm text-muted">{t.s4Lede}</p>
        <Group title={t.grpIncome} lede={t.grpIncomeLede}>
          {/* «فلوسي حاضرة» حالة تمويل لا نوع مطلب. كانت في الخطوة الأولى
              بين مسارات السكن، وكانت تفرض «بناء فوق أرضي» على من اختارها —
              فمن عنده المال ويريد شقّة كان يخرج بمطلب غير مطلبه. مكانها هنا:
              تجاور «وين وصلت مع البنك؟» وتغنيه، وتسبق أسئلة الدخل. */}
          <label
            className={`mb-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
              values.cashReady
                ? "border-gold bg-gold-soft"
                : "border-line bg-surface hover:border-gold/50"
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
                  // التصريح يحسم وضع التمويل، ولا يمسّ نوع المطلب
                  financingState: e.target.checked ? 'self_funded' : '',
                }))
              }
              className="mt-0.5 size-4 accent-[#a8781f]"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{t.cashReadyTitle}</span>
                <span className="rounded bg-gold px-2 py-0.5 text-[11px] font-medium text-white">
                  {t.cashReadyBadge}
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-6 text-muted">{t.cashReadyBody}</span>
            </span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <span className="mb-2 block text-sm font-medium">{t.incomeStability} <span className="text-xs font-normal text-faint">{t.optional}</span></span>
              <div className="grid gap-2 sm:grid-cols-2">
                {INCOME_STABILITY.map((k) => (
                  <Chip key={k} on={values.incomeStability === k} onClick={() => set('incomeStability', values.incomeStability === k ? '' : k)} block>
                    {t.incomeLabels[k]}
                  </Chip>
                ))}
              </div>
              <input type="hidden" name="incomeStability" value={String(values.incomeStability ?? '')} />
              {err('incomeStability') && <p className="mt-2 text-sm text-[#8c2f22]">{err('incomeStability')}</p>}
            </div>
            {!values.cashReady && (
              <div>
                <span className="mb-2 block text-sm font-medium">{t.financingState} <span className="text-xs font-normal text-faint">{t.optional}</span></span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FINANCING_STATES.map((k) => (
                    <Chip key={k} on={values.financingState === k} onClick={() => set('financingState', values.financingState === k ? '' : k)} block>
                      {t.financingLabels[k]}
                    </Chip>
                  ))}
                </div>
                <input type="hidden" name="financingState" value={String(values.financingState ?? '')} />
                {err('financingState') && <p className="mt-2 text-sm text-[#8c2f22]">{err('financingState')}</p>}
              </div>
            )}
          </div>
        </Group>

        {flow.type !== 'other' && (
        <Group title={t.grpObstacle}>
          <div>
            <span className="mb-2 block text-sm font-medium">{t.problemType} <span className="text-xs font-normal text-faint">{t.optional}</span></span>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROBLEM_KINDS.map((k) => (
                <Chip key={k} on={values.problemType === k} onClick={() => set('problemType', values.problemType === k ? '' : k)} block>
                  {t.problemLabels[k]}
                </Chip>
              ))}
            </div>
            <input type="hidden" name="problemType" value={String(values.problemType ?? '')} />
            {err('problemType') && <p className="mt-2 text-sm text-[#8c2f22]">{err('problemType')}</p>}
          </div>
        </Group>
        )}

        {flow.financeOptional && !financeOpen ? (
          <div className="rounded-lg border border-line bg-surface p-4">
            <b className="block text-sm">{t.financeOptionalTitle}</b>
            <p className="mt-1 text-sm leading-7 text-muted">{t.financeOptionalLede}</p>
            <button
              type="button"
              onClick={() => setFinanceOpen(true)}
              className="mt-3 rounded border border-brand px-4 py-2 text-sm text-brand hover:bg-brand-soft"
            >
              {t.financeOptionalOpen}
            </button>
          </div>
        ) : (
          <>
        <p className="mb-4 text-xs text-faint">{t.requiredNote}</p>

        {values.cashReady && (
          <p className="mb-4 rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
            {t.cashReadyNote}
          </p>
        )}

        {/* ---------- الدخل ---------- */}
        <Group title={t.grpIncomeMoney}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.income} required error={err('monthlyIncome')}>
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
          </div>
        </Group>

        {/* ---------- الالتزامات واللي حاضر ---------- */}
        <Group title={t.grpCommit}>
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field label={values.cashReady ? t.budgetReady : t.downPayment} required={Boolean(values.cashReady)}>
                <input
                  type="number"
                  inputMode="numeric"
                  name="downPayment"
                  value={String(values.downPayment ?? '')}
                  onChange={(e) => set('downPayment', e.target.value)}
                  className={inputCls}
                />
            </Field>
          </div>
        </Group>

        {/* ---------- الخدمة ---------- */}
        <Group title={t.grpJob}>
          <span className="mb-2 block text-sm font-medium">
            {t.employment} <span className="text-[#8c2f22]">*</span>
          </span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EMPLOYMENT_TYPES.map((emp) => (
              <Chip key={emp} on={values.employment === emp} onClick={() => set('employment', emp)} block>
                {labels.employment[emp]}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="employment" value={String(values.employment ?? '')} />
          {err('employment') && <p className="mt-2 text-sm text-[#8c2f22]">{err('employment')}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field as="div" label={t.seniority} hint={t.optional}>
              <Stepper name="seniorityYears" min={0} max={50} value={values.seniorityYears} onChange={(v) => set('seniorityYears', v)} />
            </Field>
            <div>
              <span className="mb-2 block text-sm font-medium">{t.isExpat}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Chip on={Boolean(values.isExpat)} onClick={() => set('isExpat', !values.isExpat)} check>
                  {labels.employment.expat}
                </Chip>
                {values.isExpat && (
                  <input
                    type="text"
                    name="expatCountry"
                    placeholder={t.expatCountry}
                    value={String(values.expatCountry ?? '')}
                    onChange={(e) => set('expatCountry', e.target.value)}
                    className={`${inputCls} w-44`}
                  />
                )}
              </div>
              <input type="hidden" name="isExpat" value={values.isExpat ? "on" : ""} />
            </div>
          </div>
        </Group>

        {num('monthlyIncome') > 0 && (
          <div className="mt-5 rounded-lg border border-brand/20 bg-brand-soft p-4">
            <div className="text-sm font-medium text-brand">{t.estimateTitle}</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Stat label={t.maxPayment} value={formatTND(capacity.maxPayment, locale)} />
              <Stat label={t.maxLoan} value={formatTND(capacity.maxLoan, locale)} />
              <Stat label={t.maxBudget} value={formatTND(capacity.maxBudget, locale)} />
            </div>
            <p className="mt-2 text-xs leading-6 text-muted">{bankTermsNote}</p>
          </div>
        )}

        {/* ---------- البرامج المدعّمة ---------- */}
        <Group title={t.socialTitle} lede={t.socialLede}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['foprolosInterest', t.foprolos],
                ['isFirstHome', t.firstHome],
                ['hasSocialHousing', t.hasSocialHousing],
                ['cnssAffiliated', t.cnssAffiliated],
              ] as const
            ).map(([key, label]) => (
              <Chip key={key} on={values[key] === true} onClick={() => set(key, values[key] !== true)} block check>
                {label}
              </Chip>
            ))}
          </div>
          {(['foprolosInterest', 'isFirstHome', 'hasSocialHousing', 'cnssAffiliated'] as const).map((key) => (
            <input key={key} type="hidden" name={key} value={values[key] === true ? "on" : ""} />
          ))}
          {values.cnssAffiliated === true && (
            <div className="mt-3">
              <Field as="div" label={t.cnssYears} hint={t.optional}>
                <Stepper name="cnssYears" min={0} max={60} value={values.cnssYears} onChange={(v) => set('cnssYears', v)} />
              </Field>
            </div>
          )}
          <p className="mt-3 text-xs leading-6 text-faint">{t.socialNote}</p>
        </Group>
          </>
        )}
      </fieldset>

      {/* 6 — الاتصال والوثائق */}
      <fieldset className={step === 6 ? 'block' : 'hidden'}>
        <legend className="display mb-1 text-xl font-semibold">{t.s5Title}</legend>
        <p className="mb-4 text-sm text-muted">{t.s5Lede}</p>
        {/* حقول الاتّصال غير مقيَّدة (defaultValue): الملء التلقائي على الهاتف يكتب
            فيها ولا يخبر React، وأيّ إعادة رسم بعده — نقرة الموافقة مثلاً — كانت
            تمحو المكتوب. هكذا يبقى في الحقل، ويُقرأ منه قبل الملخّص وعند الإرسال. */}
        <Group title={t.grpContact}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fullName} required error={err('fullName')}>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              defaultValue={String(values.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t.phone} required error={err('phone')} hint={t.phoneHint}>
            <input
              type="tel"
              inputMode="tel"
              name="phone"
              autoComplete="tel"
              dir="ltr"
              defaultValue={String(values.phone ?? '')}
              onChange={(e) => set('phone', toAsciiDigits(e.target.value))}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.email} hint={t.optional} error={err('email')}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                dir="ltr"
                defaultValue={String(values.email ?? '')}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>
        </Group>

        {/* الأوراق — تصريح لا تثبّت، ومفصّلة حسب الملفّ: من يبني فوق
            أرضه ومن يشري شقّة ما يحتاجوش نفس الورق. الترشيح في
            lib/request-documents.ts والقائمة في القاعدة. */}
        <Group title={t.docsTitle} lede={t.docsLede}>

          {docProgress.total > 0 && (
            <p
              className={`mb-4 rounded border px-3 py-2 text-sm ${
                docProgress.done === docProgress.total
                  ? 'border-brand/40 bg-brand-soft text-brand'
                  : 'border-line bg-ground text-muted'
              }`}
            >
              {docProgress.done === docProgress.total
                ? t.docsAllDone
                : fmt(t.docsProgress, { done: docProgress.done, total: docProgress.total })}
            </p>
          )}

          <div className="flex flex-col gap-5">
            {docSections.map((section) => (
              <div key={section.group}>
                <div className="mb-2 text-xs font-medium tracking-wide text-faint">
                  {t.docsGroups[section.group]}
                </div>
                <div className="flex flex-col gap-2">
                  {section.docs.map((d) => {
                    const on = docs.includes(d.code)
                    return (
                      <label
                        key={d.code}
                        className={`flex cursor-pointer items-start gap-2.5 rounded border p-3 transition ${
                          on ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="documents"
                          value={d.code}
                          checked={on}
                          onChange={() => toggleDoc(d.code)}
                          className="mt-0.5 size-4 shrink-0 accent-[#1d3a5f]"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {(locale === 'fr' && d.nameFr) || d.nameAr}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] ${
                                d.required
                                  ? 'bg-gold-soft text-gold'
                                  : 'bg-surface-2 text-muted'
                              }`}
                            >
                              {d.required ? t.docsRequired : t.docsOptional}
                            </span>
                          </span>
                          {d.whyAr && (
                            <span className="mt-1 block text-xs leading-6 text-muted">
                              {d.whyAr}
                            </span>
                          )}
                          {d.issuerAr && (
                            <span className="mt-0.5 block text-xs leading-6 text-faint">
                              {t.docsWhere} {d.issuerAr}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-6 text-faint">{t.docsNote}</p>
        </Group>

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
            {pending ? t.submitting : isEdit ? t.saveEdit : t.review}
          </button>
        )}
      </div>

      {/* الإرسال الحقيقي — زرّ مخفيّ تضغطه نافذة الملخّص وحدها */}
      {!isEdit && <button type="submit" data-confirm hidden aria-hidden="true" tabIndex={-1} />}
    </form>

    {recapOpen && (
      <Modal title={t.recapTitle} onClose={() => setRecapOpen(false)}>
        <p className="text-sm leading-7 text-muted">{t.recapLede}</p>

        <div className="mt-4 flex flex-col gap-4">
          {recapSections.map((sec) => (
            <div key={sec.section} className="rounded border border-line">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-ground px-3 py-2">
                <span className="text-sm font-medium">{t.recapSections[sec.section]}</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecapOpen(false)
                    setStep(sec.step)
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
                  }}
                  className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
                >
                  {t.recapJump}
                </button>
              </div>
              <dl className="divide-y divide-line">
                {sec.items.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 px-3 py-2 text-sm">
                    <dt className="text-muted">{k}</dt>
                    <dd className="max-w-[62%] text-end" dir="auto">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

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
            disabled={pending || contactProblems(values).length > 0}
            onClick={() => {
              setRecapOpen(false)
              formRef.current?.requestSubmit(
                formRef.current.querySelector<HTMLButtonElement>('[data-confirm]') ?? undefined
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

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] outline-none transition focus:border-brand'

/** الحقول التي يملؤها المتصفّح تلقائياً — تُترك غير مقيَّدة */
const UNCONTROLLED = ['fullName', 'phone', 'email'] as const


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
