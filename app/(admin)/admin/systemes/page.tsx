import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { countAr } from '@/lib/format'
import { db, getGovernorates } from '@/lib/supabase/server'
import ModalTrigger from '@/components/ModalTrigger'
import {
  DOC_KIND_LABELS,
  OFFERING_STATUS_LABELS,
  SCOPE_LABELS,
  ELEMENT_SCOPES,
  OFFERING_STATUSES,
  assemblyThicknessCm,
  type ConstructionSystem,
  type ElementScope,
  type OfferingStatus,
} from '@/lib/construction'
import {
  deleteComponentAction,
  updateSystemConstraintsAction,
  upsertComponentAction,
  upsertDocumentAction,
  upsertManufacturerAction,
  upsertOfferingAction,
  upsertQuantityRuleAction,
  upsertSpanLimitAction,
  upsertSystemAction,
} from '@/lib/actions/construction'

export const metadata = { title: 'طرق البناء — اللَّبنة' }
export const dynamic = 'force-dynamic'

type Offering = {
  id: number
  system_code: string
  manufacturer_code: string | null
  element_scope: ElementScope
  label_ar: string
  status: OfferingStatus
  notes: string | null
}
type Maker = {
  code: string
  name_ar: string
  name_fr: string | null
  gov_code: string | null
  address: string | null
  phone: string | null
  website: string | null
  is_active: boolean
}
type Doc = {
  id: number
  offering_id: number
  doc_kind: string
  ref_code: string | null
  title: string
  version: string | null
  issued_on: string | null
  source_url: string | null
  is_normative: boolean
}
type Comp = {
  id: number
  offering_id: number
  ref_fabricant: string
  name_ar: string
  usage_domain: ElementScope
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  role_ar: string | null
  is_load_bearing: boolean | null
  sort_order: number
}
type Span = {
  id: number
  offering_id: number
  document_id: number
  usage_code: string
  usage_ar: string
  load_kn_m2: number
  assembly_code: string
  span_max_m: number
  reinforcement: string | null
}
type Rule = {
  id: number
  offering_id: number
  rule_key: string
  variant: string | null
  value: number
  unit_ar: string
  condition_ar: string | null
}

const inp =
  'w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand'
const btn =
  'inline-flex min-h-9 items-center rounded bg-brand px-3 text-sm text-white transition hover:bg-brand-deep'
const chip = 'rounded border border-line bg-surface px-2 py-1 text-xs'

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  )
}

const dims = (c: Comp) =>
  [c.length_mm, c.width_mm, c.height_mm].filter((n) => n != null).join('×') || '—'

export default async function SystemsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; o?: string }>
}) {
  await requirePermission('reference.manage')
  const sp = await searchParams

  const [systemsRes, offeringsRes, makersRes, govs, articlesRes] = await Promise.all([
    db.from('construction_systems').select('*').order('sort_order'),
    db.from('system_offerings').select('*').order('system_code').order('element_scope'),
    db.from('manufacturers').select('*').order('name_ar'),
    getGovernorates(),
    db.from('articles').select('system_code').eq('is_active', true),
  ])

  const systems = (systemsRes.data ?? []) as ConstructionSystem[]
  const offerings = (offeringsRes.data ?? []) as Offering[]
  const makers = (makersRes.data ?? []) as Maker[]

  const articlesPerSystem = new Map<string, number>()
  for (const a of (articlesRes.data ?? []) as { system_code: string | null }[]) {
    const k = a.system_code ?? '—'
    articlesPerSystem.set(k, (articlesPerSystem.get(k) ?? 0) + 1)
  }

  const selected = systems.find((s) => s.code === sp.s) ?? systems[0] ?? null
  const mine = selected ? offerings.filter((o) => o.system_code === selected.code) : []
  const offering = mine.find((o) => String(o.id) === sp.o) ?? mine[0] ?? null

  const ids = mine.map((o) => o.id)
  const [docsRes, compsRes, spansRes, rulesRes] = ids.length
    ? await Promise.all([
        db.from('offering_documents').select('*').in('offering_id', ids).order('ref_code'),
        db.from('system_components').select('*').in('offering_id', ids).order('sort_order'),
        db
          .from('span_limits')
          .select('*')
          .in('offering_id', ids)
          .order('load_kn_m2')
          .order('assembly_code'),
        db.from('offering_quantity_rules').select('*').in('offering_id', ids).order('rule_key'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const docs = (docsRes.data ?? []) as Doc[]
  const comps = (compsRes.data ?? []) as Comp[]
  const spans = (spansRes.data ?? []) as Span[]
  const rules = (rulesRes.data ?? []) as Rule[]

  const ofDocs = offering ? docs.filter((d) => d.offering_id === offering.id) : []
  const ofComps = offering ? comps.filter((c) => c.offering_id === offering.id) : []
  const ofSpans = offering ? spans.filter((s) => s.offering_id === offering.id) : []
  const ofRules = offering ? rules.filter((r) => r.offering_id === offering.id) : []

  const makerName = (code: string | null) =>
    makers.find((m) => m.code === code)?.name_ar ?? (code ? code : '—')

  const c = selected?.constraints ?? {}

  /** استمارة العرض — تُستعمل للإضافة وللتعديل بنفس الشفرة */
  const offeringForm = (o: Offering | null) => (
    <form action={upsertOfferingAction} className="grid gap-3 sm:grid-cols-2">
      {o && <input type="hidden" name="id" value={o.id} />}
      <input type="hidden" name="system_code" value={selected?.code ?? ''} />
      <F label="الجزء من المبنى">
        <select name="element_scope" defaultValue={o?.element_scope ?? 'mur'} className={inp}>
          {ELEMENT_SCOPES.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
      </F>
      <F label="المصنّع">
        <select name="manufacturer_code" defaultValue={o?.manufacturer_code ?? ''} className={inp}>
          <option value="">— بلا مصنّع —</option>
          {makers.map((m) => (
            <option key={m.code} value={m.code}>
              {m.name_ar}
            </option>
          ))}
        </select>
      </F>
      <div className="sm:col-span-2">
        <F label="العنوان">
          <input name="label_ar" defaultValue={o?.label_ar ?? ''} className={inp} required />
        </F>
      </div>
      <F label="الحالة">
        <select name="status" defaultValue={o?.status ?? 'draft'} className={inp}>
          {OFFERING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OFFERING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </F>
      <F label="ملاحظة">
        <input name="notes" defaultValue={o?.notes ?? ''} className={inp} />
      </F>
      <p className="text-xs leading-6 text-faint sm:col-span-2">
        «منشور» يستوجب Avis Technique مسجَّلاً — بلا وثيقة تنزل الحالة إلى «ناقص الوثائق»
        تلقائياً: رقم يُعرض على حريف بلا مصدر لا يُنشر.
      </p>
      <div className="sm:col-span-2">
        <button className={btn}>حفظ</button>
      </div>
    </form>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="display text-lg font-semibold">طرق البناء</h1>
          <p className="mt-0.5 max-w-4xl text-sm leading-7 text-muted">
            النظام هو ما يختاره الحريف. <b>الأرقام تُعلَّق على العرض</b> (مصنّع × نظام × جزء
            من المبنى) لا على النظام: «بحر 4,80 م» رقم poutrelle بعينها في وثيقة بعينها، لا
            رقم «نظام البلوك».
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModalTrigger label="نظام جديد" title="طريقة بناء جديدة">
            <form action={upsertSystemAction} className="grid gap-3 sm:grid-cols-2">
              <F label="الرمز (حروف كبيرة)">
                <input name="code" className={inp} placeholder="BOIS" required />
              </F>
              <F label="الترتيب">
                <input name="sort_order" type="number" className={inp} defaultValue={99} />
              </F>
              <F label="الاسم بالعربية">
                <input name="name_ar" className={inp} required />
              </F>
              <F label="الاسم بالفرنسية">
                <input name="name_fr" className={inp} />
              </F>
              <div className="sm:col-span-2">
                <F label="جملة الحريف (تظهر في الاستمارة)">
                  <input name="citizen_summary_ar" className={inp} required />
                </F>
              </div>
              <div className="sm:col-span-2">
                <F label="Résumé client (FR)">
                  <input name="citizen_summary_fr" className={inp} />
                </F>
              </div>
              <div className="sm:col-span-2">
                <F label="المبدأ — شرح مطوّل بلا هندسة">
                  <textarea name="principle_ar" rows={3} className={inp} />
                </F>
              </div>
              <div className="sm:col-span-2">
                <button className={btn}>حفظ</button>
              </div>
            </form>
          </ModalTrigger>

          <ModalTrigger label="مصنّع" title="مصنّع جديد" variant="ghost">
            <form action={upsertManufacturerAction} className="grid gap-3 sm:grid-cols-2">
              <F label="الرمز">
                <input name="code" className={inp} placeholder="SIREP" required />
              </F>
              <F label="الاسم بالعربية">
                <input name="name_ar" className={inp} required />
              </F>
              <F label="الاسم بالفرنسية">
                <input name="name_fr" className={inp} />
              </F>
              <F label="الولاية">
                <select name="gov_code" className={inp} defaultValue="SFX">
                  <option value="">—</option>
                  {govs.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name_ar}
                    </option>
                  ))}
                </select>
              </F>
              <F label="العنوان">
                <input name="address" className={inp} />
              </F>
              <F label="الهاتف">
                <input name="phone" className={inp} />
              </F>
              <div className="sm:col-span-2">
                <F label="الموقع">
                  <input name="website" className={inp} placeholder="https://" />
                </F>
              </div>
              <div className="sm:col-span-2">
                <button className={btn}>حفظ</button>
              </div>
            </form>
          </ModalTrigger>
        </div>
      </div>

      {/* ---------- الأنظمة: شريط اختيار ---------- */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {systems.map((s) => {
          const on = s.code === selected?.code
          const n = offerings.filter((o) => o.system_code === s.code).length
          return (
            <Link
              key={s.code}
              href={`/admin/systemes?s=${s.code}`}
              aria-current={on ? 'true' : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                on
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              {s.name_ar}
              <span className="num ms-1.5 text-xs text-faint">
                {countAr(n, { one: 'عرض واحد', two: 'عرضان', few: 'عروض', many: 'عرضاً' })} ·{' '}
                {countAr(articlesPerSystem.get(s.code) ?? 0, {
                  one: 'مقال واحد',
                  two: 'مقالان',
                  few: 'مقالات',
                  many: 'مقالاً',
                })}
              </span>
              {!s.is_active && <span className="ms-1.5 text-xs text-faint">موقوف</span>}
            </Link>
          )
        })}
      </div>

      {!selected && (
        <p className="mt-6 rounded border border-line bg-surface p-4 text-sm text-muted">
          ما زال ما ثمّة حتى طريقة بناء. زيد وحدة من «نظام جديد».
        </p>
      )}

      {selected && (
        <>
          {/* ---------- حدود النظام ---------- */}
          <section className="mt-4 rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <b className="text-sm">حدود تسري في النظام</b>
                {c.fire_resistance_hours != null && (
                  <span className={chip}>
                    حريق <b className="num">{c.fire_resistance_hours}</b> ساعة
                    {c.fire_reaction_class ? ` · ${c.fire_reaction_class}` : ''}
                  </span>
                )}
                {(c.load_bearing_series_cm ?? []).length > 0 && (
                  <span className={chip}>
                    حاملة <b className="num">{c.load_bearing_series_cm!.join('·')}</b> صم
                  </span>
                )}
                {(c.partition_series_cm ?? []).length > 0 && (
                  <span className={chip}>
                    قواطع <b className="num">{c.partition_series_cm!.join('·')}</b> صم
                  </span>
                )}
                {(c.excluded_uses ?? []).map((u) => (
                  <span key={u} className="rounded border border-gold/50 bg-gold/10 px-2 py-1 text-xs">
                    مستبعَد: {u}
                  </span>
                ))}
                {(c.standards ?? []).map((st) => (
                  <span key={st} className={chip}>
                    {st}
                  </span>
                ))}
                {Object.keys(c).length === 0 && (
                  <span className="text-xs text-faint">ما ثمّة حدود مسجّلة — النظام يُقترح دائماً</span>
                )}
              </div>

              <div className="flex gap-2">
                <ModalTrigger icon={null} label="الحدود" title={`حدود ${selected.name_ar}`} variant="ghost">
                  <form
                    action={updateSystemConstraintsAction}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <input type="hidden" name="code" value={selected.code} />
                    <F label="مقاومة الحريق (ساعات)">
                      <input
                        name="fire_resistance_hours"
                        type="number"
                        step="0.5"
                        defaultValue={c.fire_resistance_hours ?? ''}
                        className={inp}
                      />
                    </F>
                    <F label="تصنيف ردّ الفعل">
                      <input
                        name="fire_reaction_class"
                        defaultValue={c.fire_reaction_class ?? ''}
                        className={inp}
                        placeholder="A1"
                      />
                    </F>
                    <F label="سماكات الجدران الحاملة (صم)">
                      <input
                        name="load_bearing_series_cm"
                        defaultValue={(c.load_bearing_series_cm ?? []).join(' · ')}
                        className={inp}
                        placeholder="20 · 22 · 25"
                      />
                    </F>
                    <F label="سماكات القواطع (صم)">
                      <input
                        name="partition_series_cm"
                        defaultValue={(c.partition_series_cm ?? []).join(' · ')}
                        className={inp}
                        placeholder="10 · 15"
                      />
                    </F>
                    <F label="استعمالات مستبعَدة (بفاصلة)">
                      <input
                        name="excluded_uses"
                        defaultValue={(c.excluded_uses ?? []).join(', ')}
                        className={inp}
                        placeholder="sous_sol_parking"
                      />
                    </F>
                    <F label="سبب الاستبعاد">
                      <input
                        name="excluded_reason_ar"
                        defaultValue={c.excluded_reason_ar ?? ''}
                        className={inp}
                      />
                    </F>
                    <F label="تباعد الـraidisseur (م)">
                      <input
                        name="raidisseur_spacing_m"
                        type="number"
                        step="0.1"
                        defaultValue={c.raidisseur_spacing_m ?? ''}
                        className={inp}
                      />
                    </F>
                    <F label="enduit خارجي (مم)">
                      <input
                        name="enduit_exterieur_mm"
                        type="number"
                        defaultValue={c.enduit_exterieur_mm ?? ''}
                        className={inp}
                      />
                    </F>
                    <div className="sm:col-span-2">
                      <F label="المراجع (بفاصلة)">
                        <input
                          name="standards"
                          defaultValue={(c.standards ?? []).join(', ')}
                          className={inp}
                          placeholder="DTU 20.1, DTU 26.1"
                        />
                      </F>
                    </div>
                    <p className="text-xs leading-6 text-faint sm:col-span-2">
                      الاستعمال المستبعَد يمنع اقتراح النظام آلياً — لا يكتفي بتحذير يُقرأ أو
                      لا يُقرأ.
                    </p>
                    <div className="sm:col-span-2">
                      <button className={btn}>حفظ</button>
                    </div>
                  </form>
                </ModalTrigger>

                <ModalTrigger icon={null} label="تعديل النظام" title={selected.name_ar} variant="ghost">
                  <form action={upsertSystemAction} className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="code" value={selected.code} />
                    <F label="الاسم بالعربية">
                      <input name="name_ar" defaultValue={selected.name_ar} className={inp} />
                    </F>
                    <F label="الاسم بالفرنسية">
                      <input name="name_fr" defaultValue={selected.name_fr ?? ''} className={inp} />
                    </F>
                    <div className="sm:col-span-2">
                      <F label="جملة الحريف">
                        <input
                          name="citizen_summary_ar"
                          defaultValue={selected.citizen_summary_ar}
                          className={inp}
                        />
                      </F>
                    </div>
                    <div className="sm:col-span-2">
                      <F label="Résumé client (FR)">
                        <input
                          name="citizen_summary_fr"
                          defaultValue={selected.citizen_summary_fr ?? ''}
                          className={inp}
                        />
                      </F>
                    </div>
                    <div className="sm:col-span-2">
                      <F label="المبدأ">
                        <textarea
                          name="principle_ar"
                          rows={4}
                          defaultValue={selected.principle_ar ?? ''}
                          className={inp}
                        />
                      </F>
                    </div>
                    <F label="الترتيب">
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={selected.sort_order}
                        className={inp}
                      />
                    </F>
                    <label className="flex items-end gap-2 pb-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={selected.is_active}
                        className="size-4 accent-[#a8781f]"
                      />
                      نشط
                    </label>
                    <div className="sm:col-span-2">
                      <button className={btn}>حفظ</button>
                    </div>
                  </form>
                </ModalTrigger>
              </div>
            </div>
          </section>

          {/* ---------- العروض ---------- */}
          <section className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-sm">العروض — مصنّع × جزء من المبنى</b>
              <ModalTrigger label="عرض جديد" title={`عرض في ${selected.name_ar}`} variant="ghost">
                {offeringForm(null)}
              </ModalTrigger>
            </div>

            {mine.length === 0 ? (
              <p className="mt-2 rounded border border-line bg-surface p-3 text-sm text-muted">
                ما ثمّة عرض. النظام بلا عرض لا يحمل أرقاماً ولا وثائق.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mine.map((o) => {
                  const on = o.id === offering?.id
                  const nd = docs.filter((d) => d.offering_id === o.id).length
                  const nc = comps.filter((x) => x.offering_id === o.id).length
                  return (
                    <Link
                      key={o.id}
                      href={`/admin/systemes?s=${selected.code}&o=${o.id}`}
                      aria-current={on ? 'true' : undefined}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        on
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
                      }`}
                    >
                      <span className="font-medium">{SCOPE_LABELS[o.element_scope]}</span>
                      <span className="ms-1.5 text-xs">{makerName(o.manufacturer_code)}</span>
                      <span className="num ms-1.5 text-xs text-faint">
                        {countAr(nd, {
                          one: 'وثيقة واحدة',
                          two: 'وثيقتان',
                          few: 'وثائق',
                          many: 'وثيقة',
                        })}{' '}
                        ·{' '}
                        {countAr(nc, {
                          one: 'عنصر واحد',
                          two: 'عنصران',
                          few: 'عناصر',
                          many: 'عنصراً',
                        })}
                      </span>
                      <span
                        className={`ms-1.5 rounded px-1.5 py-0.5 text-[11px] ${
                          o.status === 'published'
                            ? 'bg-brand/10 text-brand'
                            : 'bg-surface-2 text-faint'
                        }`}
                      >
                        {OFFERING_STATUS_LABELS[o.status]}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ---------- تفصيل العرض ---------- */}
          {offering && (
            <section className="mt-4 rounded-lg border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <div className="text-sm">
                  <b>{offering.label_ar}</b>
                  <span className="ms-2 text-xs text-muted">
                    {SCOPE_LABELS[offering.element_scope]} · {makerName(offering.manufacturer_code)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ModalTrigger icon={null} label="تعديل" title={offering.label_ar} variant="ghost">
                    {offeringForm(offering)}
                  </ModalTrigger>
                  <ModalTrigger label="وثيقة" title="وثيقة مرجعية" variant="ghost">
                    <form action={upsertDocumentAction} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="offering_id" value={offering.id} />
                      <F label="النوع">
                        <select name="doc_kind" className={inp} defaultValue="avis_technique">
                          {Object.entries(DOC_KIND_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </F>
                      <F label="المرجع">
                        <input
                          name="ref_code"
                          className={inp}
                          placeholder="DRISS AGGLO-01-PPE/2023"
                        />
                      </F>
                      <div className="sm:col-span-2">
                        <F label="العنوان">
                          <input name="title" className={inp} required />
                        </F>
                      </div>
                      <F label="النسخة">
                        <input name="version" className={inp} />
                      </F>
                      <F label="تاريخ الإصدار">
                        <input name="issued_on" type="date" className={inp} />
                      </F>
                      <div className="sm:col-span-2">
                        <F label="الرابط">
                          <input name="source_url" className={inp} placeholder="https://" />
                        </F>
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          name="is_normative"
                          defaultChecked
                          className="size-4 accent-[#a8781f]"
                        />
                        وثيقة تُسنَد إليها الأرقام
                      </label>
                      <p className="text-xs leading-6 text-faint sm:col-span-2">
                        النسخة والتاريخ مهمّان: أيّ تحيين لاحق يُسجَّل وثيقةً جديدة ولا يمحو
                        سابقتها.
                      </p>
                      <div className="sm:col-span-2">
                        <button className={btn}>حفظ</button>
                      </div>
                    </form>
                  </ModalTrigger>
                  <ModalTrigger label="عنصر" title="عنصر في الكتالوج" variant="ghost">
                    <form action={upsertComponentAction} className="grid gap-3 sm:grid-cols-3">
                      <input type="hidden" name="offering_id" value={offering.id} />
                      <F label="المرجع">
                        <input name="ref_fabricant" className={inp} placeholder="BC20-6N" required />
                      </F>
                      <div className="sm:col-span-2">
                        <F label="الاسم">
                          <input name="name_ar" className={inp} required />
                        </F>
                      </div>
                      <F label="نطاق الاستعمال">
                        <select
                          name="usage_domain"
                          className={inp}
                          defaultValue={offering.element_scope}
                        >
                          {ELEMENT_SCOPES.map((s) => (
                            <option key={s} value={s}>
                              {SCOPE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </F>
                      <F label="حامل؟">
                        <select name="is_load_bearing" className={inp} defaultValue="">
                          <option value="">لا ينطبق</option>
                          <option value="yes">حامل</option>
                          <option value="no">غير حامل</option>
                        </select>
                      </F>
                      <F label="الترتيب">
                        <input name="sort_order" type="number" className={inp} defaultValue={99} />
                      </F>
                      <F label="الطول (مم)">
                        <input name="length_mm" type="number" className={inp} />
                      </F>
                      <F label="العرض (مم)">
                        <input name="width_mm" type="number" className={inp} />
                      </F>
                      <F label="الارتفاع (مم)">
                        <input name="height_mm" type="number" className={inp} />
                      </F>
                      <div className="sm:col-span-3">
                        <F label="الوصف والاستعمال">
                          <input name="role_ar" className={inp} />
                        </F>
                      </div>
                      <div className="sm:col-span-3">
                        <F label="الوثيقة المصدر">
                          <select name="document_id" className={inp} defaultValue="">
                            <option value="">—</option>
                            {ofDocs.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.ref_code ?? d.title}
                              </option>
                            ))}
                          </select>
                        </F>
                      </div>
                      <p className="text-xs leading-6 text-faint sm:col-span-3">
                        نطاق الاستعمال هو الحارس: عمود كهرباء أو أنبوب من نفس المصنّع لا يدخل
                        كتالوج عناصر المسكن.
                      </p>
                      <div className="sm:col-span-3">
                        <button className={btn}>حفظ</button>
                      </div>
                    </form>
                  </ModalTrigger>
                  {offering.element_scope === 'plancher' && (
                    <ModalTrigger label="حدّ بحر" title="بحر أقصى" variant="ghost">
                      <form action={upsertSpanLimitAction} className="grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="offering_id" value={offering.id} />
                        <F label="رمز الاستعمال">
                          <input
                            name="usage_code"
                            className={inp}
                            placeholder="habitation"
                            required
                          />
                        </F>
                        <F label="الاستعمال بالعربية">
                          <input name="usage_ar" className={inp} placeholder="سكن" required />
                        </F>
                        <F label="الحمل (kN/m²)">
                          <input
                            name="load_kn_m2"
                            type="number"
                            step="0.1"
                            className={inp}
                            required
                          />
                        </F>
                        <F label="التركيبة">
                          <input name="assembly_code" className={inp} placeholder="15+5" required />
                        </F>
                        <F label="البحر الأقصى (م)">
                          <input
                            name="span_max_m"
                            type="number"
                            step="0.01"
                            className={inp}
                            required
                          />
                        </F>
                        <F label="التسليح">
                          <input name="reinforcement" className={inp} placeholder="2HA12" />
                        </F>
                        <div className="sm:col-span-2">
                          <F label="الوثيقة المصدر (إجباري)">
                            <select name="document_id" className={inp} required>
                              <option value="">— اختر —</option>
                              {ofDocs.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.ref_code ?? d.title}
                                </option>
                              ))}
                            </select>
                          </F>
                        </div>
                        <p className="text-xs leading-6 text-faint sm:col-span-2">
                          رقم بحر بلا مصدر أخطر ما يحمله هذا النظام: يُقرأ كضمان. القاعدة ترفض
                          تسجيله بلا وثيقة.
                        </p>
                        <div className="sm:col-span-2">
                          <button className={btn}>حفظ</button>
                        </div>
                      </form>
                    </ModalTrigger>
                  )}
                  <ModalTrigger label="كمّية" title="قاعدة كمّية" variant="ghost">
                    <form action={upsertQuantityRuleAction} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="offering_id" value={offering.id} />
                      <F label="المفتاح">
                        <input
                          name="rule_key"
                          className={inp}
                          placeholder="units_per_m2"
                          required
                        />
                      </F>
                      <F label="المتغيّر (سماكة مثلاً)">
                        <input name="variant" className={inp} placeholder="20" />
                      </F>
                      <F label="القيمة">
                        <input name="value" type="number" step="0.001" className={inp} required />
                      </F>
                      <F label="الوحدة">
                        <input name="unit_ar" className={inp} placeholder="وحدة / م²" required />
                      </F>
                      <div className="sm:col-span-2">
                        <F label="الشرط">
                          <input
                            name="condition_ar"
                            className={inp}
                            placeholder="مفاصل بسماكة 15 مم"
                          />
                        </F>
                      </div>
                      <div className="sm:col-span-2">
                        <F label="الوثيقة المصدر (إجباري)">
                          <select name="document_id" className={inp} required>
                            <option value="">— اختر —</option>
                            {ofDocs.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.ref_code ?? d.title}
                              </option>
                            ))}
                          </select>
                        </F>
                      </div>
                      <div className="sm:col-span-2">
                        <button className={btn}>حفظ</button>
                      </div>
                    </form>
                  </ModalTrigger>
                </div>
              </div>

              {/* الوثائق */}
              <div className="border-b border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">الوثائق</span>
                  {ofDocs.length === 0 && (
                    <span className="rounded border border-gold/50 bg-gold/10 px-2 py-1 text-xs">
                      بلا وثيقة — لا يُنشر هذا العرض
                    </span>
                  )}
                  {ofDocs.map((d) => (
                    <span key={d.id} className={chip}>
                      <b>{DOC_KIND_LABELS[d.doc_kind] ?? d.doc_kind}</b>
                      {d.ref_code && <code className="num ms-1 text-faint">{d.ref_code}</code>}
                      {d.issued_on && (
                        <span className="num ms-1 text-faint">{d.issued_on.slice(0, 4)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* الكمّيات */}
              {ofRules.length > 0 && (
                <div className="border-b border-line px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">الكمّيات</span>
                    {ofRules.map((r) => (
                      <span key={r.id} className={chip}>
                        {r.rule_key}
                        {r.variant ? ` · ${r.variant}` : ''} ={' '}
                        <b className="num">{Number(r.value)}</b> {r.unit_ar}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* البحور */}
              {ofSpans.length > 0 && (
                <div className="overflow-x-auto border-b border-line">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="bg-surface-2 text-xs text-muted">
                      <tr>
                        <th className="px-3 py-1.5 text-start font-medium">الاستعمال</th>
                        <th className="px-3 py-1.5 text-start font-medium">q</th>
                        {[...new Set(ofSpans.map((s) => s.assembly_code))].sort().map((a) => (
                          <th key={a} className="px-3 py-1.5 text-start font-medium">
                            <span className="num">{a}</span>
                            <span className="num ms-1 text-[11px] font-normal text-faint">
                              ({assemblyThicknessCm(a)})
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Map(ofSpans.map((s) => [s.usage_code, s])).values()].map((u) => (
                        <tr key={u.usage_code} className="border-t border-line">
                          <td className="px-3 py-1.5">{u.usage_ar}</td>
                          <td className="num px-3 py-1.5 text-muted">{Number(u.load_kn_m2)}</td>
                          {[...new Set(ofSpans.map((s) => s.assembly_code))].sort().map((a) => (
                            <td key={a} className="num px-3 py-1.5">
                              {ofSpans.find(
                                (s) => s.usage_code === u.usage_code && s.assembly_code === a
                              )?.span_max_m ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* الكتالوج */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-3 py-1.5 text-start font-medium">المرجع</th>
                      <th className="px-3 py-1.5 text-start font-medium">الأبعاد (مم)</th>
                      <th className="px-3 py-1.5 text-start font-medium">الوصف</th>
                      <th className="px-3 py-1.5 text-start font-medium">النطاق</th>
                      <th className="px-3 py-1.5 text-end font-medium">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ofComps.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-sm text-muted">
                          ما ثمّة عناصر بعد.
                        </td>
                      </tr>
                    )}
                    {ofComps.map((x) => (
                      <tr key={x.id} className="border-t border-line">
                        <td className="px-3 py-1.5">
                          <code className="num text-xs">{x.ref_fabricant}</code>
                          {x.is_load_bearing === false && (
                            <span className="ms-1.5 text-[11px] text-faint">غير حامل</span>
                          )}
                        </td>
                        <td className="num px-3 py-1.5 text-muted">{dims(x)}</td>
                        <td className="px-3 py-1.5 text-muted">{x.role_ar ?? x.name_ar}</td>
                        <td className="px-3 py-1.5 text-xs text-faint">
                          {SCOPE_LABELS[x.usage_domain]}
                        </td>
                        <td className="px-3 py-1.5 text-end">
                          <form action={deleteComponentAction} className="inline">
                            <input type="hidden" name="id" value={x.id} />
                            <button className="text-xs text-muted hover:text-[#8c2f22]">شطب</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* ---------- المصنّعون ---------- */}
      <section className="mt-6">
        <b className="text-sm">المصنّعون</b>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {makers.length === 0 && (
            <span className="text-xs text-faint">ما ثمّة مصنّع مسجّل.</span>
          )}
          {makers.map((m) => (
            <span key={m.code} className={chip}>
              <b>{m.name_ar}</b>
              {m.address && <span className="ms-1 text-faint">{m.address}</span>}
              <span className="num ms-2 text-faint">
                {countAr(offerings.filter((o) => o.manufacturer_code === m.code).length, {
                  one: 'عرض واحد',
                  two: 'عرضان',
                  few: 'عروض',
                  many: 'عرضاً',
                })}
              </span>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
