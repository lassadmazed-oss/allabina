import Link from 'next/link'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatNumber } from '@/lib/format'
import DemoBadge from '@/components/DemoBadge'
import { type CasePhoto } from '@/lib/photos'
import { coverFor, metaLine } from '@/lib/case-cover'
import CaseCard from '@/components/CaseCard'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.cases.pageTitle }
}

type CaseStudy = {
  id: string
  title_ar: string
  title_fr: string | null
  problem_ar: string
  problem_fr: string | null
  solution_ar: string
  solution_fr: string | null
  result_ar: string | null
  result_fr: string | null
  kind: string
  delegation_id: number | null
  area_m2: number | null
  duration_months: number | null
  completed_at: string | null
  photo_before: string | null
  photo_after: string | null
  is_demo: boolean
}

type Activity = {
  delegation_id: number
  name_ar: string
  completed_cases: number
  active_files: number
  available_properties: number
}

export default async function RealisationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ delegation?: string }>
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams])
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const isFr = locale === 'fr'

  let query = db
    .from('case_studies')
    .select('*')
    .eq('published', true)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (sp.delegation) query = query.eq('delegation_id', Number(sp.delegation))

  const [{ data: casesRaw }, { data: activityRaw }] = await Promise.all([
    query,
    db.from('delegation_activity').select('*').eq('gov_code', 'SFX'),
  ])

  const cases = (casesRaw ?? []) as CaseStudy[]

  const { data: photosRaw } = cases.length
    ? await db
        .from('case_photos')
        .select('id, case_id, storage_path, stage, caption_ar, caption_fr, taken_at, sort_order')
        .in('case_id', cases.map((c) => c.id))
    : { data: [] as CasePhoto[] }
  const photosByCase = new Map<string, CasePhoto[]>()
  for (const ph of (photosRaw ?? []) as CasePhoto[]) {
    const list = photosByCase.get(ph.case_id) ?? []
    list.push(ph)
    photosByCase.set(ph.case_id, list)
  }
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const activity = ((activityRaw ?? []) as Activity[]).sort(
    (a, b) =>
      b.completed_cases + b.active_files - (a.completed_cases + a.active_files) ||
      a.name_ar.localeCompare(b.name_ar)
  )

  const delegationName = new Map(activity.map((a) => [a.delegation_id, a.name_ar]))
  const totals = activity.reduce(
    (acc, a) => ({
      completed: acc.completed + a.completed_cases,
      active: acc.active + a.active_files,
      properties: acc.properties + a.available_properties,
    }),
    { completed: 0, active: 0, properties: 0 }
  )
  const selected = sp.delegation ? Number(sp.delegation) : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="display text-2xl font-semibold sm:text-3xl">{t.cases.title}</h1>
      <p className="mt-2 max-w-3xl leading-7 text-muted">{t.cases.lede}</p>

      {/* ---------- نبض الولاية — سطر واحد ثمّ شرائط فلترة ---------- */}
      <section className="mt-6">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <h2 className="font-semibold">{t.cases.mapTitle}</h2>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            <b className="num text-ink">{formatNumber(totals.completed)}</b>
            {t.cases.mapCompleted}
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
            <b className="num text-ink">{formatNumber(totals.active)}</b>
            {t.cases.mapActive}
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-line-strong" aria-hidden="true" />
            <b className="num text-ink">{formatNumber(totals.properties)}</b>
            {t.cases.mapProperties}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {activity.map((a) => {
            const total = a.completed_cases + a.active_files + a.available_properties
            const active = selected === a.delegation_id
            const pct = (v: number) => (total ? (v / total) * 100 : 0)
            return (
              <Link
                key={a.delegation_id}
                href={
                  active
                    ? path(locale, "/realisations")
                    : path(locale, `/realisations?delegation=${a.delegation_id}`)
                }
                aria-current={active ? "true" : undefined}
                title={`${a.completed_cases} ${t.cases.mapCompleted} · ${a.active_files} ${t.cases.mapActive} · ${a.available_properties} ${t.cases.mapProperties}`}
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {a.name_ar}
                  <b className="num text-ink">{total}</b>
                </span>
                {/* شريط رفيع يقول تركيبة المعتمدية بلا كلمات */}
                <span className="mt-1 flex h-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="bg-brand" style={{ width: `${pct(a.completed_cases)}%` }} />
                  <span className="bg-gold" style={{ width: `${pct(a.active_files)}%` }} />
                  <span
                    className="bg-line-strong"
                    style={{ width: `${pct(a.available_properties)}%` }}
                  />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* الحالات — Les cas */}
      {cases.some((c) => c.is_demo) && (
        <p className="mt-6 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
          {t.demoNotice}
        </p>
      )}

      <section className="mt-6">
        {cases.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-10 text-center leading-8 text-muted">
            {t.cases.empty}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => {
              const cover = coverFor(photosByCase.get(c.id) ?? [], c, baseUrl)
              return (
                <CaseCard
                  key={c.id}
                  href={path(locale, `/realisations/${c.id}`)}
                  cover={cover?.url ?? null}
                  photoCount={cover?.count ?? 0}
                  kindLabel={t.cases.kinds[c.kind] ?? c.kind}
                  title={(isFr && c.title_fr) || c.title_ar}
                  meta={metaLine(
                    { completedAt: c.completed_at, areaM2: c.area_m2, months: c.duration_months },
                    { m2: t.cases.areaUnit, months: t.cases.months }
                  )}
                  place={c.delegation_id ? delegationName.get(c.delegation_id) ?? null : null}
                  isDemo={c.is_demo}
                  demoLabel={t.demoBadge}
                  photosLabel={t.cases.photosShort}
                />
              )
            })}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs leading-6 text-faint">{t.cases.consentNote}</p>
      <p className="mt-3 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
        {t.cases.disclaimer}
      </p>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded border border-line bg-surface p-4 sm:p-6">
        <div>
          <h2 className="font-semibold">{t.cases.ctaTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.cases.ctaBody}</p>
        </div>
        <Link
          href={path(locale, '/demande')}
          className="rounded bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {t.nav.cta}
        </Link>
      </section>
    </div>
  )
}
