import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/format'
import { formatTND } from '@/lib/finance'
import { reviewPropertyAction } from '@/lib/actions/property-admin'

export const metadata = { title: 'العقارات المعروضة — اللَّبنة' }
export const dynamic = 'force-dynamic'

const KIND_AR: Record<string, string> = {
  land: 'أرض',
  house: 'دار',
  apartment: 'شقة',
  building: 'عمارة',
  other: 'أخرى',
}

const STATUS_AR: Record<string, string> = {
  pending: 'في انتظار المراجعة',
  approved: 'مراجَع — صالح للمطابقة',
  rejected: 'مرفوض',
  reserved: 'محجوز',
  sold: 'خرج من السوق',
}

const LEGAL_AR: Record<string, string> = {
  titled: 'رسم عقاري',
  in_progress: 'في طور التسوية',
  undivided: 'على الشياع',
  unregistered: 'غير مسجّل',
  other: 'أخرى',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-bronze-soft text-bronze',
  approved: 'bg-green-soft text-green',
  rejected: 'bg-surface-2 text-muted',
  reserved: 'bg-green-soft text-green',
  sold: 'bg-surface-2 text-faint',
}

type Property = {
  id: string
  ref_code: string
  kind: string
  gov_code: string
  delegation_id: number | null
  address: string | null
  area_m2: number | null
  built_area_m2: number | null
  rooms: number | null
  price_tnd: number | null
  negotiable: boolean
  legal_status: string | null
  description: string | null
  owner_name: string
  owner_phone: string
  owner_email: string | null
  owner_note: string | null
  status: string
  review_note: string | null
  created_at: string
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('requests.read')
  const sp = await searchParams

  let query = db
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.status) query = query.eq('status', sp.status)

  const [{ data: rows }, { data: delegs }, { data: stats }] = await Promise.all([
    query,
    db.from('delegations').select('id, name_ar'),
    db.from('property_stats').select('*').maybeSingle(),
  ])

  const properties = (rows ?? []) as Property[]
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-muted hover:text-green">
            ← لوحة القيادة
          </Link>
          <h1 className="display mt-2 text-2xl font-semibold">العقارات المعروضة</h1>
          <p className="mt-1 text-sm text-muted">
            عروض المالكين. ما تظهرش في الموقع: تُراجَع هنا، والمراجَعة وحدها تدخل المطابقة.
          </p>
        </div>
      </div>

      {stats && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="مجموع العروض" value={Number(stats.total ?? 0)} />
          <Kpi label="في انتظار المراجعة" value={Number(stats.pending ?? 0)} tone="bronze" />
          <Kpi label="صالحة للمطابقة" value={Number(stats.approved ?? 0)} tone="green" />
          <Kpi label="أراضٍ متاحة" value={Number(stats.land_available ?? 0)} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <Filter active={!sp.status} href="/admin/properties" label="الكلّ" />
        {Object.entries(STATUS_AR).map(([k, v]) => (
          <Filter
            key={k}
            active={sp.status === k}
            href={`/admin/properties?status=${k}`}
            label={v}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {properties.length === 0 && (
          <p className="rounded border border-line bg-surface p-10 text-center text-muted">
            ما فمّا حتّى عرض بهالفلتر.
          </p>
        )}

        {properties.map((p) => (
          <article key={p.id} className="rounded border border-line bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="num text-sm text-green" dir="ltr">
                  {p.ref_code}
                </span>
                <h2 className="mt-1 text-lg font-semibold">
                  {KIND_AR[p.kind] ?? p.kind}
                  {p.delegation_id ? ` · ${delegName.get(p.delegation_id) ?? ''}` : ''}
                  {p.gov_code === 'SFX' ? ' · صفاقس' : ` · ${p.gov_code}`}
                </h2>
              </div>
              <span
                className={`rounded px-3 py-1 text-xs font-medium ${
                  STATUS_STYLE[p.status] ?? 'bg-surface-2 text-muted'
                }`}
              >
                {STATUS_AR[p.status] ?? p.status}
              </span>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Row k="المساحة" v={p.area_m2 ? `${formatNumber(Number(p.area_m2))} م²` : '—'} />
              <Row
                k="المبنية"
                v={p.built_area_m2 ? `${formatNumber(Number(p.built_area_m2))} م²` : '—'}
              />
              <Row k="الغرف" v={p.rooms ? String(p.rooms) : '—'} />
              <Row
                k="الثمن"
                v={
                  p.price_tnd
                    ? `${formatTND(Number(p.price_tnd))}${p.negotiable ? ' (قابل للتفاوض)' : ''}`
                    : '—'
                }
              />
              <Row k="الوضعية القانونية" v={p.legal_status ? LEGAL_AR[p.legal_status] : '—'} />
              <Row k="الموقع" v={p.address || '—'} />
            </dl>

            {p.description && (
              <p className="mt-3 rounded border border-line bg-ground p-3 text-sm leading-7 text-muted">
                {p.description}
              </p>
            )}

            <div className="mt-4 border-t border-line pt-3 text-sm">
              <span className="font-medium">{p.owner_name}</span>
              <span className="num mx-2 text-muted" dir="ltr">
                {p.owner_phone}
              </span>
              {p.owner_email && <span className="text-xs text-faint">{p.owner_email}</span>}
              {p.owner_note && <p className="mt-1 text-xs leading-6 text-muted">{p.owner_note}</p>}
            </div>

            <form
              action={reviewPropertyAction}
              className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
            >
              <input type="hidden" name="id" value={p.id} />
              <label className="block">
                <span className="mb-1.5 block text-xs text-muted">الحالة</span>
                <select
                  name="status"
                  defaultValue={p.status}
                  className="rounded border border-line bg-surface px-3 py-2 text-sm"
                >
                  {Object.entries(STATUS_AR).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-[220px] flex-1">
                <span className="mb-1.5 block text-xs text-muted">ملاحظة المراجعة</span>
                <input
                  name="review_note"
                  defaultValue={p.review_note ?? ''}
                  placeholder="مثال: تثبّتنا من الرسم العقاري"
                  className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                />
              </label>
              <button className="rounded bg-green px-5 py-2 text-sm font-medium text-white hover:bg-green-deep">
                حفظ
              </button>
            </form>
          </article>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'bronze' }) {
  const color = tone === 'green' ? 'text-green' : tone === 'bronze' ? 'text-bronze' : 'text-ink'
  return (
    <div className="rounded border border-line bg-surface p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-semibold ${color}`}>{formatNumber(value)}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  )
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1.5 transition ${
        active
          ? 'border-green bg-green text-white'
          : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      {label}
    </Link>
  )
}
