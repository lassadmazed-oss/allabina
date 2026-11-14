import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { getChantiers, getContractableRequests } from '@/lib/chantiers-server'
import { createChantierAction } from '@/lib/actions/chantiers'
import { CHANTIER_AR, REPORT_GAP_DAYS, lateDays } from '@/lib/site-reports'
import { isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الورشات — اللَّبنة' }

const input = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm'

export default async function ChantiersPage() {
  await requirePermission('requests.read')
  const [chantiers, options] = await Promise.all([getChantiers(), getContractableRequests()])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">الورشات</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        بعد العقد. <b>نسبة التقدّم ما تتكتبش بيد حدّ</b> — تتحسب من الكمّيات المنجزة في التقارير
        المعتمدة، موزونة بقيمة كلّ سطر في العقد.
      </p>

      {chantiers.length === 0 ? (
        <p className="mt-6 rounded border border-line bg-surface px-4 py-6 text-sm text-muted">
          ما ثمّ ورشات بعد.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {chantiers.map((c) => {
            const late = lateDays(c.expectedEnd)
            const stale = c.gapDays !== null && c.gapDays > REPORT_GAP_DAYS
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/chantiers/${encodeURIComponent(c.code)}`}
                  className="block rounded border border-line bg-surface p-4 transition hover:border-line-strong"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-xs text-faint">{isolateNumbers(c.code)}</span>
                    <span className="font-medium">{c.clientName ?? '—'}</span>
                    {c.requestRef && (
                      <span className="num text-xs text-muted">{isolateNumbers(c.requestRef)}</span>
                    )}
                    <span className="ms-auto rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      {CHANTIER_AR[c.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {c.progress.pct === null ? (
                      <span className="text-xs text-faint">بلا عقد — ما تتحسبش نسبة</span>
                    ) : (
                      <>
                        <span className="num text-lg font-semibold">
                          {isolateNumbers(String(c.progress.pct))}%
                        </span>
                        <span className="h-1.5 flex-1 basis-32 rounded bg-surface-2">
                          <span
                            className="block h-1.5 rounded bg-brand"
                            style={{ width: `${Math.min(100, c.progress.pct)}%` }}
                          />
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {c.pendingReports > 0 && (
                      <span className="text-gold">
                        <span className="num">{isolateNumbers(String(c.pendingReports))}</span>{' '}
                        تقرير ينتظر الاعتماد
                      </span>
                    )}
                    {stale && (
                      <span className="text-[#a32a24]">
                        آخر تقرير معتمد من{' '}
                        <span className="num">{isolateNumbers(String(c.gapDays))}</span> أيّام
                      </span>
                    )}
                    {late !== null && late > 0 && (
                      <span className="text-[#a32a24]">
                        متأخّرة <span className="num">{isolateNumbers(String(late))}</span> يوم
                      </span>
                    )}
                    {c.statusNote && <span className="text-muted">{c.statusNote}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <details className="mt-6 rounded border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">افتح ورشة</summary>
        <p className="mt-2 text-sm leading-7 text-muted">
          الورشة تتعلّق بعرض: <b>منّو تجي الكمّيات المتعاقد عليها</b>، وعليها تتحسب النسبة.
        </p>
        <form action={createChantierAction} className="mt-3 grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">المطلب والعرض</span>
            <select name="devis_id" required className={input} id="chantier-devis">
              {options.map((o) => (
                <option key={o.devisId} value={o.devisId}>
                  {o.name} — {o.ref} — {o.devisRef}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">تاريخ الانطلاق</span>
              <input type="date" name="started_at" className={input} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">الموعد المتوقّع للتسليم</span>
              <input type="date" name="expected_end" className={input} />
            </label>
          </div>
          <button
            type="submit"
            className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white"
          >
            افتح
          </button>
        </form>
      </details>
    </div>
  )
}
