import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/format'
import { formatTND } from '@/lib/finance'
import { reviewPropertyAction } from '@/lib/actions/property-admin'
import {
  findOpportunities,
  rankRequests,
  type MatchProperty,
  type MatchRequestWithId,
} from '@/lib/matching'
import { LABELS } from '@/lib/schema'
import { PROPERTY_MEDIA_BUCKET, humanBytes } from '@/lib/property-media'

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

const CONDITION_AR: Record<string, string> = {
  new: 'جديد',
  good: 'جيّد',
  to_refresh: 'يحتاج تحسيناً',
  to_renovate: 'يحتاج ترميماً',
}

const LEGAL_AR: Record<string, string> = {
  titled: 'رسم عقاري',
  in_progress: 'في طور التسوية',
  undivided: 'على الشياع',
  unregistered: 'غير مسجّل',
  other: 'أخرى',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gold-soft text-gold',
  approved: 'bg-brand-soft text-brand',
  rejected: 'bg-surface-2 text-muted',
  reserved: 'bg-brand-soft text-brand',
  sold: 'bg-surface-2 text-faint',
}

/** المطالب التي ما زالت تنتظر حلّاً — المغلقة لا تُقترح على عرض */
const OPEN_STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment']

type Property = {
  id: string
  ref_code: string
  kind: string
  gov_code: string
  delegation_id: number | null
  imada_id: number | null
  address: string | null
  area_m2: number | null
  built_area_m2: number | null
  rooms: number | null
  bedrooms: number | null
  living_rooms: number | null
  bathrooms: number | null
  floors: number | null
  floor_number: number | null
  year_built: number | null
  condition: string | null
  garage: boolean | null
  garden: boolean | null
  terrace: boolean | null
  elevator: boolean | null
  furnished: boolean | null
  water_connected: boolean | null
  power_connected: boolean | null
  road_access: boolean | null
  frontage_m: number | null
  buildable: boolean | null
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

type MediaRow = {
  id: number
  property_id: string
  kind: string
  storage_path: string
  original_name: string | null
  bytes: number | null
  sort_order: number
}

type RequestRow = {
  id: string
  ref_code: string
  full_name: string
  request_type: string
  gov_code: string
  delegation_id: number | null
  imada_id: number | null
  desired_area_m2: number | null
  owns_land: boolean
  status: string
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('requests.read')
  const sp = await searchParams

  const [
    { data: rows },
    { data: delegs },
    { data: stats },
    { data: reqRows },
    { data: scoreRows },
    { data: savedMatches },
  ] = await Promise.all([
    db.from('properties').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('delegations').select('id, name_ar'),
    db.from('property_stats').select('*').maybeSingle(),
    db
      .from('housing_requests')
      .select(
        'id, ref_code, full_name, request_type, gov_code, delegation_id, imada_id, desired_area_m2, owns_land, status'
      )
      .in('status', OPEN_STATUSES)
      .limit(500),
    // التنقيط للمطالب المفتوحة وحدها، وأحدثها أوّلاً — لا الجدول كلّه
    db
      .from('scores')
      .select('request_id, band, max_budget_tnd, computed_at')
      .order('computed_at', { ascending: false })
      .limit(1500),
    db.from('matches').select('request_id, property_id').limit(2000),
  ])

  const allProperties = (rows ?? []) as Property[]
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))

  // أحدث تنقيط لكلّ مطلب
  const scoreByRequest = new Map<string, { band: string; maxBudget: number | null }>()
  for (const s of scoreRows ?? []) {
    if (!scoreByRequest.has(s.request_id)) {
      scoreByRequest.set(s.request_id, {
        band: String(s.band),
        maxBudget: s.max_budget_tnd === null ? null : Number(s.max_budget_tnd),
      })
    }
  }

  const requests = (reqRows ?? []) as RequestRow[]
  const requestById = new Map(requests.map((r) => [r.id, r]))

  const matchPool: MatchRequestWithId[] = requests.map((r) => ({
    id: r.id,
    requestType: r.request_type,
    govCode: r.gov_code,
    delegationId: r.delegation_id,
    imadaId: r.imada_id,
    desiredAreaM2: r.desired_area_m2,
    maxBudget: scoreByRequest.get(r.id)?.maxBudget ?? null,
    ownsLand: Boolean(r.owns_land),
    scoreBand: scoreByRequest.get(r.id)?.band ?? null,
  }))

  const asMatchProperty = (p: Property): MatchProperty => ({
    id: p.id,
    kind: p.kind,
    govCode: p.gov_code,
    delegationId: p.delegation_id,
    imadaId: p.imada_id,
    areaM2: p.area_m2 === null ? null : Number(p.area_m2),
    builtAreaM2: p.built_area_m2 === null ? null : Number(p.built_area_m2),
    priceTnd: p.price_tnd === null ? null : Number(p.price_tnd),
    status: p.status,
  })

  // من ينتظر كلّ عرض
  const matchesByProperty = new Map(
    allProperties.map((p) => [p.id, rankRequests(asMatchProperty(p), matchPool, { limit: 5 })])
  )

  const savedPairs = new Set(
    ((savedMatches ?? []) as { request_id: string; property_id: string }[]).map(
      (m) => `${m.request_id}|${m.property_id}`
    )
  )

  const opportunities = findOpportunities(matchPool, allProperties.map(asMatchProperty)).slice(0, 8)
  const totalPairs = [...matchesByProperty.values()].reduce((n, list) => n + list.length, 0)

  // الوسائط: المخزن خاصّ، فالعرض يمرّ بروابط موقّتة لا بروابط عمومية
  const { data: mediaRows } = await db
    .from('property_media')
    .select('id, property_id, kind, storage_path, original_name, bytes, sort_order')
    .in(
      'property_id',
      allProperties.map((p) => p.id)
    )
    .not('storage_path', 'is', null)
    .order('sort_order')

  const media = (mediaRows ?? []) as MediaRow[]
  const signedByPath = new Map<string, string>()
  if (media.length) {
    const { data: signed } = await db.storage
      .from(PROPERTY_MEDIA_BUCKET)
      .createSignedUrls(
        media.map((m) => m.storage_path),
        3600
      )
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) signedByPath.set(row.path, row.signedUrl)
    }
  }

  const mediaByProperty = new Map<string, MediaRow[]>()
  for (const m of media) {
    const list = mediaByProperty.get(m.property_id) ?? []
    list.push(m)
    mediaByProperty.set(m.property_id, list)
  }

  const pending = allProperties.filter((p) => p.status === 'pending')

  // العرض المفلتر، مرتّباً بما ينتظره حرفاء أكثر — لا بتاريخ التسجيل
  const listed = (sp.status ? allProperties.filter((p) => p.status === sp.status) : allProperties)
    .slice()
    .sort(
      (a, b) =>
        (matchesByProperty.get(b.id)?.length ?? 0) - (matchesByProperty.get(a.id)?.length ?? 0)
    )

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">العقارات المعروضة</h1>
      <p className="mt-1 text-sm text-muted">
        عروض المالكين. ما تظهرش في الموقع: تُراجَع هنا، والمراجَعة وحدها تدخل المطابقة.
      </p>

      {stats && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="مجموع العروض" value={Number(stats.total ?? 0)} />
          <Kpi label="تنتظر قرارك" value={Number(stats.pending ?? 0)} tone="gold" />
          <Kpi label="صالحة للمطابقة" value={Number(stats.approved ?? 0)} tone="brand" />
          <Kpi label="تقاطعات مع حرفاء" value={totalPairs} tone="brand" />
        </div>
      )}

      {/* ---------- 1) ما يحتاج قرارك ---------- */}
      {pending.length > 0 && (
        <section className="mt-4 rounded border border-gold/40 bg-gold-soft p-4">
          <h2 className="display text-lg font-semibold text-gold">
            {pending.length} عرض ينتظر مراجعتك
          </h2>
          <p className="mt-1 text-sm leading-7 text-ink-soft">
            العرض غير المراجَع لا يدخل المطابقة إطلاقاً — يبقى خارج المنظومة حتى تقرّر فيه.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface px-4 py-3 text-sm"
              >
                <span>
                  <span className="num text-brand" dir="ltr">
                    {p.ref_code}
                  </span>
                  <span className="mx-2 font-medium">
                    {KIND_AR[p.kind] ?? p.kind}
                    {p.delegation_id ? ` · ${delegName.get(p.delegation_id) ?? ''}` : ''}
                  </span>
                  <span className="num text-muted">
                    {p.price_tnd ? formatTND(Number(p.price_tnd)) : '—'}
                  </span>
                </span>
                <a href={`#${p.ref_code}`} className="text-xs text-brand hover:underline">
                  راجعو ↓
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 2) أين يلتقي الطلب بالعرض ---------- */}
      {opportunities.length > 0 && (
        <section className="mt-4 rounded border border-line bg-surface p-4">
          <h2 className="display text-lg font-semibold">أين يلتقي الطلب بالعرض</h2>
          <p className="mt-1 text-sm leading-7 text-muted">
            تجميع المطالب المفتوحة حسب المنطقة والنوع، مقابل ما يقابلها فعلاً من عروض.
            «عروض مطابقة» = عروض شكّلت تقاطعاً فعلياً، و«تقاطعات» = أزواج (مطلب ← عرض) تجاوزت 55 نقطة — لا جوار جغرافي.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-line text-right text-muted">
                <tr>
                  <th className="py-2 font-medium">المنطقة</th>
                  <th className="py-2 font-medium">نوع المطلب</th>
                  <th className="py-2 font-medium">الطلب</th>
                  <th className="py-2 font-medium">منها جاهزة</th>
                  <th className="py-2 font-medium">عروض مطابقة</th>
                  <th className="py-2 font-medium">تقاطعات</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr
                    key={`${o.delegationId}-${o.requestType}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="py-2.5">
                      {o.delegationId ? delegName.get(o.delegationId) ?? '—' : 'غير محدّدة'}
                    </td>
                    <td className="py-2.5 text-muted">
                      {LABELS.requestType[o.requestType] ?? o.requestType}
                    </td>
                    <td className="num py-2.5">{o.demand}</td>
                    <td className="num py-2.5 text-muted">{o.readyDemand}</td>
                    <td className="num py-2.5">{o.supply}</td>
                    <td className="num py-2.5">
                      {o.pairs > 0 ? (
                        <span className="rounded bg-brand-soft px-2 py-0.5 font-medium text-brand">
                          {o.pairs}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------- 3) العروض ---------- */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
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

      <div className="mt-3 flex flex-col gap-3">
        {listed.length === 0 && (
          <p className="rounded border border-line bg-surface p-10 text-center text-muted">
            ما فمّا حتّى عرض بهالفلتر.
          </p>
        )}

        {listed.map((p) => {
          const waiting = matchesByProperty.get(p.id) ?? []
          return (
            <article
              key={p.id}
              id={p.ref_code}
              className="scroll-mt-6 rounded border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <span className="num text-sm text-brand" dir="ltr">
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

              {(mediaByProperty.get(p.id) ?? []).length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {(mediaByProperty.get(p.id) ?? []).map((m) => {
                    const href = signedByPath.get(m.storage_path)
                    if (!href) return null
                    return (
                      <li key={m.id}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          title={`${m.original_name ?? ''} · ${m.bytes ? humanBytes(m.bytes) : ''}`}
                          className="block overflow-hidden rounded border border-line transition hover:border-brand"
                        >
                          {m.kind === 'photo' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={href} alt="" className="size-20 object-cover" />
                          ) : (
                            <span className="flex size-20 items-center justify-center bg-surface-2 text-xs text-muted">
                              فيديو
                            </span>
                          )}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* ---- شكون ينتظر هذا العرض ---- */}
              <div className="mt-4 rounded border border-line bg-ground p-4">
                {waiting.length === 0 ? (
                  <p className="text-sm text-muted">
                    {p.status === 'approved'
                      ? 'ما فمّاش حريف مطابق توّا في هالمنطقة وهالميزانية.'
                      : 'لا مطابقة: العرض غير مراجَع — المراجعة وحدها تدخلو المنظومة.'}
                  </p>
                ) : (
                  <>
                    <div className="text-sm font-medium">
                      {waiting.length} حريف ينتظر عرضاً كهذا
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                      {waiting.map((m) => {
                        const r = requestById.get(m.requestId)
                        if (!r) return null
                        const sc = scoreByRequest.get(r.id)
                        const saved = savedPairs.has(`${r.id}|${p.id}`)
                        const top = m.reasons
                          .filter((x) => x.points > 0)
                          .sort((a, b) => b.points - a.points)
                          .slice(0, 2)
                          .map((x) => x.ar)
                        return (
                          <li
                            key={m.requestId}
                            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2 text-sm last:border-0 last:pb-0"
                          >
                            <span className="num w-12 shrink-0 font-semibold text-brand">
                              {m.score}%
                            </span>
                            <Link
                              href={`/admin/${r.id}`}
                              className="font-medium hover:text-brand hover:underline"
                            >
                              {r.full_name}
                            </Link>
                            <span className="num text-xs text-faint" dir="ltr">
                              {r.ref_code}
                            </span>
                            {sc?.band && (
                              <span className="rounded bg-surface-2 px-1.5 text-xs text-muted">
                                صنف {sc.band}
                              </span>
                            )}
                            {saved && (
                              <span className="rounded bg-brand-soft px-1.5 text-xs text-brand">
                                مسجّل
                              </span>
                            )}
                            <span className="text-xs text-muted">{top.join(' · ')}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <Row k="المساحة" v={p.area_m2 ? `${formatNumber(Number(p.area_m2))} م²` : '—'} />
                <Row
                  k="المبنية"
                  v={p.built_area_m2 ? `${formatNumber(Number(p.built_area_m2))} م²` : '—'}
                />
                <Row k="الغرف" v={p.rooms ? String(p.rooms) : '—'} />
                <Row
                  k="التوزيع"
                  v={
                    [
                      p.bedrooms != null && `${p.bedrooms} غرف نوم`,
                      p.living_rooms != null && `${p.living_rooms} صالون`,
                      p.bathrooms != null && `${p.bathrooms} حمّام`,
                      p.floors != null && `${p.floors} طوابق`,
                      p.floor_number != null && `الطابق ${p.floor_number}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                />
                <Row
                  k="الحالة والسنة"
                  v={
                    [
                      p.condition && (CONDITION_AR[p.condition] ?? p.condition),
                      p.year_built && `بُني ${p.year_built}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                />
                <Row
                  k="المرافق"
                  v={
                    (
                      [
                        ['garage', 'جراج'],
                        ['garden', 'حديقة'],
                        ['terrace', 'شرفة/سطح'],
                        ['elevator', 'مصعد'],
                        ['furnished', 'مفروش'],
                        ['water_connected', 'ماء'],
                        ['power_connected', 'كهرباء'],
                        ['road_access', 'طريق نفاذ'],
                        ['buildable', 'قابلة للبناء'],
                      ] as [keyof typeof p, string][]
                    )
                      .filter(([k]) => p[k] === true)
                      .map(([, l]) => l)
                      .join(' · ') || '—'
                  }
                />
                {p.frontage_m != null && <Row k="الواجهة" v={`${p.frontage_m} م`} />}
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
                <button className="rounded bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
                  حفظ
                </button>
              </form>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'brand' | 'gold' }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'gold' ? 'text-gold' : 'text-ink'
  return (
    <div className="rounded border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-0.5 text-xl font-semibold ${color}`}>{formatNumber(value)}</div>
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
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      {label}
    </Link>
  )
}
