import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import {
  applicableDocuments,
  groupDocuments,
  missingRequired,
} from '@/lib/request-documents'
import { can } from '@/lib/permissions'
import {
  db,
  getConstructionSystems,
  getDocCatalog,
  getFinancingProducts,
  getStandingLevels,
} from '@/lib/supabase/server'
import { assembliesForSpan, suggestAssembly, type SpanLimit } from '@/lib/construction'
import { setFloorAssemblyAction, setProjectSystemAction } from '@/lib/actions/construction'
import { LABELS } from '@/lib/schema'
import { getDictionary } from '@/lib/i18n'
import { formatTND } from '@/lib/finance'
import { labelEmployment, seniorityYearsLabel } from '@/lib/scoring'
import { publicStateOf } from '@/lib/public-state'
import { rankProperties, type MatchProperty } from '@/lib/matching'
import { formatNumber, formatPercent } from '@/lib/format'
import { generateDevisAction, updateProjectConfigAction } from '@/lib/actions/devis'
import { daysLeft, isDevisExpired } from '@/lib/devis'
import { saveMatchAction, updateMatchAction } from '@/lib/actions/property-admin'
import {
  addContributionAction,
  addTaskAction,
  updateContributionAction,
  updateSocialAssessmentAction,
  updateStudyTrackAction,
  updateTaskAction,
} from '@/lib/actions/solutions'
import {
  updateClassificationAction,
  updatePublicUpdateAction,
  updateStatusAction,
  updateFollowUpAction,
  addInteractionAction,
  resolveInteractionAction,
  toggleDocumentAction,
  resendConfirmationAction,
} from '@/lib/actions/admin'

export const dynamic = 'force-dynamic'
const STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment', 'contract', 'on_hold', 'rejected']

type Criterion = { label: string; weight: number; points: number; reason: string }
type GeoRow = { delegations?: { name_ar: string } | null; imadas?: { name_ar: string } | null }

const KIND_AR: Record<string, string> = {
  question: 'سؤال',
  issue: 'مشكل',
  objection: 'اعتراض',
  special_request: 'طلب خاصّ',
  call: 'مكالمة',
  note: 'ملاحظة',
}

const STUDY_TRACKS: Record<string, string> = {
  ready: 'جاهز تقريباً للتنفيذ',
  needs_property: 'يحتاج حلّاً عقارياً',
  needs_financing: 'يحتاج تمويلاً',
  needs_documents: 'يحتاج استكمال وثائق',
  needs_technical: 'يحتاج دراسة فنية',
  social: 'حالة اجتماعية تحتاج مساراً خاصاً',
}

/** صفة الحيازة — واحدة. حالة المسكن في HOUSING_PROBLEM_LABELS. */
const HOUSING_CONDITIONS: Record<string, string> = {
  owner: 'في ملكه أو ملك العائلة',
  renting: 'بالكراء',
  with_family: 'عند العائلة بلا كراء',
  employer: 'سكن وظيفي',
  temporary: 'سكن مؤقّت',
  homeless: 'بلا مأوى',
  other: 'أخرى',
}

/** ما يضايقه في مسكنه — متعدّد ومجتمع */
const HOUSING_PROBLEM_LABELS: Record<string, string> = {
  overcrowded: 'ضيّق ومكتظّ',
  unsafe: 'بناء متصدّع أو خطر',
  no_utilities: 'بلا ماء أو كهرباء أو صرف',
  expensive: 'كراء ثقيل',
  unstable: 'حيازة غير مستقرّة',
  far: 'بعيد عن الخدمة أو المدرسة',
  not_accessible: 'لا يناسب إعاقة أو مرضاً',
}

/** كيف يصل الدخل — لا كم يبلغ */
const INCOME_STABILITY: Record<string, string> = {
  monthly_fixed: 'كلّ شهر بمبلغ ثابت',
  monthly_variable: 'كلّ شهر بمبلغ متبدّل',
  seasonal: 'موسمي',
  irregular: 'غير منتظم',
  none: 'بلا دخل قارّ',
}

const CONTRIBUTION_KINDS: Record<string, string> = {
  land: 'أرض',
  funding: 'تمويل',
  materials: 'مواد بناء',
  labour: 'يد عاملة',
  study: 'دراسة',
  admin_support: 'دعم إداري',
  other: 'أخرى',
}

const CONTRIBUTION_STATUS: Record<string, string> = {
  proposed: 'مقترحة',
  confirmed: 'مؤكّدة',
  delivered: 'مُنجزة',
  cancelled: 'ملغاة',
}

const TASK_STATUS: Record<string, string> = {
  todo: 'للإنجاز',
  doing: 'جارية',
  blocked: 'معطّلة',
  done: 'مُنجزة',
  cancelled: 'ملغاة',
}

const PROBLEM_KINDS: Record<string, string> = {
  financing: 'إشكال تمويل',
  land: 'إشكال عقاري / أرض',
  documents: 'وثائق ناقصة',
  budget_gap: 'الميزانية أقلّ من المطلوب',
  no_offer: 'ما فمّاش عرض مناسب في المنطقة',
  other: 'أخرى',
}

const FINANCING_STATES: Record<string, string> = {
  not_started: 'ما بداش',
  studying: 'بصدد الدراسة',
  bank_submitted: 'الملفّ عند البنك',
  approved: 'تمّت الموافقة',
  refused: 'رفض بنكي',
  self_funded: 'تمويل ذاتي',
}

const PUBLIC_STATE_AR: Record<string, string> = {
  resolved: 'تمّ حلّ الإشكال',
  in_progress: 'بصدد المعالجة',
  waiting: 'في انتظار معطيات أو وثائق',
  closed: 'ملفّ مغلق حالياً',
}

/** مصدر واحد مع الاستمارة العمومية — lib/documents.ts */
const DOC_GROUP_LABELS: Record<string, string> = {
  identity: 'الهويّة',
  income: 'الدخل والقدرة',
  property: 'العقار والملكية',
  permits: 'الرخص والأمثلة',
  social: 'السكن الاجتماعي',
  support: 'الوضعية الاجتماعية',
}

const FINANCING_STATE_LABELS: Record<string, string> = {
  not_started: 'ما بداش',
  studying: 'يقلّب ويقارن',
  bank_submitted: 'الملفّ عند البنك',
  approved: 'تحصّل على موافقة',
  refused: 'رفض بنكي',
  self_funded: 'تمويل ذاتي',
}

const URGENCY_LABELS: Record<string, string> = {
  planning: 'يخطّط بلا أجل',
  within_year: 'خلال سنة',
  urgent: 'مستعجل',
  critical: 'وضعية حرجة',
}

const FLEX_LABELS: Record<string, string> = {
  area: 'مساحة أصغر',
  zone: 'منطقة أخرى',
  standing: 'تشطيب أبسط',
  timing: 'أجل أطول',
  type: 'نوع سكن آخر',
  budget: 'ميزانية أكبر',
}

import RequestFiles from '@/components/RequestFiles'
import SupportAssessmentForm from '@/components/SupportAssessmentForm'
import { loadAssessmentConfig } from '@/lib/actions/assessment'
import { BAND_AR, DECISION_AR, type Band, type Decision } from '@/lib/support-assessment'
import type { RequestFile } from '@/lib/documents'

/** أقسام الملفّ بترتيبها في الصفحة — روابط الشريط الثابت */
const SECTIONS = [
  { id: 'sec-file', label: 'الملفّ' },
  { id: 'sec-status', label: 'الحالة' },
  { id: 'sec-devis', label: 'المواصفات والعرض' },
  { id: 'sec-study', label: 'تصنيف الدراسة' },
  { id: 'sec-social', label: 'المسار الاجتماعي' },
  { id: 'sec-support', label: 'المساندة' },
  { id: 'sec-solution', label: 'عناصر الحلّ' },
  { id: 'sec-tasks', label: 'المهامّ' },
  { id: 'sec-offers', label: 'العروض' },
  { id: 'sec-public', label: 'صفحة المتابعة' },
  { id: 'sec-classify', label: 'تصنيف الملفّ' },
  { id: 'sec-followup', label: 'المتابعة' },
  { id: 'sec-inquiries', label: 'الاستفسارات' },
  { id: 'sec-docs', label: 'الوثائق' },
  { id: 'sec-log', label: 'السجلّ' },
] as const

/** لون كلّ حالة — نفس خريطة لوحة القيادة */
const STATUS_CLS: Record<string, string> = {
  new: 'bg-brand-soft text-brand',
  contacted: 'bg-gold-soft text-gold',
  qualified: 'bg-[#e6f0e9] text-[#1f6b3f]',
  matched: 'bg-[#e6f0e9] text-[#1f6b3f]',
  appointment: 'bg-[#ece7f6] text-[#4b3a8a]',
  contract: 'bg-brand text-white',
  on_hold: 'bg-surface-2 text-muted',
  rejected: 'bg-[#fbeeeb] text-[#8c2f22]',
}

/** عنوان قسم: لبنة ذهبية صغيرة ثمّ النصّ */
const H2 = "flex items-center gap-2 text-base font-semibold text-ink before:h-2.5 before:w-4 before:rounded-sm before:bg-gold-light before:content-['']"

const LEDGER_EVENT_LABELS: Record<string, string> = {
  needed: 'مطلوب',
  pledged: 'تعهّد',
  confirmed: 'مؤكّد',
  delivered: 'وصل',
  cancelled: 'ملغى',
}

/** نصوص الخريطة حسب المسار — نفس ما يقرأه الحريف، بالعربية */
const F = getDictionary('ar').form
/** تصريح طلب المساندة — نفس تسميات الاستمارة */
const H = getDictionary('ar').soutien.askHelp

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')
  const { id } = await params

  const { data: r } = await db.from('housing_requests').select('*').eq('id', id).maybeSingle()
  if (!r) notFound()

  const [
    { data: fin },
    { data: land },
    { data: home },
    { data: intake },
    { data: score },
    { data: events },
    { data: interactions },
    { data: docs },
    { data: requestFiles },
    { data: smsRows },
    { data: assessment },
    assessmentConfig,
    docCatalog,
    { data: social },
    { data: config },
    { data: latestDevis },
    { data: contributions },
    standingLevels,
    { data: supportCase },
    { data: supportLedger },
    { data: tasks },
    { data: partners },
    { data: team },
    { data: approvedProperties },
    { data: savedMatches },
    products,
    { data: geo },
    constructionSystems,
    { data: floorOfferings },
  ] = await Promise.all([
    db.from('financial_profiles').select('*').eq('request_id', id).maybeSingle(),
    db.from('request_land').select('*').eq('request_id', id).maybeSingle(),
    db.from('request_home').select('*').eq('request_id', id).maybeSingle(),
    db.from('support_intake').select('*').eq('request_id', id).maybeSingle(),
    db
      .from('scores')
      .select('*')
      .eq('request_id', id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('request_events')
      .select('*')
      .eq('request_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('request_interactions')
      .select('*')
      .eq('request_id', id)
      .order('created_at', { ascending: false }),
    db.from('request_documents').select('*').eq('request_id', id),
    db.from('request_files').select('*').eq('request_id', id).order('created_at'),
    db.from('sms_log').select('template, status, to_number, error, sent_at, created_at').eq('request_id', id).order('created_at', { ascending: false }),
    db.from('support_assessments').select('*').eq('request_id', id).maybeSingle(),
    loadAssessmentConfig(),
    getDocCatalog(),
    db.from('social_assessments').select('*').eq('request_id', id).maybeSingle(),
    db.from('project_configs').select('*').eq('request_id', id).maybeSingle(),
    db
      .from('devis')
      .select('*')
      .eq('request_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('contributions').select('*').eq('request_id', id).order('created_at'),
    getStandingLevels(),
    db.from('support_cases').select('id, published, consent_given').eq('request_id', id).maybeSingle(),
    db
      .from('support_ledger')
      .select('id, event, label, occurred_at, partner_public')
      .eq('request_id', id)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(6),
    db.from('tasks').select('*').eq('request_id', id).order('created_at'),
    db.from('partners').select('id, name, kind').eq('is_active', true).order('name'),
    db.from('staff').select('user_id, full_name, email').eq('active', true).order('full_name'),
    db
      .from('properties')
      .select('id, ref_code, kind, gov_code, delegation_id, imada_id, area_m2, built_area_m2, price_tnd, status, address')
      .eq('status', 'approved')
      .limit(300),
    db
      .from('matches')
      .select('id, property_id, score, status, note, reasons')
      .eq('request_id', id)
      .order('score', { ascending: false }),
    getFinancingProducts(),
    db
      .from('housing_requests')
      .select('delegations(name_ar), imadas(name_ar)')
      .eq('id', id)
      .maybeSingle(),
    getConstructionSystems(),
    // عروض الأسقف وحدودها: مصدر جدول البحور الذي يُقارَن به قرار المهندس
    db
      .from('system_offerings')
      .select(
        'id, system_code, span_limits(usage_code, usage_ar, load_kn_m2, assembly_code, span_max_m, reinforcement)'
      )
      .eq('element_scope', 'plancher')
      .neq('status', 'draft'),
  ])

  // ---------- طريقة البناء والسقف ----------
  // الحدود تُقرأ من عرض السقف الخاصّ بالنظام المختار: لا يُقارَن قرار
  // بجدول نظام آخر.
  const projectSystem = (config?.system_code as string | null) ?? null
  const floorOffering = ((floorOfferings ?? []) as {
    id: number
    system_code: string
    span_limits: SpanLimit[] | null
  }[]).find((o) => o.system_code === projectSystem)
  const spanLimits: SpanLimit[] = (floorOffering?.span_limits ?? []).map((l) => ({
    ...l,
    load_kn_m2: Number(l.load_kn_m2),
    span_max_m: Number(l.span_max_m),
  }))
  const floorUsage = (config?.floor_usage_code as string | null) ?? "habitation"
  const projectSpan = config?.max_span_m === null || config?.max_span_m === undefined
    ? 0
    : Number(config.max_span_m)
  const chosenAssembly = (config?.floor_assembly as string | null) ?? null
  const spanVerdicts = assembliesForSpan(spanLimits, floorUsage, projectSpan)
  const spanSuggestion = suggestAssembly(spanLimits, floorUsage, projectSpan)
  // التحذير الوحيد الذي يعني شيئاً: تركيبة مختارة خارج حدّها
  const chosenVerdict = spanVerdicts.find((v) => v.assembly === chosenAssembly)
  const assemblyOutOfRange = Boolean(projectSpan > 0 && chosenVerdict && !chosenVerdict.fits)
  const floorUsages = [...new Map(spanLimits.map((l) => [l.usage_code, l])).values()]
  const assemblyCodes = [...new Set(spanLimits.map((l) => l.assembly_code))].sort()

  // ---------- اقتراحات المطابقة ----------
  const propertyPool: MatchProperty[] = ((approvedProperties ?? []) as Record<string, unknown>[]).map(
    (x) => ({
      id: String(x.id),
      kind: String(x.kind),
      govCode: String(x.gov_code),
      delegationId: x.delegation_id === null ? null : Number(x.delegation_id),
      imadaId: x.imada_id === null ? null : Number(x.imada_id),
      areaM2: x.area_m2 === null ? null : Number(x.area_m2),
      builtAreaM2: x.built_area_m2 === null ? null : Number(x.built_area_m2),
      priceTnd: x.price_tnd === null ? null : Number(x.price_tnd),
      status: String(x.status),
    })
  )

  const suggestions = rankProperties(
    {
      requestType: r.request_type,
      govCode: r.gov_code,
      delegationId: r.delegation_id,
      imadaId: r.imada_id,
      desiredAreaM2: r.desired_area_m2,
      maxBudget: score ? Number(score.max_budget_tnd ?? 0) : null,
      ownsLand: Boolean(r.owns_land),
      scoreBand: score?.band ?? null,
    },
    propertyPool,
    { limit: 6 }
  )

  const propertyById = new Map(propertyPool.map((x) => [x.id, x]))
  const propertyRefById = new Map(
    ((approvedProperties ?? []) as Record<string, unknown>[]).map((x) => [
      String(x.id),
      { ref: String(x.ref_code), address: (x.address as string | null) ?? '' },
    ])
  )
  const savedIds = new Set(((savedMatches ?? []) as { property_id: string }[]).map((m) => m.property_id))

  const { data: devisLines } = latestDevis
    ? await db
        .from('devis_lines')
        .select('*')
        .eq('devis_id', (latestDevis as { id: string }).id)
        .order('lot_code')
        .order('sort_order')
    : { data: null }

  type DevisLine = {
    id: number
    lot_code: number
    lot_name_ar: string
    article_code: string
    designation_ar: string
    unit: string
    quantity: number
    pu_total_ht: number
    total_ht: number
  }

  const lineRows = (devisLines ?? []) as DevisLine[]
  const devisLots = new Map<number, { name: string; total: number }>()
  for (const l of lineRows) {
    const cur = devisLots.get(l.lot_code) ?? { name: l.lot_name_ar, total: 0 }
    cur.total += Number(l.total_ht)
    devisLots.set(l.lot_code, cur)
  }
  const devisValidUntil = (latestDevis as { valid_until?: string | null } | null)?.valid_until ?? null
  const devisExpired = isDevisExpired(devisValidUntil)
  const devisDaysLeft = daysLeft(devisValidUntil)
  const devisSurface = Number((latestDevis as { surface_m2?: number } | null)?.surface_m2 ?? 0)
  const devisTotal = Number((latestDevis as { total_ht?: number } | null)?.total_ht ?? 0)

  const criteria = ((score?.breakdown as { criteria?: Criterion[] } | null)?.criteria ?? []) as Criterion[]

  /**
   * نفس ترشيح الاستمارة بالضبط: الفريق يشوف القائمة اللي شافها صاحب
   * الملفّ. قائمتان مختلفتان تعني مكالمة تطلب ورقة ما تطلبتش منّو.
   */
  const applicableDocs = applicableDocuments(docCatalog, {
    requestType: String(r.request_type ?? ''),
    employment: String(fin?.employment ?? ''),
    cashReady: Boolean(r.cash_ready),
    isRenting: Boolean(social?.is_renting),
    existingLoans: Number(fin?.existing_loans_tnd ?? 0),
    foprolosInterest: Boolean(r.foprolos_interest),
    hasDisability: Boolean(social?.has_disability),
    ownership: String(home?.ownership ?? ''),
    works: Array.isArray(r.renovation_works) ? (r.renovation_works as string[]) : [],
    housingCondition: String(social?.housing_condition ?? ''),
    housingProblems: (social?.housing_problems ?? []) as string[],
    incomeStability: String(social?.income_stability ?? ''),
  })
  const docSections = groupDocuments(applicableDocs)
  const declaredCodes = (docs ?? [])
    .filter((x) => x.declared)
    .map((x) => String(x.doc_code ?? ''))
    .filter(Boolean)
  const docMissing = missingRequired(applicableDocs, declaredCodes)
  /**
   * سطر بلا رمز يبقى ممكناً: تأشيرة الفريق تُكتب بالاسم العربي وحده.
   * فنقابل بالاثنين، وإلّا ظهرت وثيقة أشّرها الفريق كأنّها «خارج القائمة».
   */
  const inList = new Set([
    ...applicableDocs.map((d) => d.code),
    ...applicableDocs.map((d) => d.nameAr),
  ])
  const docExtra = (docs ?? []).filter(
    (x) =>
      (x.declared || x.available) &&
      !inList.has(String(x.doc_code ?? '')) &&
      !inList.has(String(x.doc_type ?? ''))
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← رجوع للقائمة
      </Link>

      {/* شريط القرار: من هو، وأين، وكم يقدر، وما حالته — يبقى أعلى الصفحة مع روابط الأقسام */}
      <div className="sticky top-0 z-30 -mx-4 mt-3 border-b border-line bg-ground/95 px-4 pb-2 pt-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h1 className="display truncate text-lg font-semibold leading-tight">{r.full_name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
              <span className="num text-brand" dir="ltr">
                {r.ref_code}
              </span>
              <a href={`tel:${r.phone}`} className="num hover:text-brand" dir="ltr">
                {r.phone}
              </a>
              {r.email && <span dir="ltr">{r.email}</span>}
              <span>{LABELS.requestType[r.request_type] ?? r.request_type}</span>
              {(geo as GeoRow | null)?.delegations?.name_ar && <span>{(geo as GeoRow | null)?.delegations?.name_ar}</span>}
            </div>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? 'bg-surface-2 text-muted'}`}>
              {LABELS.status[r.status] ?? r.status}
            </span>
            {score && (
              <span className="num rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                {score.band} · {score.total}
              </span>
            )}
            {score?.max_budget_tnd ? (
              <span className="num rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs" title="الميزانية التقديرية">
                {formatTND(Number(score.max_budget_tnd))}
              </span>
            ) : null}
            <a href={`tel:${r.phone}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-deep">
              اتّصل
            </a>
            <a href="#sec-status" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-brand transition hover:border-brand">
              حيّن الحالة
            </a>
          </div>
        </div>
        <nav aria-label="أقسام الملفّ" className="mt-2 flex gap-1.5 overflow-x-auto pb-1 text-xs [scrollbar-width:none]">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-muted transition hover:border-brand hover:text-brand"
            >
              {sec.label}
            </a>
          ))}
        </nav>
      </div>

      <div id="sec-file" className="mt-6 grid scroll-mt-32 gap-6 lg:grid-cols-2">
        <Card title="المطلب">
          <Row k="النوع" v={LABELS.requestType[r.request_type] ?? r.request_type} />
          <Row k="الولاية" v={r.gov_code === 'SFX' ? 'صفاقس' : r.gov_code} />
          <Row k="المعتمدية" v={(geo as GeoRow | null)?.delegations?.name_ar ?? '—'} />
          <Row k="العمادة" v={(geo as GeoRow | null)?.imadas?.name_ar ?? '—'} />
          <Row k="موقع الأرض" v={r.land_location || '—'} />
          {/* الشقّة */}
          {r.apartment_state && <Row k={F.apartmentStateTitle} v={F.apartmentStateLabels[String(r.apartment_state)] ?? String(r.apartment_state)} />}
          {r.floor_pref && <Row k={F.floorPref} v={F.floorLabels[String(r.floor_pref)] ?? String(r.floor_pref)} />}
          {(r.elevator_needed || r.parking_needed) && (
            <Row k="شروط" v={[r.elevator_needed ? F.elevatorNeeded : null, r.parking_needed ? F.parkingNeeded : null].filter(Boolean).join(' · ')} />
          )}
          {/* الترميم */}
          {Array.isArray(r.renovation_works) && r.renovation_works.length > 0 && (
            <Row k={F.worksTitle} v={(r.renovation_works as string[]).map((w) => F.workLabels[w] ?? w).join(' · ')} />
          )}
          {r.current_area_m2 && <Row k={F.currentArea} v={`${r.current_area_m2} م²`} />}
          {r.extension_area_m2 && <Row k={F.extensionArea} v={`${r.extension_area_m2} م²`} />}
          <Row
            k={r.request_type === 'land_and_house' ? 'مساحة الدار المغطات' : 'المساحة'}
            v={r.desired_area_m2 ? `${r.desired_area_m2} م²` : '—'}
          />
          {/* مقاس أرض يدوّر عليه — لا قطعة يملكها. المملوكة في بطاقة «الأرض» */}
          {r.request_type === 'land_and_house' && (
            <Row
              k="مساحة الأرض المطلوبة"
              v={r.desired_land_m2 ? `${r.desired_land_m2} م²` : '—'}
            />
          )}
          <Row k="عدد الغرف" v={r.bedrooms ? String(r.bedrooms) : '—'} />
          <Row k="مستوى التشطيب" v={standingLevels.find((l) => l.code === r.standing)?.nameAr ?? '—'} />
          <Row k="الأفق الزمني" v={LABELS.horizon[r.horizon] ?? '—'} />
          <Row k="الحالة" v={LABELS.status[r.status] ?? r.status} />
          <Row k="تاريخ التسجيل" v={new Date(r.created_at).toLocaleString('fr-TN')} />
          <Row
            k="رسالة التأكيد (SMS)"
            v={(() => {
              const sms = (smsRows ?? []).find((x) => x.template.startsWith('request_confirmation'))
              if (!sms) return 'لم تُرسل — المطلب سُجّل قبل تفعيل الرسائل أو من البذرة'
              if (sms.status === 'sent') return `وصلت إلى ${sms.to_number} · ${new Date(sms.sent_at ?? sms.created_at).toLocaleString('fr-TN')}`
              if (sms.status === 'failed') return `فشلت — ${sms.error ?? 'بلا تفصيل'}`
              if (sms.status === 'skipped') return `لم تُرسل — ${sms.error ?? ''}`
              return 'في الانتظار'
            })()}
          />
          <Row
            k="درجة الاستعجال"
            v={
              r.urgency
                ? `${URGENCY_LABELS[r.urgency] ?? r.urgency}${r.urgency_note ? ` — ${r.urgency_note}` : ''}`
                : '—'
            }
          />
          <Row
            k="التمويل"
            v={
              r.cash_ready
                ? 'فلوسو حاضرة — مسار بلا بنك'
                : FINANCING_STATE_LABELS[r.financing_state as string] ?? '—'
            }
          />
          <Row
            k="ما يضايقه في سكنه"
            v={
              ((social?.housing_problems ?? []) as string[]).length
                ? ((social?.housing_problems ?? []) as string[])
                    .map((x) => HOUSING_PROBLEM_LABELS[x] ?? x)
                    .join(' · ')
                : '—'
            }
          />
          <Row
            k="الكراء الحالي"
            v={
              social?.is_renting
                ? social.rent_tnd
                  ? `كاري — ${formatNumber(Number(social.rent_tnd))} د.ت/شهر`
                  : 'كاري — المبلغ غير مصرَّح به'
                : social
                  ? 'ما هوش كاري'
                  : '—'
            }
          />
          <Row
            k="مستعدّ يتنازل على"
            v={
              r.flexibility?.length
                ? (r.flexibility as string[]).map((f) => FLEX_LABELS[f] ?? f).join(' · ')
                : '—'
            }
          />
          <Row
            k="السكن الاجتماعي"
            v={
              r.foprolos_interest
                ? [
                    'يهمّه برنامج مدعّم',
                    r.is_first_home ? 'أوّل مسكن' : null,
                    r.has_social_housing ? 'سبق وانتفع' : null,
                    r.cnss_affiliated
                      ? `مضمون${r.cnss_number_years ? ` (${r.cnss_number_years} سنة)` : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '—'
            }
          />
          {r.problem_note && (
            <div className="sm:col-span-2 mt-2 rounded border border-line bg-surface-2 p-4">
              <div className="text-xs font-medium text-muted">المشكل بكلام الحريف</div>
              <p className="mt-1.5 text-sm leading-7">{r.problem_note}</p>
            </div>
          )}
        </Card>

        {fin && (
          <Card title="الملفّ المالي">
            <Row k="الدخل الشهري" v={formatTND(Number(fin.monthly_income_tnd))} />
            <Row k="دخل القرين" v={formatTND(Number(fin.spouse_income_tnd ?? 0))} />
            <Row k="دخل آخر" v={formatTND(Number(fin.other_income_tnd ?? 0))} />
            <Row k="الأقساط الجارية" v={formatTND(Number(fin.existing_loans_tnd ?? 0))} />
            <Row k="التسبقة" v={formatTND(Number(fin.down_payment_tnd ?? 0))} />
            <Row k="نوع النشاط" v={labelEmployment(fin.employment)} />
            <Row k="الأقدمية" v={seniorityYearsLabel(fin.seniority_months ?? 0)} />
            <Row k="مقيم بالخارج" v={fin.is_expat ? `نعم — ${fin.expat_country ?? ''}` : 'لا'} />
          </Card>
        )}

        {land && (
          <Card title="الأرض">
            <Row k="المساحة" v={land.area_m2 ? `${land.area_m2} م²` : '—'} />
            <Row k="الوضعية العقارية" v={LABELS.titleStatus[land.title_status] ?? '—'} />
            <Row k="ماء" v={land.has_water ? 'نعم' : 'لا'} />
            <Row k="كهرباء" v={land.has_power ? 'نعم' : 'لا'} />
            <Row k="منفذ على الطريق" v={land.has_road ? 'نعم' : 'لا'} />
            <Row k="رخصة بناء" v={land.has_permit ? 'نعم' : 'لا'} />
            {land.in_urban_plan && <Row k={F.inUrbanPlan} v={F.urbanLabels[String(land.in_urban_plan)] ?? String(land.in_urban_plan)} />}
            {land.existing_building && <Row k={F.existingBuilding} v={F.existingLabels[String(land.existing_building)] ?? String(land.existing_building)} />}
            {land.has_plans && <Row k={F.hasPlans} v={F.plansLabels[String(land.has_plans)] ?? String(land.has_plans)} />}
          </Card>
        )}

        {/* الدار الحالية — لمن يرمّم. الكاري موسوم: لا يرمّم ما لا يملكه */}
        {home && (
          <Card title={F.sHomeTitle}>
            <Row k={F.ownership} v={F.ownershipLabels[String(home.ownership)] ?? '—'} />
            {home.ownership === 'tenant' && (
              <p className="mb-2 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6">كاري — لا يرمّم ما لا يملكه. الملفّ يحتاج توجيهاً لا تقديراً.</p>
            )}
            <Row k={F.buildingAge} v={home.building_age_years != null ? `${home.building_age_years} سنة` : '—'} />
            <Row k="الوضعية العقارية" v={LABELS.titleStatus[String(home.title_status)] ?? '—'} />
            <Row k={F.homePermit} v={home.has_permit ? 'نعم' : 'لا'} />
          </Card>
        )}

        {/* تصريح طلب المساندة — مرتّب على معايير الدراسة الستّة */}
        {intake && (
          <Card title="تفاصيل طلب المساندة">
            {(() => {
              const i = intake as Record<string, unknown>
              const arr = (k: string) => (Array.isArray(i[k]) ? (i[k] as string[]) : [])
              const lab = (m: Record<string, string>, k: unknown) => (k ? (m[String(k)] ?? String(k)) : '—')
              const join = (m: Record<string, string>, k: string) => arr(k).map((x) => m[x] ?? x).join(' · ') || '—'
              const yn = (k: string) => (i[k] ? 'نعم' : 'لا')
              const Sub = ({ t }: { t: string }) => <div className="mt-3 mb-1 text-xs font-semibold text-brand">{t}</div>
              return (
                <>
                  <Row k={H.forWhom} v={lab(H.forWhomLabels, i.for_whom)} />
                  {i.beneficiary_name ? <Row k={H.beneficiaryName} v={String(i.beneficiary_name)} /> : null}
                  <Sub t="الحاجة والاستعجال" />
                  <Row k={H.needKinds} v={join(H.needKindLabels, 'need_kinds')} />
                  <Row k={H.triggers} v={join(H.triggerLabels, 'triggers')} />
                  <Sub t="فجوة السكن" />
                  <Row k={H.roomsCount} v={i.rooms_count != null ? String(i.rooms_count) : '—'} />
                  <Row k={H.yearsThere} v={i.years_there != null ? String(i.years_there) : '—'} />
                  <Row k={H.utilities} v={join(H.utilityLabels, 'utilities')} />
                  <Row k={H.buildingState} v={lab(H.buildingStateLabels, i.building_state)} />
                  <Sub t="الهشاشة" />
                  <Row k={H.childrenCount} v={i.children_count != null ? String(i.children_count) : '—'} />
                  <Row k={H.elderlyCount} v={i.elderly_count != null ? String(i.elderly_count) : '—'} />
                  <Row k={H.headStatus} v={lab(H.headStatusLabels, i.head_status)} />
                  {i.disability_note ? <Row k={H.disabilityNote} v={String(i.disability_note)} /> : null}
                  <Row k={H.incomeRange} v={lab(H.incomeRangeLabels, i.income_range)} />
                  {i.main_earner_job ? <Row k={H.mainEarnerJob} v={String(i.main_earner_job)} /> : null}
                  <Row k={H.socialCoverage} v={join(H.socialCoverageLabels, 'social_coverage')} />
                  <Row k={H.existingAid} v={lab(H.yesNoLabels, i.existing_aid)} />
                  <Sub t="الجهد الذاتي" />
                  <Row k={H.landStatus} v={lab(H.landStatusLabels, i.land_status)} />
                  <Row k={H.hasMaterials} v={yn('has_materials')} />
                  <Row k={H.savingsRange} v={lab(H.savingsLabels, i.savings_range)} />
                  <Row k={H.familyHelp} v={yn('family_help')} />
                  <Row k={H.canWork} v={yn('can_work')} />
                  <Row k={H.stepsTaken} v={join(H.stepsLabels, 'steps_taken')} />
                  <Sub t="التثبّت" />
                  <Row k={H.canVisit} v={yn('can_visit')} />
                  <Row k={H.bestTime} v={lab(H.bestTimeLabels, i.best_time)} />
                  {i.reference_note ? <Row k={H.referenceNote} v={String(i.reference_note)} /> : null}
                  {i.alt_phone ? <Row k={H.altPhone} v={String(i.alt_phone)} /> : null}
                  {i.address_note ? <Row k={H.addressNote} v={String(i.address_note)} /> : null}
                </>
              )
            })()}
          </Card>
        )}

        {score && (
          <Card title="تفصيل التنقيط">
            <div className="space-y-3">
              {criteria.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{c.label}</span>
                    <span className="num text-muted">
                      {c.points} / {c.weight}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div
                      className="h-1.5 rounded-full bg-brand"
                      style={{ width: `${(c.points / c.weight) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-faint">{c.reason}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <Row k="القرض التقديري" v={formatTND(Number(score.max_loan_tnd ?? 0))} />
              <Row k="الميزانية" v={formatTND(Number(score.max_budget_tnd ?? 0))} />
            </div>
          </Card>
        )}
      </div>

      {/* تغيير الحالة */}
      <div id="sec-status" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>تحيين الحالة</h2>
        {canEdit && (
          <form action={updateStatusAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">الحالة</span>
              <select
                name="status"
                defaultValue={r.status}
                className="rounded border border-line bg-surface px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.status[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1.5 block text-xs text-muted">ملاحظة (اختياري)</span>
              <input
                name="note"
                className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                placeholder="مثال: تمّ الاتصال، موعد يوم الخميس"
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="notify_sms" defaultChecked className="size-4 accent-[#1d3a5f]" />
              أعلم الحريف برسالة قصيرة
              <span className="text-faint">(مؤهّل · عرض · موعد · عقد · موقوف — لا «مرفوض»)</span>
            </label>
            <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
              حفظ
            </button>
          </form>
        )}
        {canEdit && (
          <form action={resendConfirmationAction} className="mt-3">
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand">
              أعد إرسال رسالة الرمز المرجعي
            </button>
            <span className="ms-2 text-xs text-faint">للحريف اللي يقول ما وصلتوش — تكلّف رسالة</span>
          </form>
        )}
      </div>

      {/* مواصفات المشروع والعرض التقديري — Module 11 */}
      <div id="sec-devis" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>مواصفات المشروع والعرض التقديري</h2>
        <p className="mt-1 text-xs leading-6 text-muted">
          المواصفات هي مدخل حساب العرض. العرض يتولّد من البوردرو وأسعاره وقت التوليد، ويبقى
          محفوظاً بها حتى لو تبدّلت الأسعار بعد.
        </p>


        {/* ---------- طريقة البناء والسقف ---------- */}
        {/* الآلة ترتّب وتحسب، والإنسان يقرّر ويُسجَّل قراره — نفس مبدأ
            التنقيط والمطابقة. اشتقاق التركيبة من المساحة وحدها قد يعطي
            سقفاً خارج حدوده، فالقرار يبقى للمهندس منسوباً إليه. */}
        <div className="mt-4 rounded border border-line bg-ground p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm">طريقة البناء</b>
            <form action={setProjectSystemAction} className="flex items-center gap-2">
              <input type="hidden" name="request_id" value={r.id} />
              <select
                name="system_code"
                defaultValue={projectSystem ?? ''}
                className="rounded border border-line bg-surface px-2.5 py-1.5 text-sm"
              >
                <option value="">— غير محدّدة —</option>
                {constructionSystems.map((sys) => (
                  <option key={sys.code} value={sys.code}>
                    {sys.name_ar}
                  </option>
                ))}
              </select>
              <button className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand">
                حفظ
              </button>
            </form>
          </div>

          {spanLimits.length === 0 ? (
            <p className="mt-2 text-xs leading-6 text-faint">
              {projectSystem
                ? 'ما ثمّة حدود بحور مسجّلة لسقف هذا النظام — تُضاف من «طرق البناء».'
                : 'حدّد طريقة البناء أوّلاً: حدود السقف تُقرأ من عرض النظام المختار.'}
            </p>
          ) : (
            <>
              <form action={setFloorAssemblyAction} className="mt-3 grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="request_id" value={r.id} />
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">أكبر بحر حرّ (م)</span>
                  <input
                    name="max_span_m"
                    type="number"
                    step="0.01"
                    defaultValue={projectSpan || ''}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">استعمال السقف</span>
                  <select
                    name="floor_usage_code"
                    defaultValue={floorUsage}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  >
                    {floorUsages.map((u) => (
                      <option key={u.usage_code} value={u.usage_code}>
                        {u.usage_ar}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">التركيبة المعتمدة</span>
                  <select
                    name="floor_assembly"
                    defaultValue={chosenAssembly ?? ''}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">— لم تُحدَّد —</option>
                    {assemblyCodes.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">مبرّر القرار</span>
                  <input
                    name="assembly_note"
                    defaultValue={(config?.assembly_note as string | null) ?? ''}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <button className="justify-self-start rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-deep sm:col-span-4">
                  سجّل قرار السقف
                </button>
              </form>

              {/* أين يقف كلّ خيار من الحدّ — بلا أن يقرّر البرنامج */}
              {projectSpan > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  {spanVerdicts.map((v) => (
                    <span
                      key={v.assembly}
                      className={`rounded border px-2 py-1 ${
                        v.assembly === chosenAssembly
                          ? v.fits
                            ? 'border-brand bg-brand-soft text-brand'
                            : 'border-[#8c2f22] bg-[#8c2f22]/10 text-[#8c2f22]'
                          : v.fits
                            ? 'border-line bg-surface'
                            : 'border-line bg-surface text-faint line-through'
                      }`}
                    >
                      <b className="num">{v.assembly}</b>
                      <span className="num ms-1">≤ {formatNumber(v.spanMax, 2)} م</span>
                    </span>
                  ))}
                  {spanSuggestion && spanSuggestion.assembly !== chosenAssembly && (
                    <span className="text-faint">
                      المنصة تقترح <b className="num text-ink">{spanSuggestion.assembly}</b> —
                      والقرار للمهندس
                    </span>
                  )}
                  {!spanSuggestion && (
                    <span className="text-[#8c2f22]">
                      ما من تركيبة في هذا النظام تحتمل بحراً بهذا الطول — يلزم نظام آخر أو
                      تقسيم البحر
                    </span>
                  )}
                </div>
              )}

              {assemblyOutOfRange && (
                <p className="mt-2 rounded border border-[#8c2f22]/40 bg-[#8c2f22]/10 px-3 py-2 text-xs leading-6 text-[#8c2f22]">
                  <b>خارج الحدّ:</b> التركيبة <span className="num">{chosenAssembly}</span> حدّها
                  <span className="num"> {formatNumber(chosenVerdict?.spanMax ?? 0, 2)} م</span> في «
                  {floorUsages.find((u) => u.usage_code === floorUsage)?.usage_ar}»، والبحر
                  المسجّل <span className="num">{formatNumber(projectSpan, 2)} م</span>.
                </p>
              )}

              {chosenAssembly && config?.assembly_at && (
                <p className="mt-2 text-xs text-faint">
                  قرار مسجّل:{' '}
                  <b className="text-muted">
                    {(team ?? []).find(
                      (m: Record<string, unknown>) => m.user_id === config.assembly_by
                    )?.full_name ?? 'عضو الفريق'}
                  </b>{' '}
                  <span className="num">{String(config.assembly_at).slice(0, 10)}</span>
                </p>
              )}
            </>
          )}
        </div>

        <form action={updateProjectConfigAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المساحة المبنية (م²)</span>
            <input
              name="surface_m2"
              type="number"
              defaultValue={config?.surface_m2 ?? r.desired_area_m2 ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المستويات</span>
            <select
              name="levels"
              defaultValue={config?.levels ?? 1}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="1">RDC</option>
              <option value="2">R+1</option>
              <option value="3">R+2</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الغرف</span>
            <input
              name="bedrooms"
              type="number"
              defaultValue={config?.bedrooms ?? r.bedrooms ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الحمّامات</span>
            <input
              name="bathrooms"
              type="number"
              defaultValue={config?.bathrooms ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الصالون</span>
            <input
              name="living_rooms"
              type="number"
              defaultValue={config?.living_rooms ?? 1}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المطبخ</span>
            <input
              name="kitchens"
              type="number"
              defaultValue={config?.kitchens ?? 1}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">مستوى التشطيب</span>
            <select
              name="standing"
              defaultValue={config?.standing ?? r.standing ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {standingLevels.map((lv) => (
                <option key={lv.code} value={lv.code}>
                  {lv.code} · {lv.nameAr}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="garage" defaultChecked={config?.garage} className="size-4 accent-[#1d3a5f]" />
              جراج
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="terrasse" defaultChecked={config?.terrasse} className="size-4 accent-[#1d3a5f]" />
              تراس
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="jardin" defaultChecked={config?.jardin} className="size-4 accent-[#1d3a5f]" />
              حديقة
            </label>
          </div>
          <button className="justify-self-start rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ المواصفات
          </button>
        </form>

        <form action={generateDevisAction} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="id" value={r.id} />
          <button className="rounded border border-brand px-5 py-2 text-sm font-medium text-brand hover:bg-brand-soft">
            ولّد عرضاً تقديرياً
          </button>
          <span className="mr-3 text-xs text-faint">
            من البوردرو الحالي. النسخة السابقة تبقى محفوظة.
          </span>
        </form>

        {latestDevis && (
          <div className="mt-4 rounded border border-line bg-ground p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="num text-sm text-brand" dir="ltr">
                  {(latestDevis as { ref_code: string }).ref_code}
                </span>
                <span className="num mr-2 text-xs text-faint">
                  نسخة {(latestDevis as { version: number }).version}
                </span>
                {devisValidUntil && (
                  <span
                    className={`num mr-2 rounded px-2 py-0.5 text-xs font-medium ${
                      devisExpired
                        ? 'bg-gold-soft text-gold'
                        : 'bg-brand-soft text-brand'
                    }`}
                  >
                    {devisExpired
                      ? `انتهت صلاحيته في ${devisValidUntil}`
                      : `صالح إلى ${devisValidUntil}`}
                  </span>
                )}
              </div>
              <div className="num text-xl font-semibold text-brand">{formatTND(devisTotal)}</div>
            </div>

            {devisSurface > 0 && devisTotal > 0 && (
              <div className="num mt-1 text-xs text-muted">
                {formatNumber(Math.round(devisTotal / devisSurface))} د/م² على {devisSurface} م²
              </div>
            )}

            {devisLots.size > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {[...devisLots.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([code, lot]) => (
                    <li key={code} className="flex items-baseline justify-between gap-3">
                      <span>
                        <span className="num text-xs text-faint">{code}</span> {lot.name}
                      </span>
                      <span className="num text-muted">{formatTND(lot.total)}</span>
                    </li>
                  ))}
              </ul>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted hover:text-brand">
                تفصيل المقالات ({lineRows.length})
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="bg-surface-2">
                      <th className="px-2 py-2 text-right font-semibold text-muted">المقال</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted">الكمّية</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted">سعر الوحدة</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.map((l) => (
                      <tr key={l.id} className="border-t border-line">
                        <td className="px-2 py-1.5">{l.designation_ar}</td>
                        <td className="num px-2 py-1.5">{formatNumber(Number(l.quantity), 2)}</td>
                        <td className="num px-2 py-1.5">{formatNumber(Number(l.pu_total_ht), 3)}</td>
                        <td className="num px-2 py-1.5">{formatTND(Number(l.total_ht))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="mt-4 border-t border-line pt-3 text-xs leading-6 text-faint">
              عرض تقديري أوّلي دون احتساب الأداءات (HT)، غير ملزم. الأسعار مجمّدة وقت التوليد.
              {devisValidUntil && !devisExpired && devisDaysLeft !== null && (
                <> صالح {devisDaysLeft === 0 ? 'اليوم فقط' : `${devisDaysLeft} يوماً أخرى`}.</>
              )}
              {devisExpired && (
                <> <b className="text-gold">انتهت صلاحيته — ولّد نسخة جديدة بالأسعار الحالية.</b></>
              )}
            </p>
          </div>
        )}

        {!latestDevis && (
          <p className="mt-4 text-xs text-faint">
            ما فمّاش عرض بعد. عمّر المواصفات ثمّ ولّد — وإذا ما تولّد شي، معناها البوردرو مازال
            فارغ من المقالات.
          </p>
        )}
      </div>

      {/* تصنيف الدراسة — Module 2 */}
      <div id="sec-study" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>تصنيف الدراسة</h2>
        <p className="mt-1 text-xs text-muted">
          التصنيف بلا سبب ما ينفعش. اكتب علاش صُنّف الملفّ هكذا وشنوّة الخطوة اللي يستنّاها.
        </p>
        <form action={updateStudyTrackAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المسار</span>
            <select
              name="study_track"
              defaultValue={r.study_track ?? ''}
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">— غير مصنّف —</option>
              {Object.entries(STUDY_TRACKS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="mb-1.5 block text-xs text-muted">سبب التصنيف</span>
            <input
              name="track_reason"
              defaultValue={r.track_reason ?? ''}
              placeholder="مثال: الأرض على الشياع، لازم تسوية قبل أيّ دراسة فنية"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* المسار الاجتماعي — Module 7 */}
      <div id="sec-social" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>المسار الاجتماعي</h2>
          {social?.is_priority && (
            <span className="rounded bg-gold-soft px-2.5 py-1 text-xs font-medium text-gold">
              أولوية دراسة
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-6 text-muted">
          مؤشّرات لترتيب أولوية الدراسة، <b>موش للحكم الآلي على الناس</b>. الأولوية يقرّرها الفريق
          بعد الدراسة.
        </p>
        <form action={updateSocialAssessmentAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">عدد أفراد العائلة</span>
            <input
              name="household_size"
              type="number"
              defaultValue={social?.household_size ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">عدد المُعالين</span>
            <input
              name="dependents"
              type="number"
              defaultValue={social?.dependents ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">وضعية السكن الحالية</span>
            <select
              name="housing_condition"
              defaultValue={social?.housing_condition ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {Object.entries(HOUSING_CONDITIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">استقرار الدخل</span>
            <select
              name="income_stability"
              defaultValue={social?.income_stability ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {Object.entries(INCOME_STABILITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              name="has_disability"
              defaultChecked={social?.has_disability ?? false}
              className="size-4 accent-[#1d3a5f]"
            />
            إعاقة في العائلة
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              name="is_priority"
              defaultChecked={social?.is_priority ?? false}
              className="size-4 accent-[#1d3a5f]"
            />
            أولوية دراسة
          </label>
          <label className="block sm:col-span-3">
            <span className="mb-1.5 block text-xs text-muted">ملاحظات</span>
            <input
              name="notes"
              defaultValue={social?.notes ?? ''}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <button className="justify-self-start rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* دراسة طلب المساندة — الأهلية ومدى الصحّة والقرار */}
      {(r.study_track === 'social' || assessment) && (
        <div id="sec-assess" className="mt-4 scroll-mt-32 rounded-xl border border-brand/40 bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className={H2}>دراسة طلب المساندة</h2>
            {assessment && (
              <span className="text-xs text-muted">
                آخر دراسة: <b className="num">{assessment.total}</b>/100 ·{' '}
                {BAND_AR[assessment.band as Band]} · {DECISION_AR[assessment.decision as Decision]}
                {assessment.decided_at && (
                  <span className="num text-faint"> · {new Date(assessment.decided_at).toLocaleDateString('fr-TN')}</span>
                )}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-6 text-muted">
            ستّة معايير بوصف مكتوب لكلّ درجة حتى يحكم مستشاران بنفس الميزان، وحاجز صحّة: لا «أولوية»
            بلا وثيقة أو زيارة، ولا فوق «للمراجعة» مع تناقض مرصود. الدرجة تعاون القرار — والقرار لك،
            وبسبب مكتوب. الأوزان في «المعطيات المرجعية».
          </p>
          {canEdit ? (
            <SupportAssessmentForm
              requestId={r.id}
              existing={assessment}
              weights={assessmentConfig.weights}
              thresholds={assessmentConfig.thresholds}
            />
          ) : (
            <p className="mt-3 text-xs text-faint">القراءة فقط — الدراسة تستوجب صلاحية التحيين.</p>
          )}
        </div>
      )}

      {/* المساندة ودفتر الشفافية — Module 12-bis */}
      <div id="sec-support" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={H2}>المساندة ودفتر الشفافية</h2>
          <Link
            href={`/admin/support?request=${id}`}
            className="text-xs text-brand hover:underline"
          >
            {supportCase ? 'افتح الدفتر ←' : 'افتح حالة مساندة ←'}
          </Link>
        </div>

        {supportCase ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded px-2 py-0.5 ${
                  supportCase.consent_given ? 'bg-brand-soft text-brand' : 'bg-gold-soft text-gold'
                }`}
              >
                {supportCase.consent_given ? 'موافقة صاحب الحالة موجودة' : 'بلا موافقة'}
              </span>
              <span
                className={`rounded px-2 py-0.5 ${
                  supportCase.published ? 'bg-brand-soft text-brand' : 'text-faint'
                }`}
              >
                {supportCase.published ? 'منشورة للعموم' : 'غير منشورة'}
              </span>
            </div>

            {(supportLedger ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-faint">ما فمّا حتّى قيد في الدفتر توّا.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-1.5 text-sm">
                {(supportLedger ?? []).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="rounded border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      {LEDGER_EVENT_LABELS[l.event] ?? l.event}
                    </span>
                    <span className="num text-xs text-faint">{l.occurred_at}</span>
                    <span>{l.label}</span>
                    {l.partner_public && (
                      <span className="text-xs text-muted">— {l.partner_public}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs leading-6 text-muted">
            كي المسار التجاري وحده ما يكفيش، افتح حالة مساندة: نسجّلو الحاجيات وما يوصل في سجلّ
            ما يتعدّلش. <b>المنصة ما تجمعش أموالاً</b> — المساندة عينية.
          </p>
        )}
      </div>

      {/* عناصر الحلّ — Module 7/8 */}
      <div id="sec-solution" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>عناصر الحلّ</h2>
        <p className="mt-1 text-xs text-muted">
          أرض + تمويل + مواد + مقاول + دعم = حلّ سكني محتمل. كل عنصر مع الجهة اللي باش تساهم فيه.
        </p>

        <form action={addContributionAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">النوع</span>
            <select name="kind" className="rounded border border-line bg-surface px-3 py-2 text-sm">
              {Object.entries(CONTRIBUTION_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1.5 block text-xs text-muted">الوصف</span>
            <input
              name="label"
              placeholder="مثال: 200 كيس إسمنت من مزوّد شريك"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">القيمة (د.ت)</span>
            <input
              name="value_tnd"
              type="number"
              className="w-32 rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الشريك</span>
            <select
              name="partner_id"
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              {(partners ?? []).map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {pp.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand">
            زيد
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {(contributions ?? []).length === 0 && (
            <li className="text-sm text-faint">ما فمّاش عنصر مسجّل.</li>
          )}
          {(contributions ?? []).map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-line px-3 py-2 text-sm"
            >
              <span>
                <span className="text-xs text-gold">{CONTRIBUTION_KINDS[c.kind] ?? c.kind}</span>{' '}
                {c.label}
                {c.value_tnd ? (
                  <span className="num mr-2 text-xs text-muted">
                    {formatTND(Number(c.value_tnd))}
                  </span>
                ) : null}
              </span>
              <form action={updateContributionAction} className="flex items-center gap-2">
                <input type="hidden" name="contribution_id" value={c.id} />
                <input type="hidden" name="request_id" value={r.id} />
                <select
                  name="status"
                  defaultValue={c.status}
                  className="rounded border border-line bg-surface px-2 py-1 text-xs"
                >
                  {Object.entries(CONTRIBUTION_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="rounded border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand">
                  حفظ
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {/* المهامّ — Module 8 */}
      <div id="sec-tasks" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>مهامّ الحلّ</h2>
        <p className="mt-1 text-xs text-muted">
          الحلّ يتقسّم مهامّ، وكل مهمّة تتسنّد لجهة معنيّة ويتّبع الفريق تقدّمها.
        </p>

        <form action={addTaskAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1.5 block text-xs text-muted">المهمّة</span>
            <input
              name="title"
              placeholder="مثال: تسريع رخصة البناء لدى البلدية"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الجهة</span>
            <select
              name="partner_id"
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              {(partners ?? []).map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {pp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الأجل</span>
            <input
              name="due_at"
              type="date"
              className="num rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand">
            زيد
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {(tasks ?? []).length === 0 && <li className="text-sm text-faint">ما فمّاش مهمّة.</li>}
          {(tasks ?? []).map((tk) => (
            <li
              key={tk.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-line px-3 py-2 text-sm"
            >
              <span>
                {tk.title}
                {tk.due_at && <span className="num mr-2 text-xs text-faint">{tk.due_at}</span>}
              </span>
              <form action={updateTaskAction} className="flex items-center gap-2">
                <input type="hidden" name="task_id" value={tk.id} />
                <input type="hidden" name="request_id" value={r.id} />
                <select
                  name="status"
                  defaultValue={tk.status}
                  className="rounded border border-line bg-surface px-2 py-1 text-xs"
                >
                  {Object.entries(TASK_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="rounded border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand">
                  حفظ
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {/* العروض المقترحة — Matching Engine */}
      <div id="sec-offers" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>عروض عقارية مقترحة</h2>
          <span className="text-xs text-muted">
            {suggestions.length} اقتراح من {propertyPool.length} عرض مراجَع
          </span>
        </div>
        <p className="mt-2 text-xs leading-6 text-muted">
          المحرّك يقترح ويفسّر، والقرار للفريق. العروض غير المراجَعة والخارجة عن الولاية أو الميزانية
          مستبعَدة آلياً.
        </p>

        {suggestions.length === 0 && (
          <p className="mt-4 text-sm text-faint">
            ما فمّاش عرض يناسب هالملفّ توّا. كي يسجّل مالك عقاراً في نفس المنطقة يظهر هنا.
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {suggestions.map((m) => {
            const prop = propertyById.get(m.propertyId)
            const meta = propertyRefById.get(m.propertyId)
            const saved = savedIds.has(m.propertyId)
            return (
              <li key={m.propertyId} className="rounded border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="num text-sm text-brand" dir="ltr">
                      {meta?.ref}
                    </span>
                    <div className="mt-0.5 text-sm text-muted">
                      {prop?.kind === 'land' ? 'أرض' : prop?.kind === 'house' ? 'دار' : 'شقة'}
                      {prop?.areaM2 ? ` · ${formatNumber(prop.areaM2)} م²` : ''}
                      {prop?.priceTnd ? ` · ${formatTND(prop.priceTnd)}` : ''}
                      {meta?.address ? ` · ${meta.address}` : ''}
                    </div>
                  </div>
                  <span className="num rounded bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
                    {formatPercent(Number(m.score))}
                  </span>
                </div>

                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {m.reasons
                    .filter((reason) => reason.points > 0)
                    .map((reason) => (
                      <li key={reason.key}>
                        — {reason.ar} <span className="num">({reason.points}/{reason.weight})</span>
                      </li>
                    ))}
                </ul>

                {saved ? (
                  <span className="mt-3 inline-block rounded bg-surface-2 px-3 py-1 text-xs text-muted">
                    محفوظ للمتابعة
                  </span>
                ) : (
                  <form action={saveMatchAction} className="mt-3">
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="property_id" value={m.propertyId} />
                    <input type="hidden" name="score" value={m.score} />
                    <input type="hidden" name="reasons" value={JSON.stringify(m.reasons)} />
                    <button className="rounded border border-line px-4 py-1.5 text-xs hover:border-brand hover:text-brand">
                      احفظ للمتابعة
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>

        {(savedMatches ?? []).length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-xs font-semibold text-muted">عروض محفوظة</h3>
            <ul className="mt-3 space-y-2">
              {((savedMatches ?? []) as {
                id: string
                property_id: string
                score: number
                status: string
                note: string | null
              }[]).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="num text-brand" dir="ltr">
                    {propertyRefById.get(m.property_id)?.ref ?? m.property_id.slice(0, 8)}
                  </span>
                  <span className="num text-xs text-muted">{formatPercent(Number(m.score))}</span>
                  <form action={updateMatchAction} className="flex items-center gap-2">
                    <input type="hidden" name="match_id" value={m.id} />
                    <input type="hidden" name="request_id" value={r.id} />
                    <select
                      name="status"
                      defaultValue={m.status}
                      className="rounded border border-line bg-surface px-2 py-1 text-xs"
                    >
                      <option value="suggested">مقترح</option>
                      <option value="shortlisted">محفوظ للمتابعة</option>
                      <option value="proposed">عُرض على الحريف</option>
                      <option value="accepted">قبله الحريف</option>
                      <option value="rejected">رفضه الحريف</option>
                    </select>
                    <button className="rounded border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand">
                      حفظ
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ما يراه الحريف في صفحة المتابعة */}
      <div id="sec-public" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={H2}>ما يراه الحريف في صفحة المتابعة</h2>
          <span className="rounded bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            {PUBLIC_STATE_AR[publicStateOf(r.status)]}
          </span>
        </div>
        <p className="mt-2 text-xs leading-6 text-muted">
          هذا النصّ يظهر للحريف كما هو. الملاحظات الداخلية تحت ما تظهرش ليه.
        </p>
        <form action={updatePublicUpdateAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">آخر تحيين</span>
            <input
              name="public_update"
              defaultValue={r.public_update ?? ''}
              placeholder="مثال: تمت مراجعة المعطيات العقارية والمالية"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المرحلة القادمة</span>
            <input
              name="public_next_step"
              defaultValue={r.public_next_step ?? ''}
              placeholder="مثال: التواصل مع الحريف لاستكمال الملفّ"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
              حفظ
            </button>
            {r.public_updated_at && (
              <span className="num text-xs text-faint">
                آخر تحيين معروض: {new Date(r.public_updated_at).toLocaleDateString('fr-TN')}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* تصنيف الملفّ */}
      <div id="sec-classify" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>تصنيف الملفّ</h2>
        <form action={updateClassificationAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={r.id} />
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">نوع الإشكال</span>
            <select
              name="problem_type"
              defaultValue={r.problem_type ?? ''}
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">— غير مصنّف —</option>
              {Object.entries(PROBLEM_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">وضع التمويل</span>
            <select
              name="financing_state"
              defaultValue={r.financing_state ?? 'not_started'}
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              {Object.entries(FINANCING_STATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المسؤول على الملفّ</span>
            <select
              name="assigned_to"
              defaultValue={r.assigned_to ?? ''}
              className="rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">— غير مسنَد —</option>
              {(team ?? []).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* المتابعة: الإجراء القادم وصيغة التمويل */}
      <div id="sec-followup" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>المتابعة</h2>
        {canEdit && (
          <form action={updateFollowUpAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <label className="block min-w-[220px] flex-1">
              <span className="mb-1.5 block text-xs text-muted">الإجراء الواجب اتخاذه</span>
              <input
                name="next_action"
                defaultValue={r.next_action ?? ''}
                placeholder="مثال: نعاودو نتّصلو بيه كي يجيب الرسم العقاري"
                className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">التاريخ</span>
              <input
                type="date"
                name="next_action_at"
                defaultValue={r.next_action_at ?? ''}
                className="num rounded border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">صيغة التمويل المقترحة</span>
              <select
                name="financing_id"
                defaultValue={r.financing_id ?? ''}
                className="rounded border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">— بلا —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bank} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
              حفظ
            </button>
          </form>
        )}
      </div>

      {/* الأسئلة والمشاكل والاعتراضات */}
      <div id="sec-inquiries" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={H2}>استفسارات الحريف ومشاكله</h2>
          <span className="text-xs text-muted">
            {(interactions ?? []).filter((i) => !i.resolved).length} مفتوح
          </span>
        </div>

        {canEdit && (
          <form action={addInteractionAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">النوع</span>
              <select name="kind" className="rounded border border-line bg-surface px-3 py-2 text-sm">
                {Object.entries(KIND_AR).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[240px] flex-1">
              <span className="mb-1.5 block text-xs text-muted">النصّ</span>
              <input
                name="body"
                placeholder="مثال: يسأل إذا ينجّم يبدّل المساحة بعد التعاقد"
                className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <button className="rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand">
              سجّل
            </button>
          </form>
        )}

        <ul className="mt-5 space-y-3">
          {(interactions ?? []).length === 0 && (
            <li className="text-sm text-faint">ما فمّا حتّى استفسار مسجّل.</li>
          )}
          {(interactions ?? []).map((it) => (
            <li
              key={it.id}
              className={`rounded border p-4 ${
                it.resolved ? 'border-line bg-surface-2' : 'border-gold-light bg-gold-soft'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-gold">
                  {KIND_AR[it.kind] ?? it.kind}
                </span>
                <span className="num text-xs text-faint">
                  {new Date(it.created_at).toLocaleDateString('fr-TN')}
                </span>
              </div>
              <p className="mt-1 text-sm leading-7">{it.body}</p>
              {it.answer && (
                <p className="mt-2 border-t border-line pt-2 text-sm leading-7 text-muted">
                  الجواب: {it.answer}
                </p>
              )}
              {!it.resolved && canEdit && (
                <form action={resolveInteractionAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="interaction_id" value={it.id} />
                  <input
                    name="answer"
                    placeholder="الجواب أو الحلّ"
                    className="min-w-[200px] flex-1 rounded border border-line bg-surface px-3 py-1.5 text-sm"
                  />
                  <button className="rounded bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-deep">
                    سدّ
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* الوثائق */}
      <div id="sec-docs" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>الوثائق المتوفّرة</h2>
        {/* «قال عندو» و«شفناها» ليسا نفس الشيء: التأشيرة تثبّتك أنت،
            والوسم الذهبي تصريح صاحب الملفّ في الاستمارة. */}
        <p className="mt-1 text-xs leading-6 text-muted">
          الوسم «صرّح بها» يجي من الاستمارة. التأشيرة تبقى تثبّتك أنت.
        </p>
        {docMissing.length > 0 && (
          <p className="mt-3 rounded border border-gold/40 bg-gold-soft px-3 py-2 text-xs leading-6 text-gold">
            ينقص من الضروري: {docMissing.map((d) => d.nameAr).join('، ')}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {docSections.map((section) => (
            <div key={section.group}>
              <div className="mb-2 text-xs font-medium text-faint">
                {DOC_GROUP_LABELS[section.group]}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.docs.map((d) => {
                  const rec = (docs ?? []).find(
                    (x) => x.doc_code === d.code || x.doc_type === d.nameAr
                  )
                  return (
                    <form
                      key={d.code}
                      action={toggleDocumentAction}
                      className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="doc_type" value={d.nameAr} />
                      <input type="hidden" name="doc_code" value={d.code} />
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        {d.nameAr}
                        {d.required && (
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                            ضرورية
                          </span>
                        )}
                        {rec?.declared && (
                          <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[11px] text-gold">
                            صرّح بها
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="available"
                          defaultChecked={rec?.available ?? false}
                          className="size-4 accent-[#1d3a5f]"
                        />
                        <button className="rounded border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand">
                          حفظ
                        </button>
                      </span>
                    </form>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* أوراق صُرّح بها ثمّ تبدّل الملفّ فما عادتش تخصّه — نعرضها
            حتى لا تختفي تثبّتات الفريق من الشاشة بلا خبر */}
        {docExtra.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-faint">خارج قائمة هذا الملفّ</div>
            <ul className="flex flex-wrap gap-2 text-xs text-muted">
              {docExtra.map((x) => (
                <li key={x.id} className="rounded border border-line px-2 py-1">
                  {x.doc_type}
                  {x.available ? ' · متوفّرة' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <RequestFiles
          requestId={r.id}
          docTypes={applicableDocs.map((d) => d.nameAr)}
          files={(requestFiles ?? []) as RequestFile[]}
        />
      </div>

      {/* السجلّ */}
      <div id="sec-log" className="mt-4 scroll-mt-32 rounded-xl border border-line bg-surface p-4">
        <h2 className={H2}>سجلّ الأثر</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-3 border-b border-line pb-2">
              <span>
                {e.note ?? e.event_type}
                {e.from_status && e.to_status && (
                  <span className="text-muted">
                    {' '}
                    — {LABELS.status[e.from_status]} ← {LABELS.status[e.to_status]}
                  </span>
                )}
              </span>
              <span className="num text-xs text-faint">
                {new Date(e.created_at).toLocaleString('fr-TN')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className={`mb-4 ${H2}`}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-1.5 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  )
}
