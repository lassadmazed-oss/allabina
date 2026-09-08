import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/supabase/server'
import {
  AVAILABILITY_LABELS,
  INTERVENANT_STATUSES,
  LEGAL_LABELS,
  STATUS_LABELS,
  isStatus,
  nextStatuses,
  type Availability,
  type IntervenantStatus,
  type LegalStatus,
} from '@/lib/network'
import { setIntervenantStatusAction } from '@/lib/actions/network'

export const metadata = { title: 'شبكة المتدخّلين — لوحة القيادة' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string
  full_name: string
  company_name: string | null
  phone: string
  status: string
  legal_status: string
  availability: string
  years_experience: number | null
  created_at: string
  category: { name_ar: string; family_code: string } | null
  delegation: { name_ar: string } | null
}

const dt = (v: string) => new Date(v).toLocaleDateString('fr-TN')

const STATUS_TONE: Record<IntervenantStatus, string> = {
  new: 'bg-surface-2 text-muted',
  to_verify: 'bg-gold-soft text-gold',
  docs_missing: 'bg-gold-soft text-gold',
  verified: 'bg-brand-soft text-brand',
  validated: 'bg-brand-soft text-brand',
  suspended: 'bg-[#fbf1ef] text-[#8c2f22]',
  rejected: 'bg-[#fbf1ef] text-[#8c2f22]',
  archived: 'bg-surface-2 text-faint',
}

export default async function ReseauAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; family?: string }>
}) {
  const me = await requirePermission('network.read')
  const canManage = can(me.role, 'network.manage')
  const sp = await searchParams

  let query = db
    .from('intervenants')
    .select(
      'id, full_name, company_name, phone, status, legal_status, availability, years_experience, created_at, category:intervenant_categories!category_id(name_ar, family_code), delegation:delegations!delegation_id(name_ar)'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.status && isStatus(sp.status)) query = query.eq('status', sp.status)

  const [{ data: rowsRaw }, { data: families }, { data: allForCount }] = await Promise.all([
    query,
    db.from('intervenant_families').select('code, name_ar').order('sort_order'),
    db.from('intervenants').select('status, availability'),
  ])

  let rows = (rowsRaw ?? []) as unknown as Row[]
  if (sp.family) rows = rows.filter((r) => r.category?.family_code === sp.family)

  const all = allForCount ?? []
  const byStatus = new Map<string, number>()
  for (const r of all) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  const validated = byStatus.get('validated') ?? 0
  const pending = (byStatus.get('new') ?? 0) + (byStatus.get('to_verify') ?? 0) + (byStatus.get('docs_missing') ?? 0)
  const availableNow = all.filter((r) => r.status === 'validated' && r.availability === 'available').length

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { status: sp.status, family: sp.family, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v)
    const s = next.toString()
    return s ? `/admin/reseau?${s}` : '/admin/reseau'
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-semibold">شبكة المتدخّلين والمزوّدين</h1>
          <p className="mt-1 text-sm text-muted">{all.length} ملفّ · {rows.length} معروض</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="معتمَدون في الشبكة" value={String(validated)} />
        <Kpi label="ملفّات تنتظر المعالجة" value={String(pending)} />
        <Kpi label="معتمَدون ومتوفّرون الآن" value={String(availableNow)} />
      </div>

      {/* فلاتر */}
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Chip href={qs({ status: undefined })} active={!sp.status}>
          كلّ الحالات
        </Chip>
        {INTERVENANT_STATUSES.map((s) => (
          <Chip key={s} href={qs({ status: s })} active={sp.status === s}>
            {STATUS_LABELS[s]}
            {byStatus.get(s) ? <span className="num mr-1.5 text-faint">{byStatus.get(s)}</span> : null}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <Chip href={qs({ family: undefined })} active={!sp.family}>
          كلّ المجالات
        </Chip>
        {(families ?? []).map((f) => (
          <Chip key={f.code} href={qs({ family: f.code })} active={sp.family === f.code}>
            {f.name_ar}
          </Chip>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line bg-surface-2 text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">المتدخّل</th>
              <th className="px-4 py-3 font-medium">الاختصاص</th>
              <th className="px-4 py-3 font-medium">المعتمدية</th>
              <th className="px-4 py-3 font-medium">الوضعية</th>
              <th className="px-4 py-3 font-medium">التوفّر</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">التسجيل</th>
              {canManage && <th className="px-4 py-3 font-medium">الإجراء</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = (isStatus(r.status) ? r.status : 'new') as IntervenantStatus
              const moves = nextStatuses(status)
              return (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name}</div>
                    {r.company_name && (
                      <div className="text-xs text-muted">{r.company_name}</div>
                    )}
                    <div className="num text-xs text-faint" dir="ltr">
                      {r.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.category?.name_ar ?? '—'}
                    {r.years_experience != null && (
                      <div className="text-xs text-faint">{r.years_experience} سنة خبرة</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.delegation?.name_ar ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">
                    {LEGAL_LABELS[r.legal_status as LegalStatus] ?? r.legal_status}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {AVAILABILITY_LABELS[r.availability as Availability] ?? r.availability}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_TONE[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-xs text-faint">{dt(r.created_at)}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {moves.length === 0 ? (
                        <span className="text-xs text-faint">—</span>
                      ) : (
                        <form action={setIntervenantStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={r.id} />
                          <select
                            name="status"
                            defaultValue={moves[0]}
                            className="rounded border border-line bg-surface px-2 py-1 text-xs"
                          >
                            {moves.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          <input
                            name="note"
                            placeholder="السبب"
                            className="w-28 rounded border border-line px-2 py-1 text-xs outline-none focus:border-brand"
                          />
                          <button className="rounded border border-line px-2 py-1 text-xs transition hover:border-brand hover:text-brand">
                            حفظ
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-muted">
                  ما فمّا حتّى ملفّ بهالفلاتر.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-6 text-faint">
        التسجيل لا يعني الاعتماد: الملفّ لا يدخل الشبكة ولا يظهر في المطابقة إلّا بعد «معتمَد».
        كلّ تغيير حالة يُسجَّل باسم صاحبه وسببه في <code className="num">intervenant_events</code>.
      </p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-surface p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function Chip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1.5 transition ${
        active
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line text-muted hover:border-line-strong'
      }`}
    >
      {children}
    </Link>
  )
}
