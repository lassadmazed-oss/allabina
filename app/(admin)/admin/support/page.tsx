import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  addLedgerEntryAction,
  updatePledgeAction,
  upsertSupportCaseAction,
} from '@/lib/actions/support'
import { CONTRIBUTION_KINDS, LEDGER_EVENTS, needsProgress } from '@/lib/support'
import { formatMoney } from '@/lib/format'
import { BAND_AR, DECISION_AR, type Band, type Decision } from '@/lib/support-assessment'

const URGENCY_AR: Record<string, string> = {
  planning: 'يخطّط',
  within_year: 'خلال سنة',
  urgent: 'مستعجل',
  critical: 'حرج',
}
const BAND_CLS: Record<string, string> = {
  priority: 'bg-brand text-white',
  eligible: 'bg-brand-soft text-brand',
  review: 'bg-gold-soft text-gold',
  not_eligible: 'bg-surface-2 text-muted',
}

type InboxRow = {
  id: string
  ref_code: string
  full_name: string
  delegation_id: number | null
  urgency: string | null
  status: string
  problem_note: string | null
  created_at: string
  is_demo: boolean
  total: number | null
  band: string | null
  decision: string | null
  decided_at: string | null
  inconsistencies_found: boolean | null
  checks_done: number | null
}

export const metadata = { title: 'المساندة ودفتر الشفافية — اللَّبنة' }
export const dynamic = 'force-dynamic'

const KIND_LABELS: Record<string, string> = {
  land: 'أرض',
  funding: 'مساهمة مالية',
  materials: 'مواد بناء',
  labour: 'يد عاملة',
  study: 'دراسة',
  admin_support: 'دعم إداري',
  other: 'أخرى',
}

const EVENT_LABELS: Record<string, string> = {
  needed: 'مطلوب',
  pledged: 'تعهّد',
  confirmed: 'مؤكّد',
  delivered: 'وصل',
  cancelled: 'ملغى',
}

const PLEDGE_STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  contacted: 'اتّصلنا بيه',
  accepted: 'قبلناه',
  declined: 'اعتذرنا',
}

type SupportCase = {
  id: string
  request_id: string
  title_ar: string
  summary_ar: string
  delegation_id: number | null
  consent_given: boolean
  published: boolean
  anonymised: boolean
  closed_at: string | null
}

type LedgerRow = {
  id: number
  request_id: string
  event: string
  label: string
  kind: string | null
  quantity_note: string | null
  value_tnd: number | null
  partner_public: string | null
  need_id: number | null
  occurred_at: string
  note: string | null
}

type Pledge = {
  id: string
  support_case_id: string | null
  full_name: string
  phone: string
  email: string | null
  kind: string
  label: string
  note: string | null
  status: string
  created_at: string
}

export default async function SupportAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>
}) {
  await requirePermission('requests.update')
  const { request: prefillRequestId } = await searchParams

  const [{ data: casesRaw }, { data: pledgesRaw }, { data: delegs }, { data: partners }, { data: inboxRaw }] =
    await Promise.all([
      db.from('support_cases').select('*').order('created_at', { ascending: false }),
      db.from('support_pledges').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX').order('id'),
      db.from('partners').select('id, name').order('name'),
      db.from('support_inbox').select('*').order('created_at', { ascending: false }).limit(200),
    ])

  const cases = (casesRaw ?? []) as SupportCase[]
  const pledges = (pledgesRaw ?? []) as Pledge[]
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))

  const requestIds = cases.map((c) => c.request_id)
  const { data: ledgerRaw } = requestIds.length
    ? await db
        .from('support_ledger')
        .select('*')
        .in('request_id', requestIds)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
    : { data: [] }

  const ledger = (ledgerRaw ?? []) as LedgerRow[]
  const byRequest = new Map<string, LedgerRow[]>()
  for (const row of ledger) {
    const list = byRequest.get(row.request_id) ?? []
    list.push(row)
    byRequest.set(row.request_id, list)
  }

  const newPledges = pledges.filter((p) => p.status === 'new')

  // قائمة العمل: الحرج أوّلاً، ثمّ ما لم يُدرَس، ثمّ الأقدم
  const URG_RANK: Record<string, number> = { critical: 3, urgent: 2, within_year: 1, planning: 0 }
  const inbox = ((inboxRaw ?? []) as InboxRow[]).sort((a, b) => {
    const u = (URG_RANK[b.urgency ?? ''] ?? 0) - (URG_RANK[a.urgency ?? ''] ?? 0)
    if (u) return u
    const d = Number(!!a.decision && a.decision !== 'pending') - Number(!!b.decision && b.decision !== 'pending')
    if (d) return d
    return a.created_at.localeCompare(b.created_at)
  })
  const undecided = inbox.filter((x) => !x.decision || x.decision === 'pending').length

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-2 text-2xl font-semibold">المساندة ودفتر الشفافية</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        ملفّات ما كفاش فيها المسار التجاري وحده. <b>دفتر الشفافية سجلّ إضافي</b>: ما يتعدّلش وما
        يتحذفش — القاعدة نفسها ترفض. التصحيح يكون بقيد جديد. والصفحة العمومية تعرض{' '}
        <b>أعداد الحاجيات لا مبالغ</b>؛ القيمة التقديرية تحت للاستعمال الداخلي فقط.
      </p>

      {/* قائمة عمل المساندة — طلبات «اطلب مساندة» بدرجتها وقرارها */}
      <section className="mt-8 rounded border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">
            طلبات المساندة الواردة
            {undecided > 0 && (
              <span className="num ms-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs text-gold">
                {undecided} بلا قرار
              </span>
            )}
          </h2>
          <span className="text-xs text-faint">الحرج أوّلاً · ثمّ ما لم يُدرَس · ثمّ الأقدم</span>
        </div>
        {inbox.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">ما فمّاش طلب مساندة توّا.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <Th>الرمز</Th>
                  <Th>الاسم</Th>
                  <Th>المعتمدية</Th>
                  <Th>الاستعجال</Th>
                  <Th>الحاجة</Th>
                  <Th>الدرجة</Th>
                  <Th>التثبّت</Th>
                  <Th>القرار</Th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((x) => (
                  <tr key={x.id} className="border-t border-line align-top">
                    <td className="num px-4 py-3">
                      <Link href={`/admin/${x.id}`} className="text-brand hover:underline">
                        {x.ref_code}
                      </Link>
                      {x.is_demo && <span className="ms-1 text-[10px] text-gold">تجريبي</span>}
                    </td>
                    <td className="px-4 py-3">{x.full_name}</td>
                    <td className="px-4 py-3 text-xs">{x.delegation_id ? delegName.get(x.delegation_id) ?? '—' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${x.urgency === 'critical' ? 'bg-[#fbeeeb] text-[#8c2f22]' : x.urgency === 'urgent' ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-muted'}`}>
                        {URGENCY_AR[x.urgency ?? ''] ?? '—'}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs leading-5 text-muted">
                      {x.problem_note ? (x.problem_note.length > 110 ? x.problem_note.slice(0, 110) + '…' : x.problem_note) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {x.band ? (
                        <span className={`rounded px-2 py-0.5 text-xs ${BAND_CLS[x.band]}`}>
                          <span className="num">{x.total}</span> · {BAND_AR[x.band as Band]}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">لم يُدرَس</span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-xs">
                      {x.checks_done ?? 0}/4
                      {x.inconsistencies_found && <span className="ms-1 text-[#8c2f22]" title="تناقض مرصود">⚠</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {x.decision && x.decision !== 'pending' ? DECISION_AR[x.decision as Decision] : <span className="text-gold">بانتظار القرار</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* صندوق التعهّدات الواردة */}
      <section className="mt-8 rounded border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">
            تعهّدات واردة من العموم
            {newPledges.length > 0 && (
              <span className="num ms-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs text-gold">
                {newPledges.length} جديد
              </span>
            )}
          </h2>
          <span className="text-xs text-faint">عينية فقط — القاعدة ترفض التعهّدات المالية</span>
        </div>

        {pledges.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">ما وصل حتّى تعهّد توّا.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <Th>المتعهّد</Th>
                  <Th>الاتصال</Th>
                  <Th>النوع</Th>
                  <Th>شنوّة يقدّم</Th>
                  <Th>التاريخ</Th>
                  <Th>المتابعة</Th>
                </tr>
              </thead>
              <tbody>
                {pledges.map((p) => (
                  <tr key={p.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium">{p.full_name}</td>
                    <td className="num px-4 py-3 text-xs" dir="ltr">
                      {p.phone}
                      {p.email && <div className="text-faint">{p.email}</div>}
                    </td>
                    <td className="px-4 py-3">{KIND_LABELS[p.kind] ?? p.kind}</td>
                    <td className="px-4 py-3">
                      {p.label}
                      {p.note && <div className="mt-1 text-xs text-faint">{p.note}</div>}
                    </td>
                    <td className="num px-4 py-3 text-xs text-faint">
                      {p.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <form action={updatePledgeAction} className="flex items-center gap-2">
                        <input type="hidden" name="pledge_id" value={p.id} />
                        <select
                          name="status"
                          defaultValue={p.status}
                          className="rounded border border-line bg-surface px-2 py-1 text-xs"
                        >
                          {Object.entries(PLEDGE_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                        <button className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:border-line-strong">
                          حفظ
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* حالة جديدة */}
      <section className="mt-8 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">فتح حالة تحتاج مساندة</h2>
        <p className="mt-1 text-xs leading-6 text-muted">
          العنوان يوصف <b>الحاجة</b> لا الشخص. رقم المطلب تلقاه في صفحة المطلب.
        </p>
        <form action={upsertSupportCaseAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">معرّف المطلب (UUID)</span>
            <input
              name="request_id"
              required
              dir="ltr"
              defaultValue={prefillRequestId ?? ''}
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">العنوان (عربي)</span>
            <input
              name="title_ar"
              required
              className={inputCls}
              placeholder="مثال: عائلة تحتاج سقف غرفتين في جبنيانة"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">العنوان (فرنسي)</span>
            <input name="title_fr" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">الوصف (عربي)</span>
            <textarea name="summary_ar" required rows={3} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">الوصف (فرنسي)</span>
            <textarea name="summary_fr" rows={3} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">المعتمدية</span>
            <select name="delegation_id" className={inputCls} defaultValue="">
              <option value="">—</option>
              {(delegs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="gov_code" value="SFX" />

          <div className="rounded border border-gold-light bg-gold-soft p-4 text-sm sm:col-span-2">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="consent_given" className="mt-1 size-4 accent-[#1d3a5f]" />
              <span className="leading-7">
                <b>صاحب الحالة وافق على عرضها.</b> بلا هالموافقة ما تتنشرش، حتّى لو اخترت النشر —
                القيد في القاعدة.
              </span>
            </label>
            <label className="mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                name="anonymised"
                defaultChecked
                className="size-4 accent-[#1d3a5f]"
              />
              <span>مجهّلة الهوية</span>
            </label>
            <label className="mt-3 flex items-center gap-3">
              <input type="checkbox" name="published" className="size-4 accent-[#1d3a5f]" />
              <span>انشرها في صفحة «حالات تحتاج مساندة»</span>
            </label>
          </div>

          <button className="justify-self-start rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep">
            حفظ الحالة
          </button>
        </form>
      </section>

      {/* الحالات ودفاترها */}
      <section className="mt-10 flex flex-col gap-6">
        {cases.length === 0 && (
          <p className="rounded border border-line bg-surface p-8 text-center text-sm text-muted">
            ما فمّا حتّى حالة مسجّلة.
          </p>
        )}

        {cases.map((c) => {
          const rows = byRequest.get(c.request_id) ?? []
          const needs = rows.filter((r) => r.event === 'needed')
          const covered = new Set(
            rows.filter((r) => r.event === 'delivered' && r.need_id).map((r) => r.need_id)
          )
          const progress = needsProgress(needs.length, covered.size)
          const internalValue = rows
            .filter((r) => r.event === 'delivered')
            .reduce((s, r) => s + Number(r.value_tnd ?? 0), 0)

          return (
            <article key={c.id} className="rounded border border-line bg-surface p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-semibold">{c.title_ar}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {c.delegation_id && (
                    <span className="rounded bg-surface-2 px-2 py-0.5 text-muted">
                      {delegName.get(c.delegation_id) ?? '—'}
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 ${
                      c.consent_given
                        ? 'bg-brand-soft text-brand'
                        : 'bg-gold-soft text-gold'
                    }`}
                  >
                    {c.consent_given ? 'موافق' : 'بلا موافقة'}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 ${
                      c.published ? 'bg-brand-soft text-brand' : 'text-faint'
                    }`}
                  >
                    {c.published ? 'منشورة' : 'غير منشورة'}
                  </span>
                  <Link
                    href={`/admin/${c.request_id}`}
                    className="text-brand hover:underline"
                  >
                    المطلب ←
                  </Link>
                </div>
              </div>

              <p className="mt-2 text-sm leading-7 text-muted">{c.summary_ar}</p>

              <div className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
                <span>
                  الحاجيات: {progress.done} / {progress.total}
                </span>
                <span>قيود الدفتر: {rows.length}</span>
                {internalValue > 0 && (
                  <span title="داخلي فقط — لا يظهر في الصفحة العمومية">
                    قيمة ما وصل (داخلي): {formatMoney(internalValue)}
                  </span>
                )}
              </div>

              {/* قيد جديد */}
              <form
                action={addLedgerEntryAction}
                className="mt-5 grid gap-3 rounded border border-line bg-surface-2 p-4 sm:grid-cols-6"
              >
                <input type="hidden" name="request_id" value={c.request_id} />
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-xs text-muted">الحدث</span>
                  <select name="event" className={inputCls} defaultValue="needed">
                    {LEDGER_EVENTS.map((e) => (
                      <option key={e} value={e}>
                        {EVENT_LABELS[e]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs text-muted">الوصف</span>
                  <input
                    name="label"
                    required
                    className={inputCls}
                    placeholder="مثال: 200 كيس إسمنت"
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-xs text-muted">النوع</span>
                  <select name="kind" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {CONTRIBUTION_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-xs text-muted">الكمّية</span>
                  <input name="quantity_note" className={inputCls} placeholder="120 من 200" />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-xs text-muted">التاريخ</span>
                  <input name="occurred_at" type="date" className={inputCls} />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs text-muted">يسدّ الحاجة</span>
                  <select name="need_id" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {needs.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs text-muted">الشريك</span>
                  <select name="partner_id" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {(partners ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs text-muted">الاسم كما يُعرض</span>
                  <input
                    name="partner_public"
                    className={inputCls}
                    placeholder="فارغ = متبرّع لم يرغب في ذكر اسمه"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs text-muted">
                    قيمة تقديرية (د.ت) — داخلي
                  </span>
                  <input name="value_tnd" type="number" step="0.01" className={inputCls} />
                </label>
                <label className="block sm:col-span-4">
                  <span className="mb-1.5 block text-xs text-muted">ملاحظة</span>
                  <input name="note" className={inputCls} />
                </label>

                <button className="justify-self-start rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep sm:col-span-6">
                  زيد قيد في الدفتر
                </button>
              </form>

              {/* الدفتر */}
              {rows.length > 0 && (
                <ol className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm">
                  {rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="rounded border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
                        {EVENT_LABELS[r.event] ?? r.event}
                      </span>
                      <span className="num text-xs text-faint">{r.occurred_at}</span>
                      <span>{r.label}</span>
                      {r.quantity_note && (
                        <span className="num text-xs text-muted">{r.quantity_note}</span>
                      )}
                      {r.partner_public && (
                        <span className="text-xs text-muted">— {r.partner_public}</span>
                      )}
                      {r.value_tnd != null && (
                        <span className="num text-xs text-faint">
                          ({formatMoney(Number(r.value_tnd))} داخلي)
                        </span>
                      )}
                      {r.note && <span className="text-xs text-faint">· {r.note}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}

const inputCls =
  'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}
