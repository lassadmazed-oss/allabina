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
import { NETWORK_PHOTO_BUCKET, defaultPhotoKind, photoStrip, type NetworkPhotoKind } from '@/lib/network-photos'
import { setIntervenantStatusAction } from '@/lib/actions/network'
import NetworkPhotoUpload from '@/components/NetworkPhotoUpload'

export const metadata = { title: 'شبكة المتدخّلين — لوحة القيادة' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string
  ref_code: string | null
  full_name: string
  company_name: string | null
  phone: string
  whatsapp: string | null
  status: string
  legal_status: string
  availability: string
  available_from: string | null
  years_experience: number | null
  created_at: string
  category: { name_ar: string; family_code: string } | null
  delegation: { name_ar: string } | null
}

type PhotoRow = {
  id: string
  intervenant_id: string
  kind: NetworkPhotoKind
  storage_path: string
  caption_ar: string | null
  sort_order: number
  created_at: string
}

const dt = (v: string) => new Date(v).toLocaleDateString('fr-TN')
const digits = (p: string) => p.replace(/\D/g, '')
const waNumber = (p: string) => (digits(p).startsWith('216') ? digits(p) : '216' + digits(p))

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

const AVAILABILITY_DOT: Record<Availability, string> = {
  available: 'bg-[#2f8f5b]',
  busy: 'bg-gold',
  available_from: 'bg-gold-light',
  unavailable: 'bg-line-strong',
}

const PHOTO_FILTERS: Record<string, string> = {
  '': 'بصور وبلا صور',
  with: 'فيها صور أعمال أو منتوجات',
  none: 'بلا صور — تُطلب منه',
}

export default async function ReseauAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; family?: string; q?: string; photos?: string }>
}) {
  const me = await requirePermission('network.read')
  const canManage = can(me.role, 'network.manage')
  const sp = await searchParams
  const q = (sp.q ?? '').trim()

  let query = db
    .from('intervenants')
    .select(
      'id, ref_code, full_name, company_name, phone, whatsapp, status, legal_status, availability, available_from, years_experience, created_at, category:intervenant_categories!category_id(name_ar, family_code), delegation:delegations!delegation_id(name_ar)'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.status && isStatus(sp.status)) query = query.eq('status', sp.status)

  const [{ data: rowsRaw }, { data: families }, { data: allForCount }, { data: photoRaw }] = await Promise.all([
    query,
    db.from('intervenant_families').select('code, name_ar').order('sort_order'),
    db.from('intervenants').select('status, availability'),
    db
      .from('intervenant_photos')
      .select('id, intervenant_id, kind, storage_path, caption_ar, sort_order, created_at')
      .limit(5000),
  ])

  const familyName = new Map(((families ?? []) as { code: string; name_ar: string }[]).map((f) => [f.code, f.name_ar]))

  const photosBy = new Map<string, PhotoRow[]>()
  for (const ph of (photoRaw ?? []) as PhotoRow[]) {
    const list = photosBy.get(ph.intervenant_id) ?? []
    list.push(ph)
    photosBy.set(ph.intervenant_id, list)
  }

  const needle = q.toLowerCase()
  const needleDigits = digits(q)
  const rows = ((rowsRaw ?? []) as unknown as Row[])
    .filter((r) => !sp.family || r.category?.family_code === sp.family)
    .filter((r) => (sp.photos === 'with' ? photosBy.has(r.id) : sp.photos === 'none' ? !photosBy.has(r.id) : true))
    .filter(
      (r) =>
        !needle ||
        [r.ref_code, r.full_name, r.company_name, r.category?.name_ar, r.delegation?.name_ar]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle) ||
        // الهاتف يُكتب بفراغات أو بدونها
        (needleDigits.length >= 3 && [r.phone, r.whatsapp].some((p) => p && digits(p).includes(needleDigits)))
    )

  // الغلاف والمصغّرات فقط لما هو معروض — رابط موقَّع واحد لكلّ صورة، في طلب واحد
  const strips = new Map(rows.map((r) => [r.id, photoStrip(photosBy.get(r.id) ?? [])]))
  const paths = [...strips.values()].flatMap((s) => (s.cover ? [s.cover, ...s.thumbs] : [])).map((p) => p.storage_path)
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await db.storage.from(NETWORK_PHOTO_BUCKET).createSignedUrls(paths, 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const all = allForCount ?? []
  const byStatus = new Map<string, number>()
  for (const r of all) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  const validated = byStatus.get('validated') ?? 0
  const pending = (byStatus.get('new') ?? 0) + (byStatus.get('to_verify') ?? 0) + (byStatus.get('docs_missing') ?? 0)
  const availableNow = all.filter((r) => r.status === 'validated' && r.availability === 'available').length

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { status: sp.status, family: sp.family, q: q || undefined, photos: sp.photos, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v)
    const s = next.toString()
    return s ? `/admin/reseau?${s}` : '/admin/reseau'
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* الرأس: العنوان والأرقام في سطر واحد */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-muted hover:text-brand">
            ← لوحة القيادة
          </Link>
          <h1 className="display mt-1 text-2xl font-bold text-ink">شبكة المتدخّلين والمزوّدين</h1>
          <p className="mt-0.5 text-sm text-muted">
            <span className="num">{all.length}</span> ملفّ · <span className="num">{rows.length}</span> معروض — التسجيل لا يعني
            الاعتماد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi label="معتمَدون في الشبكة" value={validated} tone="green" href={qs({ status: 'validated' })} />
          <Kpi label="تنتظر المعالجة" value={pending} tone="gold" />
          <Kpi label="معتمَدون ومتوفّرون" value={availableNow} tone="brand" />
          <Kpi label="ملفّات فيها صور" value={photosBy.size} href={qs({ photos: 'with' })} />
        </div>
      </div>

      {/* البحث والمجال والصور */}
      <form method="get" className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">بحث</span>
          <IconSearch className="pointer-events-none absolute inset-y-0 start-3 my-auto size-[18px] text-faint" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ابحث: الاسم، الشركة، الهاتف، الاختصاص، المعتمدية…"
            className="h-10 w-full rounded-xl bg-ground ps-10 pe-3 text-sm outline-none ring-1 ring-transparent transition focus:bg-surface focus:ring-brand"
          />
        </label>
        <select name="family" defaultValue={sp.family ?? ''} aria-label="المجال" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">كلّ المجالات</option>
          {[...familyName].map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select name="photos" defaultValue={sp.photos ?? ''} aria-label="الصور" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          {Object.entries(PHOTO_FILTERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep">تطبيق</button>
      </form>

      {/* الحالات */}
      <nav aria-label="حالة الملفّ" className="mt-3 flex gap-1.5 overflow-x-auto pb-1 text-sm [scrollbar-width:none]">
        <Tab active={!sp.status} href={qs({ status: undefined })} label="الكلّ" value={all.length} />
        {INTERVENANT_STATUSES.map((s) => (
          <Tab key={s} active={sp.status === s} href={qs({ status: s })} label={STATUS_LABELS[s]} value={byStatus.get(s) ?? 0} />
        ))}
      </nav>

      {/* البطاقات */}
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-muted">
          ما فمّا حتّى ملفّ بهالفلاتر.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const status = (isStatus(r.status) ? r.status : 'new') as IntervenantStatus
            const moves = nextStatuses(status)
            const strip = strips.get(r.id)!
            const coverUrl = strip.cover ? signed.get(strip.cover.storage_path) : undefined
            const family = r.category?.family_code
            const kind = defaultPhotoKind(family)
            const avail = r.availability as Availability
            const counts = [
              strip.works ? `${strip.works} ${strip.works === 1 ? 'عمل' : 'أعمال'}` : '',
              strip.products ? `${strip.products} ${strip.products === 1 ? 'منتوج' : 'منتوجات'}` : '',
            ]
              .filter(Boolean)
              .join(' · ')

            return (
              <li
                key={r.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md"
              >
                {/* صور الأعمال والمنتوجات */}
                <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
                  {coverUrl ? (
                    <>
                      <Link href={`/admin/reseau/${r.id}#sec-photos`} className="absolute inset-0" aria-label={`صور ${r.full_name}`}>
                        <img
                          src={coverUrl}
                          alt={strip.cover?.caption_ar ?? `${kind === 'product' ? 'منتوج' : 'عمل'} · ${r.full_name}`}
                          loading="lazy"
                          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/75 via-transparent to-brand-deep/20" />
                      </Link>
                      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {strip.thumbs.map((t) => {
                            const url = signed.get(t.storage_path)
                            return url ? (
                              <img key={t.id} src={url} alt="" loading="lazy" className="size-10 rounded-md object-cover ring-2 ring-white/80" />
                            ) : null
                          })}
                          {strip.more > 0 && (
                            <span className="num flex size-10 items-center justify-center rounded-md bg-black/45 text-xs font-semibold text-white ring-2 ring-white/60">
                              +{strip.more}
                            </span>
                          )}
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/95">{counts}</span>
                          {canManage && (
                            <div className="pointer-events-auto">
                              <NetworkPhotoUpload variant="overlay" intervenantId={r.id} defaultKind={kind} />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-x-3 bottom-3 top-11 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-strong/60 bg-ground/60 px-3 text-center">
                      <IconCamera className="size-7 text-faint" />
                      <span className="text-xs font-medium text-muted">صور الأعمال والمنتوجات</span>
                      {canManage ? (
                        <NetworkPhotoUpload variant="slot" intervenantId={r.id} defaultKind={kind} />
                      ) : (
                        <span className="text-[11px] text-faint">ما فمّاش صور بعد</span>
                      )}
                    </div>
                  )}
                  <span className={`absolute start-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${STATUS_TONE[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {family && (
                    <span className="absolute end-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep shadow-sm">
                      {familyName.get(family) ?? family}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/reseau/${r.id}`} className="block truncate text-base font-semibold text-ink hover:text-brand">
                        {r.full_name}
                      </Link>
                      <p className="truncate text-xs text-muted">{[r.category?.name_ar, r.company_name].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <span className="num shrink-0 text-[11px] text-faint" dir="ltr" title={`التسجيل ${dt(r.created_at)}`}>
                      {r.ref_code ?? dt(r.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {r.years_experience != null && (
                      <Fact>
                        <span className="num">{r.years_experience}</span> سنة خبرة
                      </Fact>
                    )}
                    {r.delegation?.name_ar && <Fact>{r.delegation.name_ar}</Fact>}
                    <Fact>{LEGAL_LABELS[r.legal_status as LegalStatus] ?? r.legal_status}</Fact>
                    <Fact>
                      <span className={`size-2 rounded-full ${AVAILABILITY_DOT[avail] ?? 'bg-line-strong'}`} />
                      {AVAILABILITY_LABELS[avail] ?? r.availability}
                      {avail === 'available_from' && r.available_from && <span className="num">{dt(r.available_from)}</span>}
                    </Fact>
                  </div>

                  {/* اتّصال مباشر */}
                  <div className="flex gap-2">
                    <a
                      href={`tel:${digits(r.phone)}`}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-xs font-medium text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      <IconPhone className="size-4" />
                      <span className="num" dir="ltr">
                        {r.phone}
                      </span>
                    </a>
                    <a
                      href={`https://wa.me/${waNumber(r.whatsapp || r.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-[#1f6b3f] transition hover:border-[#1f6b3f]"
                    >
                      <IconChat className="size-4" />
                      واتساب
                    </a>
                  </div>

                  {/* تغيير الحالة السريع */}
                  {canManage && moves.length > 0 && (
                    <form action={setIntervenantStatusAction} className="mt-auto flex flex-wrap items-center gap-1.5 rounded-xl bg-ground p-2">
                      <input type="hidden" name="id" value={r.id} />
                      <select
                        name="status"
                        defaultValue={moves[0]}
                        aria-label="الحالة الجديدة"
                        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs"
                      >
                        {moves.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <input
                        name="note"
                        placeholder="السبب (يُسجَّل)"
                        className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs outline-none focus:border-brand"
                      />
                      <button className="h-8 rounded-lg bg-brand px-3 text-xs font-medium text-white transition hover:bg-brand-deep">حفظ</button>
                    </form>
                  )}
                  <Link
                    href={`/admin/reseau/${r.id}`}
                    className={`${canManage && moves.length > 0 ? '' : 'mt-auto '}text-xs font-medium text-brand hover:underline`}
                  >
                    الملفّ الكامل: مهارات · مناطق · وثائق · صور ←
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-5 text-xs leading-6 text-faint">
        التغيير السريع في البطاقة للحالة وحدها، ويُسجَّل باسمك وسببه في سجلّ الملفّ. المهارات ومناطق التدخّل والوثائق والتوفّر
        والملاحظات، وتعليق كلّ صورة ونوعها، في <b>الملفّ الكامل</b>. الصور داخلية — ما تظهرش في الموقع. الملفّ لا يدخل
        المطابقة إلّا بعد «معتمَد».
      </p>
    </div>
  )
}

const KPI_TONE = { ink: 'text-ink', gold: 'text-gold', green: 'text-[#1f6b3f]', brand: 'text-brand' } as const

function Kpi({ label, value, tone = 'ink', href }: { label: string; value: number; tone?: keyof typeof KPI_TONE; href?: string }) {
  const body = (
    <>
      <div className={`num text-xl font-bold leading-tight ${KPI_TONE[tone]}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </>
  )
  const cls = 'min-w-[6.5rem] rounded-xl border border-line bg-surface px-3.5 py-2 shadow-sm'
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-brand`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Tab({ href, active, label, value }: { href: string; active: boolean; label: string; value: number }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
      }`}
    >
      {label}
      <span className={`num rounded-full px-1.5 text-[11px] ${active ? 'bg-white/20' : 'bg-surface-2 text-faint'}`}>{value}</span>
    </Link>
  )
}

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-lg bg-ground px-2 py-1 text-ink-soft">{children}</span>
}

type IconProps = { className?: string }

function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

function IconCamera({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

function IconPhone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function IconChat({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />
    </svg>
  )
}
