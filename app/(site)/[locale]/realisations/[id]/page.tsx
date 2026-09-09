import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { groupByStage, photoPublicUrl, type CasePhoto } from '@/lib/photos'
import { coverFor } from '@/lib/case-cover'
import DemoBadge from '@/components/DemoBadge'

export const dynamic = 'force-dynamic'

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
  video_url: string | null
  is_demo: boolean
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  const { data } = await db
    .from('case_studies')
    .select('title_ar, title_fr')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()
  if (!data) return { title: t.cases.pageTitle }
  const title = (locale === 'fr' && data.title_fr) || data.title_ar
  return { title: `${title} — ${t.nav.brand}` }
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale: raw, id } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const t = getDictionary(locale)
  const isFr = locale === 'fr'

  const { data: caseRaw } = await db
    .from('case_studies')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!caseRaw) notFound()
  const c = caseRaw as CaseStudy

  const [{ data: photosRaw }, { data: deleg }] = await Promise.all([
    db
      .from('case_photos')
      .select('id, case_id, storage_path, stage, caption_ar, caption_fr, taken_at, sort_order')
      .eq('case_id', id),
    c.delegation_id
      ? db.from('delegations').select('name_ar').eq('id', c.delegation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const photos = (photosRaw ?? []) as CasePhoto[]
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const cover = coverFor(photos, c, baseUrl)
  const groups = groupByStage(photos)

  const title = (isFr && c.title_fr) || c.title_ar
  const problem = (isFr && c.problem_fr) || c.problem_ar
  const solution = (isFr && c.solution_fr) || c.solution_ar
  const result = (isFr && c.result_fr) || c.result_ar
  const place = (deleg as { name_ar: string } | null)?.name_ar ?? null

  /** بطاقات المعطيات — رقم كبير وتسمية صغيرة، لا جدول */
  const stats = [
    c.area_m2 ? { label: t.cases.areaLabel, value: Math.round(Number(c.area_m2)), unit: t.cases.areaUnit } : null,
    c.duration_months
      ? { label: t.cases.durationLabel, value: c.duration_months, unit: t.cases.months }
      : null,
    photos.length ? { label: t.cases.photosShort, value: photos.length, unit: '' } : null,
    c.completed_at ? { label: t.cases.completedLabel, value: c.completed_at.slice(0, 4), unit: '' } : null,
  ].filter(Boolean) as { label: string; value: number | string; unit: string }[]

  const story = [
    { label: t.cases.problemLabel, body: problem, tone: 'gold' },
    { label: t.cases.solutionLabel, body: solution, tone: 'brand' },
    ...(result ? [{ label: t.cases.resultLabel, body: result, tone: 'brand-deep' }] : []),
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
      <Link
        href={path(locale, '/realisations')}
        className="inline-flex min-h-11 items-center text-sm text-brand hover:underline"
      >
        {t.cases.backToCases}
      </Link>

      {/* ---------- الترويسة ---------- */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          {t.cases.kinds[c.kind] ?? c.kind}
        </span>
        {place && <span className="text-sm text-muted">{place}</span>}
        {c.is_demo && <DemoBadge label={t.demoBadge} />}
      </div>
      <h1 className="display mt-3 text-3xl font-semibold leading-snug">{title}</h1>

      {/* ---------- الصورة الكبرى ---------- */}
      {cover && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.url} alt={title} className="aspect-[16/10] w-full object-cover" />
        </div>
      )}

      {/* ---------- بطاقات المعطيات ---------- */}
      {stats.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-line bg-surface p-4 text-center"
            >
              <dd className="num text-2xl font-semibold text-brand">
                {s.value}
                {s.unit && <span className="ms-1 text-xs font-normal text-muted">{s.unit}</span>}
              </dd>
              <dt className="mt-1 text-xs text-muted">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* ---------- المسار: مشكلة ← حلّ ← نتيجة ---------- */}
      <section className="mt-10">
        <h2 className="display text-lg font-semibold">{t.cases.storyTitle}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {story.map((step, i) => (
            <li
              key={step.label}
              className={`rounded-xl border p-5 ${
                step.tone === 'gold'
                  ? 'border-gold/40 bg-gold-soft'
                  : 'border-brand/25 bg-brand-soft'
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={`num text-xs font-medium ${
                    step.tone === 'gold' ? 'text-gold' : 'text-brand'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-semibold">{step.label}</span>
              </div>
              <p className="mt-2 leading-8 text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- الألبوم ---------- */}
      {groups.length > 0 && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="display text-lg font-semibold">{t.cases.albumTitle}</h2>
            <span className="num text-xs text-faint">
              {fmt(t.cases.photoCount, { n: photos.length })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{t.cases.albumLede}</p>

          <div className="mt-5 flex flex-col gap-6">
            {groups.map((g) => (
              <div key={g.stage}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
                  <span className="text-xs font-medium text-gold">{t.cases.stage[g.stage]}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.photos.map((ph) => {
                    const caption = (isFr && ph.caption_fr) || ph.caption_ar
                    return (
                      <figure key={ph.id} className="overflow-hidden rounded-xl border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPublicUrl(baseUrl, ph.storage_path)}
                          alt={caption ?? t.cases.stage[g.stage]}
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        {(caption || ph.taken_at) && (
                          <figcaption className="flex items-baseline justify-between gap-2 bg-surface px-3 py-2 text-xs text-muted">
                            <span>{caption}</span>
                            {ph.taken_at && <span className="num text-faint">{ph.taken_at}</span>}
                          </figcaption>
                        )}
                      </figure>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs leading-6 text-faint">{t.cases.consentNote}</p>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">{t.cases.ctaTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.cases.ctaBody}</p>
        </div>
        <Link
          href={path(locale, '/demande')}
          className="inline-flex min-h-11 items-center rounded bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-deep"
        >
          {t.nav.cta}
        </Link>
      </section>
    </div>
  )
}
