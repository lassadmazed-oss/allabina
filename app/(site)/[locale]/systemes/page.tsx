import Link from 'next/link'
import { db, getConstructionSystems } from '@/lib/supabase/server'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatNumber } from '@/lib/format'
import {
  DOC_KIND_LABELS,
  SCOPE_LABELS,
  assemblyThicknessCm,
  type ElementScope,
} from '@/lib/construction'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').systemsPage
  return { title: t.pageTitle, description: t.lede }
}

type Offering = {
  id: number
  system_code: string
  manufacturer_code: string | null
  element_scope: ElementScope
  label_ar: string
  status: string
}
type Component = {
  offering_id: number
  ref_fabricant: string
  name_ar: string
  usage_domain: ElementScope
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  role_ar: string | null
  is_load_bearing: boolean | null
}
type Doc = {
  offering_id: number
  doc_kind: string
  ref_code: string | null
  title: string
  issued_on: string | null
}
type Span = {
  offering_id: number
  usage_code: string
  usage_ar: string
  load_kn_m2: number
  assembly_code: string
  span_max_m: number
  reinforcement: string | null
}
type Maker = { code: string; name_ar: string; name_fr: string | null; address: string | null }

/** الأبعاد بالمليمتر: نعرض الموجود منها فقط — الـpoutrelle بلا عرض */
const dims = (c: Component) =>
  [c.length_mm, c.width_mm, c.height_mm].filter((n) => n != null).join(' × ') || '—'

export default async function SystemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ s?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.systemsPage
  const isFr = locale === 'fr'

  const [systems, offeringsRes, makersRes] = await Promise.all([
    getConstructionSystems(),
    db
      .from('system_offerings')
      .select('id, system_code, manufacturer_code, element_scope, label_ar, status')
      .eq('status', 'published')
      .order('element_scope'),
    db.from('manufacturers').select('code, name_ar, name_fr, address').eq('is_active', true),
  ])

  if (systems.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-16">
        <h1 className="display text-2xl font-semibold">{t.noneTitle}</h1>
        <p className="mt-3 leading-8 text-muted">{t.noneBody}</p>
      </div>
    )
  }

  const offerings = (offeringsRes.data ?? []) as Offering[]
  const makers = (makersRes.data ?? []) as Maker[]
  const ids = offerings.map((o) => o.id)

  // النظام المعروض: من العنوان، وإلّا أوّل نظام له عروض منشورة، وإلّا الأوّل
  const selected =
    systems.find((s) => s.code === sp.s) ??
    systems.find((s) => offerings.some((o) => o.system_code === s.code)) ??
    systems[0]

  const mine = offerings.filter((o) => o.system_code === selected.code)
  const mineIds = mine.map((o) => o.id)

  const [compRes, docRes, spanRes] = ids.length
    ? await Promise.all([
        db
          .from('system_components')
          .select(
            'offering_id, ref_fabricant, name_ar, usage_domain, length_mm, width_mm, height_mm, role_ar, is_load_bearing'
          )
          .in('offering_id', mineIds.length ? mineIds : [-1])
          .order('sort_order'),
        db
          .from('offering_documents')
          .select('offering_id, doc_kind, ref_code, title, issued_on')
          .in('offering_id', mineIds.length ? mineIds : [-1])
          .order('ref_code'),
        db
          .from('span_limits')
          .select(
            'offering_id, usage_code, usage_ar, load_kn_m2, assembly_code, span_max_m, reinforcement'
          )
          .in('offering_id', mineIds.length ? mineIds : [-1])
          .order('load_kn_m2')
          .order('assembly_code'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const comps = (compRes.data ?? []) as Component[]
  const docs = (docRes.data ?? []) as Doc[]
  const spans = (spanRes.data ?? []) as Span[]

  const makerName = (code: string | null) => {
    const m = makers.find((x) => x.code === code)
    if (!m) return null
    return (isFr ? m.name_fr : m.name_ar) || m.name_ar
  }

  // جدول البحور: صفّ لكلّ استعمال، عمود لكلّ تركيبة
  const assemblies = [...new Set(spans.map((s) => s.assembly_code))].sort()
  const usages = [...new Map(spans.map((s) => [s.usage_code, s])).values()]
  const spanOf = (usage: string, asm: string) =>
    spans.find((s) => s.usage_code === usage && s.assembly_code === asm)?.span_max_m ?? null

  const nameOf = (s: (typeof systems)[number]) => (isFr ? s.name_fr : s.name_ar) || s.name_ar
  const summaryOf = (s: (typeof systems)[number]) =>
    (isFr ? s.citizen_summary_fr : s.citizen_summary_ar) || s.citizen_summary_ar

  const scopes = [...new Set(mine.map((o) => o.element_scope))]

  return (
    <div className="bg-ground">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{t.title}</h1>
          <p className="mt-2 max-w-3xl leading-7 text-muted">{t.lede}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
        {/* ---------- المقارنة: بطاقتان جنباً إلى جنب ---------- */}
        <section>
          <h2 className="text-sm font-semibold">{t.compare}</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {systems.map((s) => {
              const on = s.code === selected.code
              const has = offerings.some((o) => o.system_code === s.code)
              return (
                <Link
                  key={s.code}
                  href={path(locale, `/systemes?s=${s.code}`)}
                  aria-current={on ? 'true' : undefined}
                  className={`block rounded-lg border p-4 transition ${
                    on
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{nameOf(s)}</span>
                    {has && (
                      <span className="num text-xs text-faint">
                        {offerings.filter((o) => o.system_code === s.code).length} عروض
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-sm leading-7 text-muted">{summaryOf(s)}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ---------- المبدأ ---------- */}
        {selected.principle_ar && (
          <section className="mt-6 rounded-lg border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">{t.principle}</h2>
            <p className="mt-1.5 leading-8 text-muted">
              {(isFr ? selected.principle_fr : selected.principle_ar) || selected.principle_ar}
            </p>
          </section>
        )}

        {/* ---------- الحدود التي تسري ---------- */}
        {Object.keys(selected.constraints ?? {}).length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">{t.limits}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {selected.constraints.fire_resistance_hours != null && (
                <span className="rounded border border-line bg-surface px-2.5 py-1">
                  مقاومة الحريق{' '}
                  <b className="num">{selected.constraints.fire_resistance_hours}</b> ساعة
                  {selected.constraints.fire_reaction_class
                    ? ` · ${selected.constraints.fire_reaction_class}`
                    : ''}
                </span>
              )}
              {(selected.constraints.load_bearing_series_cm ?? []).length > 0 && (
                <span className="rounded border border-line bg-surface px-2.5 py-1">
                  جدران حاملة{' '}
                  <b className="num">
                    {selected.constraints.load_bearing_series_cm!.join(' · ')}
                  </b>{' '}
                  صم
                </span>
              )}
              {(selected.constraints.partition_series_cm ?? []).length > 0 && (
                <span className="rounded border border-line bg-surface px-2.5 py-1">
                  قواطع{' '}
                  <b className="num">{selected.constraints.partition_series_cm!.join(' · ')}</b> صم
                </span>
              )}
              {selected.constraints.raidisseur_spacing_m != null && (
                <span className="rounded border border-line bg-surface px-2.5 py-1">
                  raidisseur كلّ{' '}
                  <b className="num">{selected.constraints.raidisseur_spacing_m}</b> م
                </span>
              )}
              {(selected.constraints.standards ?? []).map((st) => (
                <span key={st} className="rounded border border-line bg-surface px-2.5 py-1">
                  {st}
                </span>
              ))}
            </div>
            {selected.constraints.excluded_reason_ar && (
              <p className="mt-2 rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs leading-6">
                <b>حدّ صريح:</b> {selected.constraints.excluded_reason_ar}
              </p>
            )}
          </section>
        )}

        {/* ---------- البحور: الجدول الذي يحسم من يقرّر ---------- */}
        {spans.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t.spans}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">{t.spansLede}</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t.usage}</th>
                    <th className="px-3 py-2 text-start font-medium">q (kN/m²)</th>
                    {assemblies.map((a) => (
                      <th key={a} className="px-3 py-2 text-start font-medium">
                        <span className="num">{a}</span>
                        <span className="mt-0.5 block text-[11px] font-normal text-faint">
                          <span className="num">{assemblyThicknessCm(a)}</span> صم
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usages.map((u) => (
                    <tr key={u.usage_code} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">{u.usage_ar}</td>
                      <td className="num px-3 py-2 text-muted">{formatNumber(Number(u.load_kn_m2), 1)}</td>
                      {assemblies.map((a) => (
                        <td key={a} className="num px-3 py-2">
                          {spanOf(u.usage_code, a) === null
                            ? '—'
                            : formatNumber(Number(spanOf(u.usage_code, a)), 2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-6 text-faint">
              البحور بالمتر
              {spans[0]?.reinforcement ? ` · تسليح ${spans[0].reinforcement}` : ''} — المنصة تقترح
              النظام، والمهندس يحدّد التركيبة، والنظام يحسب الكمّيات.
            </p>
          </section>
        )}

        {/* ---------- كتالوج العناصر ---------- */}
        {comps.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t.catalog}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">{t.catalogLede}</p>
            {scopes.map((scope) => {
              const rows = comps.filter((c) =>
                mine.some((o) => o.id === c.offering_id && o.element_scope === scope)
              )
              if (!rows.length) return null
              const off = mine.find((o) => o.element_scope === scope)!
              return (
                <div key={scope} className="mt-3">
                  <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted">
                    <b className="text-ink">{SCOPE_LABELS[scope]}</b>
                    {makerName(off.manufacturer_code) && (
                      <span>
                        {t.maker}: {makerName(off.manufacturer_code)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 overflow-x-auto rounded-lg border border-line bg-surface">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                        <tr>
                          <th className="px-3 py-2 text-start font-medium">{t.ref}</th>
                          <th className="px-3 py-2 text-start font-medium">{t.dims}</th>
                          <th className="px-3 py-2 text-start font-medium">{t.role}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((c) => (
                          <tr
                            key={`${c.offering_id}-${c.ref_fabricant}`}
                            className="border-b border-line last:border-0"
                          >
                            <td className="px-3 py-2">
                              <code className="num text-xs">{c.ref_fabricant}</code>
                              {c.is_load_bearing === false && (
                                <span className="ms-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-faint">
                                  غير حامل
                                </span>
                              )}
                            </td>
                            <td className="num px-3 py-2 text-muted">{dims(c)}</td>
                            <td className="px-3 py-2 text-muted">{c.role_ar ?? c.name_ar}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* ---------- الوثائق المرجعية ---------- */}
        {docs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t.docs}</h2>
            <p className="mt-1 text-sm leading-7 text-muted">{t.docsNote}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {docs.map((d) => (
                <li
                  key={`${d.offering_id}-${d.ref_code}`}
                  className="rounded border border-line bg-surface px-2.5 py-1.5 text-xs"
                >
                  <b>{DOC_KIND_LABELS[d.doc_kind] ?? d.doc_kind}</b>
                  {d.ref_code && <code className="num ms-1.5 text-faint">{d.ref_code}</code>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- الدعوة ---------- */}
        <section className="mt-8 rounded-lg border border-line bg-surface p-4">
          <h2 className="font-semibold">{t.ctaTitle}</h2>
          <p className="mt-1 text-sm leading-7 text-muted">{t.ctaBody}</p>
          <Link
            href={path(locale, '/demande')}
            className="mt-3 inline-block rounded bg-brand px-4 py-2 text-sm text-white hover:opacity-90"
          >
            {t.cta}
          </Link>
        </section>
      </div>
    </div>
  )
}
