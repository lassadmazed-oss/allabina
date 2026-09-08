import { Suspense } from 'react'
import { formatPercent } from '@/lib/format'
import { checkSmsBalance } from '@/lib/sms/winsms'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/supabase/server'
import { LABELS } from '@/lib/schema'
import { formatTND } from '@/lib/finance'
import { updateStatusAction } from '@/lib/actions/admin'

export const metadata = { title: 'لوحة القيادة — اللَّبنة' }
export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment', 'contract', 'on_hold', 'rejected']

type Row = {
  id: string
  ref_code: string
  full_name: string
  phone: string
  gov_code: string
  delegation_id: number | null
  request_type: string
  desired_area_m2: number | null
  status: string
  created_at: string
  next_action: string | null
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; band?: string; gov?: string }>
}) {
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')

  const sp = await searchParams

  let query = db
    .from('housing_requests')
    .select(
      'id, ref_code, full_name, phone, gov_code, delegation_id, request_type, desired_area_m2, status, created_at, next_action'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.status) query = query.eq('status', sp.status)
  if (sp.gov) query = query.eq('gov_code', sp.gov)

  const { data: requestsRaw } = await query
  const requests = (requestsRaw ?? []) as Row[]

  const smsBalancePromise = checkSmsBalance()
  const [{ data: delegs }, { data: openItems }, { data: dueActions }] = await Promise.all([
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX'),
    db.from('request_interactions').select('id, request_id, kind, body').eq('resolved', false),
    db
      .from('housing_requests')
      .select('id, ref_code, full_name, next_action, next_action_at')
      .not('next_action', 'is', null)
      .order('next_action_at', { ascending: true })
      .limit(8),
  ])
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))

  const { data: scoresRaw } = await db
    .from('scores')
    .select('request_id, total, band, max_budget_tnd, computed_at')
    .order('computed_at', { ascending: false })

  const scoreByRequest = new Map<string, { total: number; band: string; max_budget_tnd: number }>()
  for (const s of scoresRaw ?? []) {
    if (!scoreByRequest.has(s.request_id)) {
      scoreByRequest.set(s.request_id, {
        total: s.total,
        band: s.band,
        max_budget_tnd: Number(s.max_budget_tnd ?? 0),
      })
    }
  }

  const rows = requests.filter((r) => !sp.band || scoreByRequest.get(r.id)?.band === sp.band)

  // المؤشرات
  const today = new Date().toISOString().slice(0, 10)
  const countToday = requests.filter((r) => r.created_at.startsWith(today)).length
  const bands = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>
  let budgetSum = 0
  let budgetCount = 0
  for (const r of requests) {
    const s = scoreByRequest.get(r.id)
    if (s) {
      bands[s.band] = (bands[s.band] ?? 0) + 1
      if (s.max_budget_tnd > 0) {
        budgetSum += s.max_budget_tnd
        budgetCount++
      }
    }
  }
  const qualityPct = requests.length
    ? Math.round(((bands.A + bands.B) / requests.length) * 100)
    : 0

  const byGov = new Map<string, number>()
  for (const r of requests) byGov.set(r.gov_code, (byGov.get(r.gov_code) ?? 0) + 1)
  const topGovs = [...byGov.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const byDelegation = new Map<string, number>()
  for (const r of requests) {
    if (r.gov_code !== 'SFX') continue
    const name = r.delegation_id ? delegName.get(r.delegation_id) ?? 'غير محدّدة' : 'غير محدّدة'
    byDelegation.set(name, (byDelegation.get(name) ?? 0) + 1)
  }
  const topDelegations = [...byDelegation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-lg font-semibold">لوحة القيادة</h1>
          <p className="mt-1 text-sm text-muted">
            {requests.length} مطلب · {countToday} اليوم
          </p>
        </div>
      </div>

      {/* المؤشرات */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="مجموع المطالب" value={String(requests.length)} />
        <Kpi label="نسبة الأصناف A و B" value={formatPercent(qualityPct)} />
        <Kpi
          label="معدّل الميزانية التقديرية"
          value={budgetCount ? formatTND(budgetSum / budgetCount) : '—'}
        />
        <Kpi label="استفسارات مفتوحة" value={String((openItems ?? []).length)} />
      </div>

      {/* رصيد الرسائل نداء خارجي بمهلة 6 ثوانٍ: يُبثّ ولا يحبس اللوحة */}
      <Suspense
        fallback={
          <p className="mt-3 rounded border border-line bg-surface px-3 py-2 text-xs text-faint">
            رصيد الرسائل القصيرة…
          </p>
        }
      >
        <SmsBalance promise={smsBalancePromise} />
      </Suspense>

      {topGovs.length > 0 && (
        <div className="mt-4 rounded border border-line bg-surface p-4">
          <div className="text-sm font-medium">الطلب حسب الولاية</div>
          <div className="mt-4 space-y-2">
            {topGovs.map(([gov, n]) => (
              <div key={gov} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-muted">{gov}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${(n / Math.max(...topGovs.map((g) => g[1]))) * 100}%` }}
                  />
                </div>
                <span className="num w-8 text-left text-muted">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {topDelegations.length > 0 && (
          <div className="rounded border border-line bg-surface p-4">
            <div className="text-sm font-medium">الطلب حسب معتمديات صفاقس</div>
            <div className="mt-4 space-y-2">
              {topDelegations.map(([name, n]) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted">{name}</span>
                  <div className="h-2 flex-1 rounded-full bg-surface-2">
                    <div
                      className="h-2 rounded-full bg-gold-light"
                      style={{
                        width: `${(n / Math.max(...topDelegations.map((d) => d[1]))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="num w-8 text-left text-muted">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(dueActions ?? []).length > 0 && (
          <div className="rounded border border-line bg-surface p-4">
            <div className="text-sm font-medium">إجراءات في انتظار التنفيذ</div>
            <ul className="mt-4 space-y-2 text-sm">
              {(dueActions ?? []).map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3">
                  <Link href={`/admin/${a.id}`} className="truncate text-brand hover:underline">
                    {a.full_name}: {a.next_action}
                  </Link>
                  <span className="num shrink-0 text-xs text-faint">
                    {a.next_action_at ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* الفلاتر */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Filter active={!sp.status && !sp.band} href="/admin" label="الكلّ" />
        {['A', 'B', 'C', 'D'].map((b) => (
          <Filter key={b} active={sp.band === b} href={`/admin?band=${b}`} label={`الصنف ${b}`} />
        ))}
        {['new', 'contacted', 'qualified', 'on_hold'].map((s) => (
          <Filter
            key={s}
            active={sp.status === s}
            href={`/admin?status=${s}`}
            label={LABELS.status[s]}
          />
        ))}
      </div>

      {/* الجدول */}
      <div className="mt-4 overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-surface-2 text-right">
              <Th>الرمز</Th>
              <Th>الحريف</Th>
              <Th>الولاية</Th>
              <Th>المعتمدية</Th>
              <Th>النوع</Th>
              <Th>المساحة</Th>
              <Th>التنقيط</Th>
              <Th>الميزانية</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-muted">
                  ما فمّا حتّى مطلب بهالفلاتر.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const s = scoreByRequest.get(r.id)
              return (
                <tr key={r.id} className="border-t border-line align-middle">
                  <td className="num px-4 py-3" dir="ltr">
                    <Link href={`/admin/${r.id}`} className="text-brand hover:underline">
                      {r.ref_code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="num text-xs text-faint" dir="ltr">
                      {r.phone}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.gov_code === 'SFX' ? 'صفاقس' : r.gov_code}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {r.delegation_id ? delegName.get(r.delegation_id) ?? '—' : '—'}
                  </td>
                  <td className="px-3 py-2">{LABELS.requestType[r.request_type] ?? r.request_type}</td>
                  <td className="num px-4 py-3">{r.desired_area_m2 ?? '—'}</td>
                  <td className="px-3 py-2">
                    {s ? (
                      <span
                        className={`num rounded px-2 py-0.5 text-xs font-medium ${bandCls(s.band)}`}
                      >
                        {s.band} · {s.total}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="num px-4 py-3">
                    {s?.max_budget_tnd ? formatTND(s.max_budget_tnd) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <form action={updateStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <select
                          name="status"
                          defaultValue={r.status}
                          className="rounded border border-line bg-surface px-2 py-1 text-xs"
                        >
                          {STATUSES.map((s2) => (
                            <option key={s2} value={s2}>
                              {LABELS.status[s2]}
                            </option>
                          ))}
                        </select>
                        <button className="rounded border border-line px-2 py-1 text-xs hover:border-brand hover:text-brand">
                          حفظ
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-faint">{LABELS.status[r.status]}</span>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-xs text-faint">
                    {new Date(r.created_at).toLocaleDateString('fr-TN')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function bandCls(band: string) {
  return {
    A: 'bg-brand-soft text-brand',
    B: 'bg-[#e6f0e9] text-brand',
    C: 'bg-gold-soft text-gold',
    D: 'bg-surface-2 text-muted',
  }[band] ?? 'bg-surface-2 text-muted'
}

function Kpi({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 font-semibold text-ink ${small ? 'text-sm' : 'text-2xl'}`}>
        {value}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1.5 transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      {label}
    </Link>
  )
}


/** رصيد WinSMS — تنبيه تحت الحدّ المضبوط في الإعدادات */
async function SmsBalance({ promise }: { promise: Promise<{ balance: number; licence: string } | null> }) {
  const bal = await promise
  if (!bal) {
    return (
      <p className="mt-4 rounded border border-line bg-surface px-4 py-3 text-xs text-faint">
        رصيد الرسائل القصيرة: غير متاح الآن (المفتاح غير معرّف أو المزوّد لا يردّ).
      </p>
    )
  }
  const low = bal.balance < 100
  return (
    <div
      className={`mt-4 flex flex-wrap items-baseline justify-between gap-3 rounded border px-4 py-3 text-sm ${
        low ? 'border-gold/50 bg-gold-soft' : 'border-line bg-surface'
      }`}
    >
      <span>
        رسائل SMS (WinSMS · المُرسِل MAZED):{' '}
        <b className={`num ${low ? 'text-gold' : ''}`}>{bal.balance}</b> رسالة باقية
        {low && <span className="ms-2 text-gold">— الرصيد منخفض، أعد الشحن قبل ما تتوقّف رسائل التأكيد</span>}
      </span>
      <span className="num text-xs text-faint">الرخصة حتى {bal.licence}</span>
    </div>
  )
}
