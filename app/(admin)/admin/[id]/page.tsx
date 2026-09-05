import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db, getFinancingProducts } from '@/lib/supabase/server'
import { LABELS } from '@/lib/schema'
import { formatTND } from '@/lib/finance'
import { labelEmployment, seniorityYearsLabel } from '@/lib/scoring'
import { publicStateOf } from '@/lib/public-state'
import { rankProperties, type MatchProperty } from '@/lib/matching'
import { formatNumber } from '@/lib/format'
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

const HOUSING_CONDITIONS: Record<string, string> = {
  unsafe: 'مسكن غير آمن',
  overcrowded: 'اكتظاظ',
  rented_unstable: 'كراء غير مستقرّ',
  with_family: 'عند العائلة',
  homeless: 'بلا مأوى',
  other: 'أخرى',
}

const INCOME_STABILITY: Record<string, string> = {
  none: 'بلا دخل',
  irregular: 'دخل غير منتظم',
  low_stable: 'دخل ضعيف لكن قارّ',
  other: 'أخرى',
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

const DOC_TYPES = [
  'بطاقة تعريف',
  'شهادة في العمل',
  'كشف حساب بنكي',
  'رسم عقاري / عقد ملكية',
  'رخصة بناء',
  'أمثلة ودراسات',
]

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')
  const { id } = await params

  const { data: r } = await db.from('housing_requests').select('*').eq('id', id).maybeSingle()
  if (!r) notFound()

  const [
    { data: fin },
    { data: land },
    { data: score },
    { data: events },
    { data: interactions },
    { data: docs },
    { data: social },
    { data: contributions },
    { data: tasks },
    { data: partners },
    { data: team },
    { data: approvedProperties },
    { data: savedMatches },
    products,
    { data: geo },
  ] = await Promise.all([
    db.from('financial_profiles').select('*').eq('request_id', id).maybeSingle(),
    db.from('request_land').select('*').eq('request_id', id).maybeSingle(),
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
    db.from('social_assessments').select('*').eq('request_id', id).maybeSingle(),
    db.from('contributions').select('*').eq('request_id', id).order('created_at'),
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
  ])

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

  const criteria = ((score?.breakdown as { criteria?: Criterion[] } | null)?.criteria ?? []) as Criterion[]

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-green">
        ← رجوع للقائمة
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="num text-2xl font-semibold text-green" dir="ltr">
            {r.ref_code}
          </div>
          <h1 className="display mt-1 text-xl font-semibold">{r.full_name}</h1>
          <div className="num mt-1 text-sm text-muted" dir="ltr">
            {r.phone} {r.email ? `· ${r.email}` : ''}
          </div>
        </div>
        {score && (
          <div className="rounded border border-line bg-surface px-5 py-3 text-center">
            <div className="text-xs text-muted">التنقيط</div>
            <div className="num text-2xl font-semibold text-green">
              {score.band} · {score.total}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="المطلب">
          <Row k="النوع" v={LABELS.requestType[r.request_type] ?? r.request_type} />
          <Row k="الولاية" v={r.gov_code === 'SFX' ? 'صفاقس' : r.gov_code} />
          <Row k="المعتمدية" v={(geo as GeoRow | null)?.delegations?.name_ar ?? '—'} />
          <Row k="العمادة" v={(geo as GeoRow | null)?.imadas?.name_ar ?? '—'} />
          <Row k="موقع الأرض" v={r.land_location || '—'} />
          <Row k="المساحة" v={r.desired_area_m2 ? `${r.desired_area_m2} م²` : '—'} />
          <Row k="عدد الغرف" v={r.bedrooms ? String(r.bedrooms) : '—'} />
          <Row k="مستوى التشطيب" v={LABELS.standing[r.standing] ?? '—'} />
          <Row k="الأفق الزمني" v={LABELS.horizon[r.horizon] ?? '—'} />
          <Row k="الحالة" v={LABELS.status[r.status] ?? r.status} />
          <Row k="تاريخ التسجيل" v={new Date(r.created_at).toLocaleString('fr-TN')} />
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
                      className="h-1.5 rounded-full bg-green"
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
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">تحيين الحالة</h2>
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
            <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
              حفظ
            </button>
          </form>
        )}
      </div>

      {/* تصنيف الدراسة — Module 2 */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">تصنيف الدراسة</h2>
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
          <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* المسار الاجتماعي — Module 7 */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">المسار الاجتماعي</h2>
          {social?.is_priority && (
            <span className="rounded bg-bronze-soft px-2.5 py-1 text-xs font-medium text-bronze">
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
              className="size-4 accent-[#0e5138]"
            />
            إعاقة في العائلة
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              name="is_priority"
              defaultChecked={social?.is_priority ?? false}
              className="size-4 accent-[#0e5138]"
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
          <button className="justify-self-start rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* عناصر الحلّ — Module 7/8 */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">عناصر الحلّ</h2>
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
          <button className="rounded border border-line px-4 py-2 text-sm hover:border-green hover:text-green">
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
                <span className="text-xs text-bronze">{CONTRIBUTION_KINDS[c.kind] ?? c.kind}</span>{' '}
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
                <button className="rounded border border-line px-2 py-1 text-xs hover:border-green hover:text-green">
                  حفظ
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {/* المهامّ — Module 8 */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">مهامّ الحلّ</h2>
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
          <button className="rounded border border-line px-4 py-2 text-sm hover:border-green hover:text-green">
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
                <button className="rounded border border-line px-2 py-1 text-xs hover:border-green hover:text-green">
                  حفظ
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {/* العروض المقترحة — Matching Engine */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">عروض عقارية مقترحة</h2>
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
                    <span className="num text-sm text-green" dir="ltr">
                      {meta?.ref}
                    </span>
                    <div className="mt-0.5 text-sm text-muted">
                      {prop?.kind === 'land' ? 'أرض' : prop?.kind === 'house' ? 'دار' : 'شقة'}
                      {prop?.areaM2 ? ` · ${formatNumber(prop.areaM2)} م²` : ''}
                      {prop?.priceTnd ? ` · ${formatTND(prop.priceTnd)}` : ''}
                      {meta?.address ? ` · ${meta.address}` : ''}
                    </div>
                  </div>
                  <span className="num rounded bg-green-soft px-3 py-1 text-sm font-semibold text-green">
                    {m.score}%
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
                    <button className="rounded border border-line px-4 py-1.5 text-xs hover:border-green hover:text-green">
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
                  <span className="num text-green" dir="ltr">
                    {propertyRefById.get(m.property_id)?.ref ?? m.property_id.slice(0, 8)}
                  </span>
                  <span className="num text-xs text-muted">{m.score}%</span>
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
                    <button className="rounded border border-line px-2 py-1 text-xs hover:border-green hover:text-green">
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
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">ما يراه الحريف في صفحة المتابعة</h2>
          <span className="rounded bg-green-soft px-2.5 py-1 text-xs font-medium text-green">
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
            <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
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
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">تصنيف الملفّ</h2>
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
          <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
            حفظ
          </button>
        </form>
      </div>

      {/* المتابعة: الإجراء القادم وصيغة التمويل */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">المتابعة</h2>
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
            <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
              حفظ
            </button>
          </form>
        )}
      </div>

      {/* الأسئلة والمشاكل والاعتراضات */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">استفسارات الحريف ومشاكله</h2>
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
            <button className="rounded border border-line px-4 py-2 text-sm hover:border-green hover:text-green">
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
                it.resolved ? 'border-line bg-surface-2' : 'border-bronze-light bg-bronze-soft'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-bronze">
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
                  <button className="rounded bg-green px-4 py-1.5 text-xs font-medium text-white hover:bg-green-deep">
                    سدّ
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* الوثائق */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">الوثائق المتوفّرة</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DOC_TYPES.map((d) => {
            const rec = (docs ?? []).find((x) => x.doc_type === d)
            return (
              <form
                key={d}
                action={toggleDocumentAction}
                className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2"
              >
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="doc_type" value={d} />
                <span className="text-sm">{d}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="available"
                    defaultChecked={rec?.available ?? false}
                    className="size-4 accent-[#0e5138]"
                  />
                  <button className="rounded border border-line px-2 py-1 text-xs hover:border-green hover:text-green">
                    حفظ
                  </button>
                </span>
              </form>
            )
          })}
        </div>
      </div>

      {/* السجلّ */}
      <div className="mt-6 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">سجلّ الأثر</h2>
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
    <div className="rounded border border-line bg-surface p-6">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
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
