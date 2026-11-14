import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  approveDocAction,
  rejectDocAction,
  sendDocAction,
} from '@/lib/actions/doc-approval'
import ModalTrigger from '@/components/ModalTrigger'
import {
  DEFAULT_SLA_HOURS,
  KIND_LABEL,
  STATUS_LABEL,
  ageHours,
  deltaOf,
  priorityOf,
  sortQueue,
  type Priority,
  type QueueItem,
} from '@/lib/approvals'
import { formatMoney, isolateNumbers } from '@/lib/format'

export const metadata = { title: 'صندوق الموافقات — اللَّبنة' }
export const dynamic = 'force-dynamic'

const PRIORITY_STYLE: Record<Priority, string> = {
  overdue: 'bg-[#fae9e8] text-[#a32a24]',
  due: 'bg-[#fbf0d8] text-[#8a5b05]',
  fresh: 'bg-surface-2 text-muted',
}
const PRIORITY_LABEL: Record<Priority, string> = {
  overdue: 'تجاوز المهلة',
  due: 'قارب المهلة',
  fresh: 'في المهلة',
}

export default async function ApprobationsPage() {
  await requirePermission('docs.approve')

  const { data: slaSetting } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'approvals.sla_hours')
    .maybeSingle()
  const sla = typeof slaSetting?.value === 'number' ? slaSetting.value : DEFAULT_SLA_HOURS

  // قيد المراجعة والمعتمَد غير المرسَل: الأوّل ينتظر قراراً، والثاني
  // ينتظر إرسالاً — وكلاهما عمل واقف على مكتب الإدارة.
  const { data: rows } = await db
    .from('devis')
    .select(
      'id, ref_code, kind, version, status, total_ht, valid_until, submitted_at, content_hash, approved_hash, approved_at, request_id, review_note'
    )
    .in('status', ['in_review', 'approved'])
    .order('submitted_at', { ascending: true })
    .limit(100)

  const list = rows ?? []
  const requestIds = [...new Set(list.map((r) => String(r.request_id)))]

  const [{ data: requests }, { data: siblings }] = await Promise.all([
    requestIds.length
      ? db.from('housing_requests').select('id, ref_code, full_name').in('id', requestIds)
      : Promise.resolve({ data: [] as { id: string; ref_code: string; full_name: string }[] }),
    requestIds.length
      ? db.from('devis').select('request_id, version, total_ht').in('request_id', requestIds)
      : Promise.resolve({ data: [] as { request_id: string; version: number; total_ht: number }[] }),
  ])

  const byRequest = new Map((requests ?? []).map((r) => [String(r.id), r]))

  /** مجموع النسخة السابقة لنفس الملفّ — أساس «قبل/بعد» */
  const previousTotal = (requestId: string, version: number): number | null => {
    const earlier = (siblings ?? [])
      .filter((s) => String(s.request_id) === requestId && Number(s.version) < version)
      .sort((a, b) => Number(b.version) - Number(a.version))[0]
    return earlier ? Number(earlier.total_ht) : null
  }

  const items: QueueItem[] = list.map((r) => {
    const req = byRequest.get(String(r.request_id))
    return {
      id: String(r.id),
      refCode: String(r.ref_code),
      kind: String(r.kind),
      version: Number(r.version),
      status: String(r.status),
      requestId: String(r.request_id),
      requestRef: String(req?.ref_code ?? ''),
      clientName: String(req?.full_name ?? ''),
      submittedAt: (r.submitted_at as string) ?? null,
      submittedBy: null,
      totalHt: Number(r.total_ht),
      previousTotalHt: previousTotal(String(r.request_id), Number(r.version)),
      validUntil: (r.valid_until as string) ?? null,
      staleApproval: Boolean(r.approved_at) && r.approved_hash !== r.content_hash,
    }
  })

  const queue = sortQueue(items)
  const notes = new Map(list.map((r) => [String(r.id), (r.review_note as string) ?? '']))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="text-xs font-semibold tracking-wide text-gold">الإدارة</p>
      <h1 className="display mt-1 text-lg font-semibold">صندوق الموافقات</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        ما ينتظر قراراً قبل أن يخرج إلى الحريف. <b>لا اعتماد بالصمت ولا بانقضاء الوقت</b>: مرور
        المهلة يرفع السطر ويبدّل لون شارته، ولا يقرّر شيئاً. والإرسال بلا اعتماد مطابق لمحتوى
        الوثيقة ممنوع في قاعدة البيانات نفسها، لا في هذه الشاشة.
      </p>

      {queue.length === 0 && (
        <p className="mt-8 rounded border border-line bg-surface px-4 py-6 text-sm text-muted">
          ما ثمّ وثيقة تنتظر قراراً.
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {queue.map((it) => {
          const hours = ageHours(it.submittedAt)
          const prio = priorityOf(hours, sla)
          const delta = deltaOf(it.totalHt, it.previousTotalHt)
          const reviewing = it.status === 'in_review'

          return (
            <article key={it.id} className="rounded border border-line bg-surface p-4">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="num text-sm font-semibold">{isolateNumbers(it.refCode)}</span>
                <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  {KIND_LABEL[it.kind] ?? it.kind}
                </span>
                <span className="text-xs text-muted">
                  نسخة <span className="num">{it.version}</span>
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[prio]}`}>
                  {PRIORITY_LABEL[prio]}
                  {it.submittedAt && (
                    <>
                      {' · '}
                      <span className="num">{Math.round(hours)}</span> ساعة
                    </>
                  )}
                </span>
                <span className="ms-auto text-xs text-faint">{STATUS_LABEL[it.status]}</span>
              </header>

              <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-xs text-faint">الملفّ</span>
                  <div className="mt-0.5">
                    <Link href={`/admin/${it.requestId}`} className="font-medium underline underline-offset-4">
                      {it.clientName || '—'}
                    </Link>{' '}
                    <span className="num text-xs text-muted">{isolateNumbers(it.requestRef)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-faint">الأثر المالي</span>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                    <b className="num">{isolateNumbers(formatMoney(it.totalHt, 'ar'))}</b>
                    {delta ? (
                      <span
                        className={`num text-xs font-medium ${
                          delta.direction === 'up' ? 'text-[#a32a24]' : 'text-[#1d6b45]'
                        }`}
                      >
                        {delta.direction === 'up' ? '+' : '−'}
                        {isolateNumbers(formatMoney(Math.abs(delta.amount), 'ar'))}
                        {delta.pct !== null && (
                          <> ({isolateNumbers(Math.abs(delta.pct).toFixed(1))}%)</>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">
                        {it.previousTotalHt === null ? 'نسخة أولى' : 'بلا تغيير'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {it.staleApproval && (
                <p className="mt-3 rounded border border-[#e0b4ac] bg-[#fbeeeb] px-3 py-2 text-sm leading-7 text-[#8c2f22]">
                  المحتوى تبدّل بعد الاعتماد، فسقط الاعتماد. راجِعها من جديد قبل الإرسال.
                </p>
              )}

              {notes.get(it.id) && (
                <p className="mt-3 rounded border border-line bg-surface-2 px-3 py-2 text-sm leading-7">
                  <span className="text-xs text-faint">ملاحظة المراجعة: </span>
                  {notes.get(it.id)}
                </p>
              )}

              <footer className="mt-4 flex flex-wrap items-center gap-2">
                {reviewing ? (
                  <>
                    <form action={approveDocAction}>
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        className="min-h-10 rounded bg-brand px-4 text-sm font-semibold text-white"
                      >
                        اعتماد
                      </button>
                    </form>

                    <ModalTrigger label="رفض بسبب" title={`رفض ${it.refCode}`} variant="ghost" icon={null}>
                      <form action={rejectDocAction} className="grid gap-3">
                        <input type="hidden" name="id" value={it.id} />
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium">
                            سبب الرفض — يصل إلى من أعدّها
                          </span>
                          <textarea
                            name="reason"
                            required
                            rows={3}
                            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                            placeholder="شنوّة يلزم يتبدّل؟"
                          />
                        </label>
                        <button
                          type="submit"
                          className="min-h-10 rounded bg-[#a32a24] px-4 text-sm font-semibold text-white"
                        >
                          رفض وإرجاع للتعديل
                        </button>
                      </form>
                    </ModalTrigger>
                  </>
                ) : (
                  <form action={sendDocAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <button
                      type="submit"
                      disabled={it.staleApproval}
                      className="min-h-10 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      إرسال إلى الحريف
                    </button>
                  </form>
                )}

                <Link
                  href={`/admin/${it.requestId}`}
                  className="min-h-10 rounded border border-line px-4 py-2 text-sm"
                >
                  فتح الملفّ
                </Link>
              </footer>
            </article>
          )
        })}
      </div>

      <p className="mt-8 text-xs leading-7 text-faint">
        المهلة المعتمدة <span className="num">{isolateNumbers(String(sla))}</span> ساعة، تُبدَّل من
        «المعطيات المرجعية». والتفويض بحدود غير مفعّل بعد: الاعتماد اليوم للمالك والمدير وحدهما.
      </p>
    </div>
  )
}
