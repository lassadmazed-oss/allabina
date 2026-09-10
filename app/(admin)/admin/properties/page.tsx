import Link from 'next/link'
import { requirePermission, requireStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db, getFinanceContext } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/format'
import { formatTND } from '@/lib/finance'
import { reviewPropertyAction } from '@/lib/actions/property-admin'
import { findOpportunities, rankRequests, type MatchProperty, type MatchRequestWithId } from '@/lib/matching'
import { LABELS } from '@/lib/schema'
import { PROPERTY_MEDIA_BUCKET } from '@/lib/property-media'
import { simulate } from '@/lib/property-sim'
import {
  PROPERTY_KIND_AR,
  PROPERTY_KIND_IMAGE,
  PROPERTY_LEGAL_AR,
  PROPERTY_LEGAL_TONE,
  PROPERTY_STATUS_AR,
  PROPERTY_STATUS_STYLE,
  isDemoProperty,
} from '@/lib/property-labels'

export const metadata = { title: 'العقارات المعروضة — اللَّبنة' }
export const dynamic = 'force-dynamic'

/* eslint-disable @next/next/no-img-element -- صور موقّعة من مخزن خاصّ أو توضيحية ثابتة */

/** المطالب التي ما زالت تنتظر حلّاً — المغلقة لا تُقترح على عرض */
const OPEN_STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment']

const SORTS = {
  matches: 'الأكثر طلباً',
  price_asc: 'الأقلّ ثمناً',
  price_desc: 'الأعلى ثمناً',
  new: 'الأحدث',
} as const
type SortKey = keyof typeof SORTS

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
  bathrooms: number | null
  price_tnd: number | null
  negotiable: boolean
  legal_status: string | null
  description: string | null
  owner_name: string
  owner_phone: string
  status: string
  created_at: string
}

type RequestRow = {
  id: string
  full_name: string
  request_type: string
  gov_code: string
  delegation_id: number | null
  imada_id: number | null
  desired_area_m2: number | null
  owns_land: boolean
}

type Search = { status?: string; kind?: string; q?: string; sort?: string }

/** رابط القائمة بنفس الفلاتر مع تبديل مفتاح واحد */
function hrefWith(sp: Search, patch: Partial<Search>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) params.set(k, v)
  const qs = params.toString()
  return qs ? `/admin/properties?${qs}` : '/admin/properties'
}

const n = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v))

/**
 * العقارات المعروضة — شبكة بطاقات بدل صفحة طويلة.
 *
 * كلّ عرض بطاقة تُقرأ بنظرة: صورة (أو صورة توضيحية موسومة)، الثمن، المكان،
 * المساحات، الوضعية القانونية، قسط تقديري، ومن ينتظره من الحرفاء. التفاصيل،
 * المحاكي، وحلول كلّ حريف في صفحة العقار. العروض المنتظرة تُقبل أو تُرفض
 * من البطاقة نفسها.
 */
export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission('requests.read')
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')
  const sp = await searchParams
  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : 'matches'
  const q = (sp.q ?? '').trim().slice(0, 60)

  const [{ data: rows }, { data: delegs }, { data: reqRows }, { data: scoreRows }, finance] = await Promise.all([
    db
      .from('properties')
      .select(
        'id, ref_code, kind, gov_code, delegation_id, imada_id, address, area_m2, built_area_m2, rooms, bedrooms, bathrooms, price_tnd, negotiable, legal_status, description, owner_name, owner_phone, status, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('delegations').select('id, name_ar'),
    db
      .from('housing_requests')
      .select('id, full_name, request_type, gov_code, delegation_id, imada_id, desired_area_m2, owns_land')
      .in('status', OPEN_STATUSES)
      .limit(500),
    db.from('scores').select('request_id, band, max_budget_tnd, computed_at').order('computed_at', { ascending: false }).limit(1500),
    getFinanceContext(),
  ])

  const allProperties = (rows ?? []) as Property[]
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar as string]))

  const scoreByRequest = new Map<string, { band: string; maxBudget: number | null }>()
  for (const s of scoreRows ?? []) {
    if (!scoreByRequest.has(s.request_id)) {
      scoreByRequest.set(s.request_id, { band: String(s.band), maxBudget: n(s.max_budget_tnd) })
    }
  }

  const requests = (reqRows ?? []) as RequestRow[]
  const nameById = new Map(requests.map((r) => [r.id, r.full_name]))
  const pool: MatchRequestWithId[] = requests.map((r) => ({
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

  const asMatch = (p: Property): MatchProperty => ({
    id: p.id,
    kind: p.kind,
    govCode: p.gov_code,
    delegationId: p.delegation_id,
    imadaId: p.imada_id,
    areaM2: n(p.area_m2),
    builtAreaM2: n(p.built_area_m2),
    priceTnd: n(p.price_tnd),
    status: p.status,
  })

  const matchesByProperty = new Map(allProperties.map((p) => [p.id, rankRequests(asMatch(p), pool, { limit: 8 })]))
  const totalPairs = [...matchesByProperty.values()].reduce((sum, list) => sum + list.length, 0)
  const opportunities = findOpportunities(pool, allProperties.map(asMatch))
    .filter((o) => o.pairs > 0)
    .slice(0, 8)

  // الصورة الأولى لكلّ عرض — المخزن خاصّ، فالعرض بروابط موقّتة
  const ids = allProperties.map((p) => p.id)
  const { data: mediaRows } = ids.length
    ? await db
        .from('property_media')
        .select('property_id, storage_path, sort_order')
        .in('property_id', ids)
        .eq('kind', 'photo')
        .not('storage_path', 'is', null)
        .order('sort_order')
    : { data: [] as { property_id: string; storage_path: string }[] }
  const coverPath = new Map<string, string>()
  const photoCount = new Map<string, number>()
  for (const m of mediaRows ?? []) {
    photoCount.set(m.property_id, (photoCount.get(m.property_id) ?? 0) + 1)
    if (!coverPath.has(m.property_id)) coverPath.set(m.property_id, m.storage_path)
  }
  const coverUrl = new Map<string, string>()
  if (coverPath.size) {
    const { data: signed } = await db.storage.from(PROPERTY_MEDIA_BUCKET).createSignedUrls([...coverPath.values()], 3600)
    const byPath = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl]))
    for (const [pid, path] of coverPath) {
      const url = byPath.get(path)
      if (url) coverUrl.set(pid, url)
    }
  }

  const count = (status?: string) => allProperties.filter((p) => !status || p.status === status).length
  const needle = q.toLowerCase()
  const listed = allProperties
    .filter((p) => !sp.status || p.status === sp.status)
    .filter((p) => !sp.kind || p.kind === sp.kind)
    .filter(
      (p) =>
        !needle ||
        [p.ref_code, p.owner_name, p.owner_phone, p.address ?? '', p.delegation_id ? delegName.get(p.delegation_id) ?? '' : '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
    )
    .sort((a, b) => {
      if (sort === 'price_asc') return (n(a.price_tnd) ?? Infinity) - (n(b.price_tnd) ?? Infinity)
      if (sort === 'price_desc') return (n(b.price_tnd) ?? -1) - (n(a.price_tnd) ?? -1)
      if (sort === 'new') return b.created_at.localeCompare(a.created_at)
      const ma = matchesByProperty.get(a.id) ?? []
      const mb = matchesByProperty.get(b.id) ?? []
      return mb.length - ma.length || (mb[0]?.score ?? 0) - (ma[0]?.score ?? 0)
    })

  const terms = {
    downPct: 20,
    years: finance.assumptions.maxYears,
    ratePct: finance.assumptions.annualRatePct,
    dtiPct: finance.assumptions.maxDtiPct,
  }
  const pendingCount = count('pending')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* الرأس: العنوان والأرقام في سطر واحد */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-muted hover:text-brand">
            ← لوحة القيادة
          </Link>
          <h1 className="display mt-1 text-2xl font-bold text-ink">العقارات المعروضة</h1>
          <p className="mt-0.5 text-sm text-muted">تُراجَع هنا قبل أن تدخل المطابقة، ولا تظهر في الموقع.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi label="عروض" value={count()} />
          <Kpi label="تنتظر قرارك" value={pendingCount} tone="gold" href={hrefWith(sp, { status: 'pending' })} />
          <Kpi label="صالحة للمطابقة" value={count('approved')} tone="green" />
          <Kpi label="تقاطعات مع حرفاء" value={totalPairs} tone="brand" />
        </div>
      </div>

      {pendingCount > 0 && sp.status !== 'pending' && (
        <Link
          href={hrefWith(sp, { status: 'pending' })}
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-2.5 text-sm text-gold transition hover:border-gold"
        >
          <span>
            <b className="num">{pendingCount}</b> عرض ينتظر قرارك — غير المراجَع لا يدخل المطابقة.
          </span>
          <span className="font-semibold">اعرضها ←</span>
        </Link>
      )}

      {/* البحث والترتيب */}
      <form method="get" className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">بحث</span>
          <IconSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto size-[18px] text-faint" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ابحث: الرمز، المعتمدية، المالك، الهاتف…"
            className="h-10 w-full rounded-xl bg-ground ps-10 pe-3 text-sm outline-none ring-1 ring-transparent transition focus:bg-surface focus:ring-brand"
          />
        </label>
        <select name="kind" defaultValue={sp.kind ?? ''} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">كلّ الأنواع</option>
          {Object.entries(PROPERTY_KIND_AR).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep">تطبيق</button>
      </form>

      {/* الحالات */}
      <nav aria-label="حالة العرض" className="mt-3 flex gap-1.5 overflow-x-auto pb-1 text-sm [scrollbar-width:none]">
        <Tab active={!sp.status} href={hrefWith(sp, { status: '' })} label="الكلّ" value={count()} />
        {Object.entries(PROPERTY_STATUS_AR).map(([k, v]) => (
          <Tab key={k} active={sp.status === k} href={hrefWith(sp, { status: k })} label={v} value={count(k)} />
        ))}
      </nav>

      {/* أين يلتقي الطلب بالعرض — مطويّ حتى يُطلب */}
      {opportunities.length > 0 && (
        <details className="group mt-3 rounded-2xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <b className="text-ink">أين يلتقي الطلب بالعرض</b>
              <span className="ms-2 text-muted">
                <span className="num">{opportunities.length}</span> مناطق فيها حرفاء وعروض مطابقة
              </span>
            </span>
            <IconChevron className="size-4 text-muted transition group-open:rotate-180" />
          </summary>
          <ul className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
            {opportunities.map((o) => {
              const max = Math.max(o.demand, o.supply, 1)
              return (
                <li key={`${o.delegationId}-${o.requestType}`} className="rounded-xl bg-ground p-3 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {o.delegationId ? delegName.get(o.delegationId) ?? '—' : 'غير محدّدة'}
                      <span className="ms-1.5 font-normal text-muted">{LABELS.requestType[o.requestType] ?? o.requestType}</span>
                    </span>
                    <span className="num rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">{o.pairs} تقاطع</span>
                  </div>
                  <Bar label="حرفاء" value={o.demand} max={max} cls="bg-gold-light" />
                  <Bar label="عروض مطابقة" value={o.supply} max={max} cls="bg-brand" />
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {/* البطاقات */}
      {listed.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
          ما فمّا حتّى عرض بهالفلاتر.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listed.map((p) => {
            const matches = matchesByProperty.get(p.id) ?? []
            const price = n(p.price_tnd)
            const cover = coverUrl.get(p.id)
            const photos = photoCount.get(p.id) ?? 0
            const deleg = p.delegation_id ? delegName.get(p.delegation_id) : null
            const sim = price ? simulate(price, terms) : null
            const withinBudget = price
              ? matches.filter((m) => {
                  const b = scoreByRequest.get(m.requestId)?.maxBudget
                  return b !== null && b !== undefined && b >= price
                }).length
              : 0
            const specs = [
              n(p.area_m2) ? { icon: IconArea, text: `${formatNumber(Number(p.area_m2))} م²`, title: 'المساحة' } : null,
              n(p.built_area_m2) ? { icon: IconBuilt, text: `${formatNumber(Number(p.built_area_m2))} م²`, title: 'المبنية' } : null,
              (p.bedrooms ?? p.rooms) ? { icon: IconBed, text: String(p.bedrooms ?? p.rooms), title: 'الغرف' } : null,
              p.bathrooms ? { icon: IconBath, text: String(p.bathrooms), title: 'الحمّامات' } : null,
            ].filter(Boolean) as { icon: typeof IconArea; text: string; title: string }[]

            return (
              <li
                key={p.id}
                id={p.ref_code}
                className="group flex scroll-mt-6 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href={`/admin/properties/${p.id}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
                  <img
                    src={cover ?? PROPERTY_KIND_IMAGE[p.kind] ?? PROPERTY_KIND_IMAGE.other}
                    alt={`${PROPERTY_KIND_AR[p.kind] ?? p.kind}${deleg ? ` · ${deleg}` : ''}`}
                    loading="lazy"
                    className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/80 via-brand-deep/10 to-transparent" />
                  <span
                    className={`absolute start-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                      PROPERTY_STATUS_STYLE[p.status] ?? 'bg-surface-2 text-muted ring-line'
                    }`}
                  >
                    {PROPERTY_STATUS_AR[p.status] ?? p.status}
                  </span>
                  <span className="absolute end-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
                    {PROPERTY_KIND_AR[p.kind] ?? p.kind}
                  </span>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-white">
                    <div className="min-w-0">
                      <div className="num text-xl font-bold leading-tight drop-shadow">{price ? formatTND(price) : 'الثمن غير مصرّح'}</div>
                      <div className="truncate text-xs text-white/85">
                        {deleg ?? '—'}
                        {p.gov_code === 'SFX' ? ' · صفاقس' : ` · ${p.gov_code}`}
                        {p.negotiable && price ? ' · قابل للتفاوض' : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-white/90">
                      {cover ? `${photos} صور` : 'صورة توضيحية'}
                    </span>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="num text-brand" dir="ltr">
                      {p.ref_code}
                    </span>
                    <span className="flex items-center gap-2">
                      {isDemoProperty(p.description) && <span className="rounded bg-surface-2 px-1.5 text-faint">تجريبي</span>}
                      {p.legal_status && (
                        <span className={`font-medium ${PROPERTY_LEGAL_TONE[p.legal_status] ?? 'text-muted'}`}>
                          {PROPERTY_LEGAL_AR[p.legal_status] ?? p.legal_status}
                        </span>
                      )}
                    </span>
                  </div>

                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {specs.map(({ icon: Icon, text, title }) => (
                        <span key={title} title={title} className="inline-flex items-center gap-1 rounded-lg bg-ground px-2 py-1 text-xs text-ink-soft">
                          <Icon className="size-3.5 text-muted" />
                          <span className="num">{text}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {sim && sim.monthly > 0 && (
                    <p className="text-xs text-muted">
                      قسط تقديري <b className="num text-ink">{formatTND(sim.monthly)}</b>/شهر · دخل لازم{' '}
                      <span className="num">{formatTND(sim.incomeNeeded)}</span>
                    </p>
                  )}

                  {/* من ينتظر هذا العرض */}
                  {matches.length > 0 ? (
                    <Link
                      href={`/admin/properties/${p.id}#clients`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft/60 px-3 py-2 transition hover:bg-brand-soft"
                    >
                      <span className="flex items-center">
                        {matches.slice(0, 3).map((m, i) => (
                          <span
                            key={m.requestId}
                            title={nameById.get(m.requestId)}
                            className={`flex size-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white ring-2 ring-surface ${i ? '-ms-2' : ''}`}
                          >
                            {(nameById.get(m.requestId) ?? '؟').trim().charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </span>
                      <span className="text-end text-xs text-brand">
                        <b className="num">{matches.length}</b> حريف مطابق · أعلى <b className="num">{matches[0].score}%</b>
                        {price ? (
                          <span className="block text-[11px] text-muted">
                            <span className="num">{withinBudget}</span> في حدود ميزانيتهم
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ) : (
                    <p className="rounded-xl bg-ground px-3 py-2 text-xs text-muted">
                      {p.status === 'approved' ? 'لا حريف مطابق توّا في هالمنطقة وهالميزانية.' : 'غير مراجَع — خارج المطابقة حتى تقرّر فيه.'}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    {canEdit && p.status === 'pending' ? (
                      <>
                        <form action={reviewPropertyAction} className="flex-1">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="approved" />
                          <button className="h-9 w-full rounded-lg bg-[#1f8f4e] text-xs font-semibold text-white transition hover:bg-[#177240]">
                            اقبله للمطابقة
                          </button>
                        </form>
                        <form action={reviewPropertyAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button className="h-9 rounded-lg border border-line px-3 text-xs font-medium text-[#8c2f22] transition hover:border-[#8c2f22]">
                            ارفض
                          </button>
                        </form>
                        <Link href={`/admin/properties/${p.id}`} className="h-9 rounded-lg border border-line px-3 text-xs font-medium leading-9 text-brand hover:border-brand">
                          افتح
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-soft"
                      >
                        التفاصيل والمحاكي والحلول
                        <IconArrow className="size-3.5 rtl:-scale-x-100" />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Kpi({ label, value, tone, href }: { label: string; value: number; tone?: 'brand' | 'gold' | 'green'; href?: string }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'gold' ? 'text-gold' : tone === 'green' ? 'text-[#1f6b3f]' : 'text-ink'
  const body = (
    <>
      <span className={`num text-lg font-bold leading-none ${color}`}>{formatNumber(value)}</span>
      <span className="text-xs text-muted">{label}</span>
    </>
  )
  const cls = 'flex items-baseline gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm'
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-brand`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Tab({ active, href, label, value }: { active: boolean; href: string; label: string; value: number }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong'
      }`}
    >
      {label}
      <span className={`num rounded-full px-1.5 text-[11px] ${active ? 'bg-white/20' : 'bg-surface-2 text-muted'}`}>{value}</span>
    </Link>
  )
}

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="h-1.5 flex-1 rounded-full bg-surface-2">
        <span className={`block h-1.5 rounded-full ${cls}`} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="num w-6 text-end text-ink">{value}</span>
    </div>
  )
}

type IconProps = { className?: string }
const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true }

function IconSearch({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
  )
}
function IconChevron({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function IconArrow({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function IconArea({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}
function IconBuilt({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M3 11l9-7 9 7M5 10v10h14V10" />
    </svg>
  )
}
function IconBed({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V7h4v2" />
    </svg>
  )
}
function IconBath({ className }: IconProps) {
  return (
    <svg {...svg} className={className}>
      <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 4 0" />
    </svg>
  )
}
