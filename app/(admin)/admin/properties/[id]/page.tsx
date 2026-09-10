import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, requireStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db, getFinanceContext } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/format'
import { formatTND } from '@/lib/finance'
import { reviewPropertyAction } from '@/lib/actions/property-admin'
import { rankRequests, type MatchRequestWithId } from '@/lib/matching'
import { PROPERTY_MEDIA_BUCKET, humanBytes } from '@/lib/property-media'
import { normalizeTnPhone } from '@/lib/sms'
import PropertySimulator, { type SimCandidate } from '@/components/PropertySimulator'
import {
  PROPERTY_CONDITION_AR,
  PROPERTY_KIND_AR,
  PROPERTY_KIND_IMAGE,
  PROPERTY_LEGAL_AR,
  PROPERTY_LEGAL_TONE,
  PROPERTY_STATUS_AR,
  PROPERTY_STATUS_STYLE,
  isDemoProperty,
} from '@/lib/property-labels'

export const metadata = { title: 'عقار — اللَّبنة' }
export const dynamic = 'force-dynamic'

/* eslint-disable @next/next/no-img-element -- صور موقّعة من مخزن خاصّ أو توضيحية ثابتة */

const OPEN_STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment']

const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

const AMENITIES: [string, string][] = [
  ['garage', 'جراج'],
  ['garden', 'حديقة'],
  ['terrace', 'شرفة/سطح'],
  ['elevator', 'مصعد'],
  ['furnished', 'مفروش'],
  ['water_connected', 'ماء'],
  ['power_connected', 'كهرباء'],
  ['road_access', 'طريق نفاذ'],
  ['buildable', 'قابلة للبناء'],
]

/**
 * صفحة عقار: الصور، المعطيات، المراجعة، المالك — ثمّ المحاكي والحرفاء
 * المطابقون بحلّ كلّ واحد. القائمة تبقى خفيفة، والتفصيل هنا.
 */
export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('requests.read')
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')
  const { id } = await params

  const { data: raw } = await db.from('properties').select('*').eq('id', id).maybeSingle()
  if (!raw) notFound()
  const p = raw as Record<string, unknown> & {
    id: string
    ref_code: string
    kind: string
    gov_code: string
    delegation_id: number | null
    imada_id: number | null
    status: string
    negotiable: boolean
    owner_name: string
    owner_phone: string
  }

  const [{ data: deleg }, { data: reqRows }, { data: scoreRows }, { data: saved }, { data: mediaRows }, finance] = await Promise.all([
    p.delegation_id ? db.from('delegations').select('name_ar').eq('id', p.delegation_id).maybeSingle() : Promise.resolve({ data: null }),
    db
      .from('housing_requests')
      .select('id, ref_code, full_name, request_type, gov_code, delegation_id, imada_id, desired_area_m2, owns_land')
      .in('status', OPEN_STATUSES)
      .limit(500),
    db.from('scores').select('request_id, band, max_budget_tnd, computed_at').order('computed_at', { ascending: false }).limit(1500),
    db.from('matches').select('request_id').eq('property_id', id),
    db
      .from('property_media')
      .select('id, kind, storage_path, original_name, bytes, sort_order')
      .eq('property_id', id)
      .not('storage_path', 'is', null)
      .order('sort_order'),
    getFinanceContext(),
  ])

  const scoreByRequest = new Map<string, { band: string; maxBudget: number | null }>()
  for (const s of scoreRows ?? []) {
    if (!scoreByRequest.has(s.request_id)) scoreByRequest.set(s.request_id, { band: String(s.band), maxBudget: n(s.max_budget_tnd) })
  }
  type Req = { id: string; ref_code: string; full_name: string; request_type: string; gov_code: string; delegation_id: number | null; imada_id: number | null; desired_area_m2: number | null; owns_land: boolean }
  const requests = (reqRows ?? []) as Req[]
  const reqById = new Map(requests.map((r) => [r.id, r]))
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

  const price = n(p.price_tnd)
  const ranked = rankRequests(
    {
      id: p.id,
      kind: p.kind,
      govCode: p.gov_code,
      delegationId: p.delegation_id,
      imadaId: p.imada_id,
      areaM2: n(p.area_m2),
      builtAreaM2: n(p.built_area_m2),
      priceTnd: price,
      status: p.status,
    },
    pool,
    { limit: 10 }
  )

  const { data: fins } = ranked.length
    ? await db
        .from('financial_profiles')
        .select('request_id, monthly_income_tnd, spouse_income_tnd, other_income_tnd, existing_loans_tnd, down_payment_tnd')
        .in('request_id', ranked.map((m) => m.requestId))
    : { data: [] as Record<string, unknown>[] }
  const finById = new Map((fins ?? []).map((f) => [String(f.request_id), f]))
  const savedIds = new Set((saved ?? []).map((m) => String(m.request_id)))

  const candidates: SimCandidate[] = ranked.flatMap((m) => {
    const r = reqById.get(m.requestId)
    if (!r) return []
    const f = finById.get(m.requestId)
    return [
      {
        id: r.id,
        name: r.full_name,
        ref: r.ref_code,
        band: scoreByRequest.get(r.id)?.band ?? null,
        score: m.score,
        reasons: m.reasons
          .filter((x) => x.points > 0)
          .sort((a, b) => b.points - a.points)
          .slice(0, 2)
          .map((x) => x.ar),
        reasonsJson: JSON.stringify(m.reasons),
        budget: scoreByRequest.get(r.id)?.maxBudget ?? null,
        income: f ? Number(f.monthly_income_tnd ?? 0) + Number(f.spouse_income_tnd ?? 0) + Number(f.other_income_tnd ?? 0) : null,
        existingLoans: f ? Number(f.existing_loans_tnd ?? 0) : 0,
        downPayment: f ? Number(f.down_payment_tnd ?? 0) : 0,
        saved: savedIds.has(r.id),
      },
    ]
  })

  type Media = { id: number; kind: string; storage_path: string; original_name: string | null; bytes: number | null }
  const media = (mediaRows ?? []) as Media[]
  const signed = new Map<string, string>()
  if (media.length) {
    const { data } = await db.storage.from(PROPERTY_MEDIA_BUCKET).createSignedUrls(media.map((m) => m.storage_path), 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  const photos = media.filter((m) => m.kind === 'photo' && signed.has(m.storage_path))
  const videos = media.filter((m) => m.kind === 'video' && signed.has(m.storage_path))
  const cover = photos[0] ? signed.get(photos[0].storage_path) : null

  const delegName = (deleg as { name_ar?: string } | null)?.name_ar ?? null
  const legal = p.legal_status ? String(p.legal_status) : null
  const facts: [string, string][] = (
    [
      ['المساحة', n(p.area_m2) ? `${formatNumber(Number(p.area_m2))} م²` : null],
      ['المبنية', n(p.built_area_m2) ? `${formatNumber(Number(p.built_area_m2))} م²` : null],
      ['الغرف', n(p.rooms) ? String(p.rooms) : null],
      ['غرف النوم', n(p.bedrooms) !== null ? String(p.bedrooms) : null],
      ['الصالون', n(p.living_rooms) !== null ? String(p.living_rooms) : null],
      ['الحمّامات', n(p.bathrooms) !== null ? String(p.bathrooms) : null],
      ['الطوابق', n(p.floors) ? String(p.floors) : null],
      ['الطابق', n(p.floor_number) !== null ? String(p.floor_number) : null],
      ['سنة البناء', n(p.year_built) ? String(p.year_built) : null],
      ['الحالة', p.condition ? PROPERTY_CONDITION_AR[String(p.condition)] ?? String(p.condition) : null],
      ['الواجهة', n(p.frontage_m) ? `${p.frontage_m} م` : null],
      ['الموقع', p.address ? String(p.address) : null],
    ] as [string, string | null][]
  ).filter((f): f is [string, string] => Boolean(f[1]))
  const amenities = AMENITIES.filter(([k]) => p[k] === true).map(([, l]) => l)
  const wa = normalizeTnPhone(String(p.owner_phone ?? ''))

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/admin/properties" className="text-xs text-muted hover:text-brand">
        ← العقارات المعروضة
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="num rounded bg-brand-soft px-2 py-0.5 text-brand" dir="ltr">
              {p.ref_code}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ring-1 ${PROPERTY_STATUS_STYLE[p.status] ?? 'bg-surface-2 text-muted ring-line'}`}>
              {PROPERTY_STATUS_AR[p.status] ?? p.status}
            </span>
            {isDemoProperty(p.description as string | null) && <span className="rounded bg-surface-2 px-1.5 text-faint">عقار تجريبي</span>}
          </div>
          <h1 className="display mt-1.5 text-2xl font-bold text-ink">
            {PROPERTY_KIND_AR[p.kind] ?? p.kind}
            {delegName ? ` · ${delegName}` : ''}
            <span className="text-muted">{p.gov_code === 'SFX' ? ' · صفاقس' : ` · ${p.gov_code}`}</span>
          </h1>
        </div>
        <div className="text-end">
          <div className="num text-3xl font-bold text-brand-deep">{price ? formatTND(price) : 'الثمن غير مصرّح'}</div>
          {price && p.negotiable ? <div className="text-xs text-muted">قابل للتفاوض</div> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* الصور */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="relative aspect-[16/9] bg-surface-2">
              <img src={cover ?? PROPERTY_KIND_IMAGE[p.kind] ?? PROPERTY_KIND_IMAGE.other} alt="" className="size-full object-cover" />
              {!cover && (
                <span className="absolute bottom-3 end-3 rounded bg-black/45 px-2 py-0.5 text-xs text-white">
                  صورة توضيحية — المالك ما رفعش صوراً
                </span>
              )}
            </div>
            {(photos.length > 1 || videos.length > 0) && (
              <ul className="flex gap-2 overflow-x-auto p-3">
                {photos.slice(1).map((m) => (
                  <li key={m.id} className="shrink-0">
                    <a href={signed.get(m.storage_path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-line hover:ring-brand">
                      <img src={signed.get(m.storage_path)} alt="" className="h-20 w-28 object-cover" />
                    </a>
                  </li>
                ))}
                {videos.map((m) => (
                  <li key={m.id} className="shrink-0">
                    <a
                      href={signed.get(m.storage_path)}
                      target="_blank"
                      rel="noreferrer"
                      title={`${m.original_name ?? ''}${m.bytes ? ` · ${humanBytes(m.bytes)}` : ''}`}
                      className="flex h-20 w-28 items-center justify-center rounded-lg bg-brand-deep text-xs text-white ring-1 ring-line hover:ring-brand"
                    >
                      ▶ فيديو
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* المعطيات */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {legal && (
                <div className="rounded-xl bg-ground p-3">
                  <dt className="text-xs text-muted">الوضعية القانونية</dt>
                  <dd className={`mt-0.5 text-sm font-semibold ${PROPERTY_LEGAL_TONE[legal] ?? 'text-ink'}`}>{PROPERTY_LEGAL_AR[legal] ?? legal}</dd>
                </div>
              )}
              {facts.map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ground p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="num mt-0.5 text-sm font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {amenities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {amenities.map((a) => (
                  <span key={a} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {p.description ? <p className="mt-4 text-sm leading-7 text-ink-soft">{String(p.description)}</p> : null}
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          {canEdit && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-ink">قرار المراجعة</h2>
              {p.status === 'pending' && (
                <p className="mt-1 text-xs leading-6 text-gold">العرض غير المراجَع لا يدخل المطابقة — قرّر فيه.</p>
              )}
              <form action={reviewPropertyAction} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROPERTY_STATUS_AR).map(([k, v]) => (
                    <label
                      key={k}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand"
                    >
                      <input type="radio" name="status" value={k} defaultChecked={p.status === k} className="accent-brand" />
                      {v}
                    </label>
                  ))}
                </div>
                <input
                  name="review_note"
                  defaultValue={(p.review_note as string | null) ?? ''}
                  placeholder="ملاحظة: مثال تثبّتنا من الرسم العقاري"
                  className="h-10 w-full rounded-lg border border-line bg-ground px-3 text-sm"
                />
                <button className="h-10 w-full rounded-lg bg-brand text-sm font-semibold text-white transition hover:bg-brand-deep">حفظ القرار</button>
              </form>
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">المالك</h2>
            <div className="mt-2 text-sm font-medium">{p.owner_name}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`tel:${p.owner_phone}`} className="num rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-deep" dir="ltr">
                {p.owner_phone}
              </a>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#1f8f4e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#177240]">
                  واتساب
                </a>
              )}
            </div>
            {p.owner_email ? <div className="mt-2 truncate text-xs text-muted">{String(p.owner_email)}</div> : null}
            {p.owner_note ? <p className="mt-2 text-xs leading-6 text-muted">{String(p.owner_note)}</p> : null}
          </div>
        </aside>
      </div>

      <div className="mt-5">
        <PropertySimulator
          propertyId={p.id}
          price={price}
          defaults={{
            downPct: 20,
            years: finance.assumptions.maxYears,
            ratePct: finance.assumptions.annualRatePct,
            dtiPct: finance.assumptions.maxDtiPct,
            maxYears: finance.assumptions.maxYears,
          }}
          candidates={candidates}
          canEdit={canEdit}
          note={`${finance.assumptionNote}. القرار النهائي للبنك.`}
        />
      </div>
    </div>
  )
}
