import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/supabase/server'
import {
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  LEGAL_LABELS,
  STATUS_LABELS,
  isStatus,
  nextStatuses,
  type Availability,
  type IntervenantStatus,
  type LegalStatus,
} from '@/lib/network'
import {
  addIntervenantNoteAction,
  setAvailabilityAction,
  setIntervenantStatusAction,
} from '@/lib/actions/network'

export const dynamic = 'force-dynamic'

const EVENT_LABELS: Record<string, string> = {
  created: 'تسجيل',
  status_change: 'تغيير حالة',
  note: 'ملاحظة',
  document: 'وثيقة',
  contact: 'اتّصال',
}

const dt = (v: string | null) =>
  v ? new Date(v).toLocaleString('ar-TN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const digits = (p: string) => p.replace(/\D/g, '')

export default async function IntervenantPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission('network.read')
  const canManage = can(me.role, 'network.manage')
  const { id } = await params

  const { data: p } = await db
    .from('intervenants')
    .select(
      'id, ref_code, full_name, company_name, phone, whatsapp, email, legal_status, years_experience, bio, gov_code, delegation_id, zone_id, address, radius_km, availability, available_from, status, status_note, validated_at, created_at, source, category_id, category:intervenant_categories!category_id(id, name_ar, name_fr, family_code), delegation:delegations!delegation_id(name_ar), zone:zones!zone_id(name_ar)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!p) notFound()

  const [
    { data: skillRows },
    { data: zoneRows },
    { data: extraRows },
    { data: docRules },
    { data: docRows },
    { data: eventRows },
  ] = await Promise.all([
    db.from('intervenant_skills').select('skills(id, name_ar, name_fr)').eq('intervenant_id', id),
    db.from('intervenant_zones').select('delegations(id, name_ar)').eq('intervenant_id', id),
    db
      .from('intervenant_extra_categories')
      .select('intervenant_categories(id, name_ar)')
      .eq('intervenant_id', id),
    db
      .from('category_documents')
      .select('document_code, is_required, document_types(name_ar)')
      .eq('category_id', p.category_id),
    db.from('intervenant_documents').select('document_code, is_verified, url, expires_at').eq('intervenant_id', id),
    db
      .from('intervenant_events')
      .select('id, event_type, from_status, to_status, note, actor, created_at')
      .eq('intervenant_id', id)
      .order('created_at', { ascending: false }),
  ])

  /** علاقة واحد-إلى-واحد قد تصل مصفوفةً أو كائناً حسب الاستنتاج — نوحّدها */
  const one = <T,>(v: unknown): T | null =>
    Array.isArray(v) ? ((v[0] ?? null) as T | null) : ((v ?? null) as T | null)

  type Named = { name_ar: string }
  const skills = (skillRows ?? [])
    .map((r) => one<Named>((r as Record<string, unknown>).skills))
    .filter(Boolean) as Named[]
  const zones = (zoneRows ?? [])
    .map((r) => one<Named>((r as Record<string, unknown>).delegations))
    .filter(Boolean) as Named[]
  const extras = (extraRows ?? [])
    .map((r) => one<Named>((r as Record<string, unknown>).intervenant_categories))
    .filter(Boolean) as Named[]

  const delivered = new Map(
    ((docRows ?? []) as { document_code: string; is_verified: boolean }[]).map((d) => [d.document_code, d])
  )
  const rules = (docRules ?? [])
    .map((r) => {
      const row = r as Record<string, unknown>
      return {
        document_code: String(row.document_code),
        is_required: Boolean(row.is_required),
        label: one<Named>(row.document_types)?.name_ar ?? String(row.document_code),
      }
    })
    .sort((a, b) => Number(b.is_required) - Number(a.is_required))
  const missingRequired = rules.filter((r) => r.is_required && !delivered.has(r.document_code)).length

  const status = (isStatus(p.status) ? p.status : 'new') as IntervenantStatus
  const moves = nextStatuses(status)
  const cat = one<Named>(p.category)
  const deleg = one<Named>(p.delegation)
  const zone = one<Named>(p.zone)

  // من غيّر الحالة: نجلب أسماء الفريق مرّة واحدة
  const actorIds = [...new Set((eventRows ?? []).map((e) => e.actor).filter(Boolean))] as string[]
  const { data: staffRows } = actorIds.length
    ? await db.from('staff').select('user_id, full_name, email').in('user_id', actorIds)
    : { data: [] }
  const actorName = new Map(
    ((staffRows ?? []) as { user_id: string; full_name: string | null; email: string | null }[]).map((s) => [
      s.user_id,
      s.full_name ?? s.email ?? '—',
    ])
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <Link href="/admin/reseau" className="text-sm text-muted hover:text-brand">
        ← شبكة المتدخّلين
      </Link>

      {/* ---------- الترويسة ---------- */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="num text-sm text-brand" dir="ltr">
            {p.ref_code}
          </span>
          <h1 className="display mt-1 text-lg font-semibold">{p.full_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {cat?.name_ar ?? '—'}
            {p.company_name ? ` · ${p.company_name}` : ''}
            {p.years_experience != null ? ` · ${p.years_experience} سنة خبرة` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium">
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-faint">
            {AVAILABILITY_LABELS[p.availability as Availability] ?? p.availability}
            {p.available_from ? ` · من ${p.available_from}` : ''}
          </span>
        </div>
      </div>

      {/* ---------- اتّصال مباشر ---------- */}
      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={`tel:${digits(p.phone)}`}
          className="rounded border border-line bg-surface px-4 py-2 text-sm hover:border-brand hover:text-brand"
        >
          اتّصل · <span className="num" dir="ltr">{p.phone}</span>
        </a>
        {p.whatsapp && (
          <a
            href={`https://wa.me/${digits(p.whatsapp).startsWith('216') ? digits(p.whatsapp) : '216' + digits(p.whatsapp)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-line bg-surface px-4 py-2 text-sm hover:border-brand hover:text-brand"
          >
            واتساب · <span className="num" dir="ltr">{p.whatsapp}</span>
          </a>
        )}
        {p.email && (
          <a
            href={`mailto:${p.email}`}
            className="rounded border border-line bg-surface px-4 py-2 text-sm hover:border-brand hover:text-brand"
            dir="ltr"
          >
            {p.email}
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* ---------- الملفّ ---------- */}
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">شنوّة ينجّم يعمل</h2>
            {skills.length === 0 ? (
              <p className="mt-2 text-sm text-faint">ما اختار حتّى مهارة عند التسجيل.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <li
                    key={i}
                    className="rounded border border-brand/30 bg-brand-soft px-3 py-1 text-sm text-brand"
                  >
                    {s.name_ar}
                  </li>
                ))}
              </ul>
            )}

            {extras.length > 0 && (
              <>
                <h3 className="mt-5 text-xs font-medium text-muted">اختصاصات إضافية</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {extras.map((c, i) => (
                    <li key={i} className="rounded border border-line px-3 py-1 text-sm text-muted">
                      {c.name_ar}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {p.bio && <p className="mt-5 border-t border-line pt-4 text-sm leading-7">{p.bio}</p>}
          </section>

          <section className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">وين يخدم</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="المقرّ" v={[deleg?.name_ar, zone?.name_ar, p.address].filter(Boolean).join(' · ') || '—'} />
              <Row k="مسافة التنقّل" v={p.radius_km != null ? `${p.radius_km} كم` : '—'} />
            </dl>
            <h3 className="mt-4 text-xs font-medium text-muted">مناطق التدخّل</h3>
            {zones.length === 0 ? (
              <p className="mt-2 text-sm text-faint">ما حدّدش مناطق — يُسأل عنها في المكالمة.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {zones.map((z, i) => (
                  <li key={i} className="rounded bg-surface-2 px-3 py-1 text-sm text-muted">
                    {z.name_ar}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------- الوثائق ---------- */}
          <section className="rounded border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">الوثائق حسب اختصاصه</h2>
              {missingRequired > 0 && (
                <span className="rounded bg-gold-soft px-2.5 py-0.5 text-xs text-gold">
                  {missingRequired} وثيقة إلزامية ناقصة
                </span>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {rules.map((r) => {
                const d = delivered.get(r.document_code)
                return (
                  <li
                    key={r.document_code}
                    className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0"
                  >
                    <span>
                      {r.label}
                      {r.is_required && <span className="ms-2 text-xs text-gold">إلزامية</span>}
                    </span>
                    <span className="text-xs">
                      {!d ? (
                        <span className="text-faint">ما وصلتش</span>
                      ) : d.is_verified ? (
                        <span className="text-brand">مُتثبَّت منها</span>
                      ) : (
                        <span className="text-gold">وصلت · تنتظر التثبّت</span>
                      )}
                    </span>
                  </li>
                )
              })}
              {rules.length === 0 && (
                <li className="text-faint">ما فمّاش وثائق محدّدة لهذا الاختصاص.</li>
              )}
            </ul>
            <p className="mt-3 text-xs leading-6 text-faint">
              الرفع من طرف المتدخّل يجي مع لوحته. توّة الفريق يطلبها في المكالمة ويسجّلها هنا.
            </p>
          </section>

          {/* ---------- سجلّ الأثر ---------- */}
          <section className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">سجلّ الملفّ</h2>
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {(eventRows ?? []).map((e) => (
                <li key={e.id} className="border-b border-line pb-3 last:border-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="num text-xs text-faint">{dt(e.created_at)}</span>
                    <span className="font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                    {e.from_status && e.to_status && (
                      <span className="text-xs text-muted">
                        {STATUS_LABELS[e.from_status as IntervenantStatus]} ←{' '}
                        {STATUS_LABELS[e.to_status as IntervenantStatus]}
                      </span>
                    )}
                    {e.actor && (
                      <span className="text-xs text-faint">{actorName.get(e.actor) ?? '—'}</span>
                    )}
                  </div>
                  {e.note && <p className="mt-1 leading-7 text-muted">{e.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------- الإجراءات ---------- */}
        <div className="space-y-5">
          <section className="rounded border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">معطيات الملفّ</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="الوضعية المهنية" v={LEGAL_LABELS[p.legal_status as LegalStatus] ?? p.legal_status} />
              <Row k="التسجيل" v={dt(p.created_at)} />
              <Row k="المصدر" v={p.source === 'public_form' ? 'استمارة عمومية' : p.source} />
              {p.validated_at && <Row k="الاعتماد" v={dt(p.validated_at)} />}
              {p.status_note && <Row k="آخر سبب" v={p.status_note} />}
            </dl>
          </section>

          {canManage && (
            <>
              <section className="rounded border border-brand/30 bg-brand-soft p-5">
                <h2 className="text-sm font-semibold text-brand-deep">تغيير الحالة</h2>
                {moves.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">ما فمّاش انتقال متاح من هالحالة.</p>
                ) : (
                  <form action={setIntervenantStatusAction} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="status"
                      defaultValue={moves[0]}
                      className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                    >
                      {moves.map((m) => (
                        <option key={m} value={m}>
                          {STATUS_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="note"
                      placeholder="السبب — يُسجَّل في السجلّ"
                      className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                    />
                    <button className="w-full rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep">
                      حفظ الحالة
                    </button>
                  </form>
                )}
              </section>

              <section className="rounded border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold">التوفّر</h2>
                <form action={setAvailabilityAction} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <select
                    name="availability"
                    defaultValue={p.availability}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  >
                    {AVAILABILITIES.map((a) => (
                      <option key={a} value={a}>
                        {AVAILABILITY_LABELS[a]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    name="available_from"
                    defaultValue={p.available_from ?? ''}
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  />
                  <button className="w-full rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand">
                    حفظ التوفّر
                  </button>
                </form>
              </section>

              <section className="rounded border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold">ملاحظة داخلية</h2>
                <p className="mt-1 text-xs leading-6 text-faint">
                  ما يشوفهاش المتدخّل. تُسجَّل باسمك وتاريخها.
                </p>
                <form action={addIntervenantNoteAction} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <textarea
                    name="note"
                    rows={3}
                    required
                    placeholder="مثال: كلّمناه، وعد يجيب الـpatente قبل آخر الأسبوع."
                    className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
                  />
                  <button className="w-full rounded border border-line px-4 py-2 text-sm hover:border-brand hover:text-brand">
                    أضف الملاحظة
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-end font-medium">{v}</dd>
    </div>
  )
}
