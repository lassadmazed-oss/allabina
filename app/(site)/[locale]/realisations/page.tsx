import Link from 'next/link'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatNumber } from '@/lib/format'
import DemoBadge from '@/components/DemoBadge'
import { groupByStage, photoPublicUrl, type CasePhoto } from '@/lib/photos'

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

  const maxActivity = Math.max(
    1,
    ...activity.map((a) => a.completed_cases + a.active_files + a.available_properties)
  )
  const selected = sp.delegation ? Number(sp.delegation) : null

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="display text-3xl font-semibold">{t.cases.title}</h1>
      <p className="mt-4 max-w-3xl leading-8 text-muted">{t.cases.lede}</p>

      {/* خريطة المعتمديات — Carte des délégations */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t.cases.mapTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.cases.mapLede}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {activity.map((a) => {
            const total = a.completed_cases + a.active_files + a.available_properties
            const active = selected === a.delegation_id
            return (
              <Link
                key={a.delegation_id}
                href={
                  active
                    ? path(locale, '/realisations')
                    : path(locale, `/realisations?delegation=${a.delegation_id}`)
                }
                className={`rounded border p-4 transition ${
                  active
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{a.name_ar}</span>
                  <span className="num text-xs text-faint">{formatNumber(total)}</span>
                </div>
                <div
                  className="mt-2 h-1.5 rounded-full bg-surface-2"
                  aria-hidden="true"
                >
                  <div
                    className="h-1.5 rounded-full bg-brand"
                    style={{ width: `${Math.round((total / maxActivity) * 100)}%` }}
                  />
                </div>
                <dl className="num mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>
                    {a.completed_cases} {t.cases.mapCompleted}
                  </span>
                  <span>
                    {a.active_files} {t.cases.mapActive}
                  </span>
                  <span>
                    {a.available_properties} {t.cases.mapProperties}
                  </span>
                </dl>
              </Link>
            )
          })}
        </div>

        {selected && (
          <Link
            href={path(locale, '/realisations')}
            className="mt-4 inline-block text-sm text-brand hover:underline"
          >
            ← {t.cases.allDelegations}
          </Link>
        )}
      </section>

      {/* الحالات — Les cas */}
      {cases.some((c) => c.is_demo) && (
        <p className="mt-6 rounded border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-7 text-gold">
          {t.demoNotice}
        </p>
      )}

      <section className="mt-12">
        {cases.length === 0 ? (
          <p className="rounded border border-line bg-surface p-10 text-center leading-8 text-muted">
            {t.cases.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {cases.map((c) => {
              const title = (isFr && c.title_fr) || c.title_ar
              const problem = (isFr && c.problem_fr) || c.problem_ar
              const solution = (isFr && c.solution_fr) || c.solution_ar
              const result = (isFr && c.result_fr) || c.result_ar
              return (
                <article key={c.id} className="rounded border border-line bg-surface p-6 sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="display text-xl font-semibold">
                      {title}
                      {c.is_demo && <DemoBadge label={t.demoBadge} />}
                    </h3>
                    <span className="rounded bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                      {t.cases.kinds[c.kind] ?? c.kind}
                    </span>
                  </div>

                  {(() => {
                    const groups = groupByStage(photosByCase.get(c.id) ?? [])
                    if (groups.length === 0) {
                      // حالة قديمة برابطين يدويين فقط
                      if (!c.photo_before && !c.photo_after) return null
                      return (
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {c.photo_before && (
                            <figure>
                              <img src={c.photo_before} alt={t.cases.beforeLabel} className="w-full rounded border border-line object-cover" />
                              <figcaption className="mt-1 text-xs text-faint">{t.cases.beforeLabel}</figcaption>
                            </figure>
                          )}
                          {c.photo_after && (
                            <figure>
                              <img src={c.photo_after} alt={t.cases.afterLabel} className="w-full rounded border border-line object-cover" />
                              <figcaption className="mt-1 text-xs text-faint">{t.cases.afterLabel}</figcaption>
                            </figure>
                          )}
                        </div>
                      )
                    }
                    const total = groups.reduce((n, g) => n + g.photos.length, 0)
                    return (
                      <section className="mt-5">
                        <div className="flex items-baseline justify-between gap-3">
                          <h4 className="text-sm font-medium">{t.cases.albumTitle}</h4>
                          <span className="num text-xs text-faint">
                            {fmt(t.cases.photoCount, { n: total })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-faint">{t.cases.albumLede}</p>
                        <ol className="mt-3 flex flex-col gap-4">
                          {groups.map((g) => (
                            <li key={g.stage}>
                              <div className="mb-2 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
                                <span className="text-xs font-medium text-gold">
                                  {t.cases.stage[g.stage]}
                                </span>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {g.photos.map((ph) => {
                                  const caption = (isFr && ph.caption_fr) || ph.caption_ar
                                  return (
                                    <figure key={ph.id}>
                                      <img
                                        src={photoPublicUrl(baseUrl, ph.storage_path)}
                                        alt={caption ?? t.cases.stage[g.stage]}
                                        loading="lazy"
                                        className="aspect-[4/3] w-full rounded border border-line object-cover"
                                      />
                                      {(caption || ph.taken_at) && (
                                        <figcaption className="mt-1 flex justify-between gap-2 text-xs text-faint">
                                          <span>{caption}</span>
                                          {ph.taken_at && <span className="num">{ph.taken_at}</span>}
                                        </figcaption>
                                      )}
                                    </figure>
                                  )
                                })}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    )
                  })()}

                  <dl className="mt-5 space-y-3 text-sm leading-7">
                    <div>
                      <dt className="font-medium text-gold">{t.cases.problemLabel}</dt>
                      <dd className="text-muted">{problem}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-brand">{t.cases.solutionLabel}</dt>
                      <dd className="text-muted">{solution}</dd>
                    </div>
                    {result && (
                      <div>
                        <dt className="font-medium">{t.cases.resultLabel}</dt>
                        <dd className="text-muted">{result}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="num mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-faint">
                    {c.area_m2 && (
                      <span>
                        {t.cases.areaLabel}: {formatNumber(Number(c.area_m2))} m²
                      </span>
                    )}
                    {c.duration_months && (
                      <span>
                        {t.cases.durationLabel}: {c.duration_months} {t.cases.months}
                      </span>
                    )}
                    {c.completed_at && <span>{c.completed_at}</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs leading-6 text-faint">{t.cases.consentNote}</p>
      <p className="mt-3 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
        {t.cases.disclaimer}
      </p>

      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded border border-line bg-surface p-6">
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
