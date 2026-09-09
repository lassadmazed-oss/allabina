import Link from 'next/link'
import { notFound } from 'next/navigation'
import '@/app/landing.css'
import '@/app/landing-pages.css'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { groupByStage, photoPublicUrl, type CasePhoto } from '@/lib/photos'
import { coverFor } from '@/lib/case-cover'
import { IcArrow, IcPin } from '@/components/landing/icons'

/* eslint-disable @next/next/no-img-element -- صور من مخزن Supabase */

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

/**
 * صفحة الحالة المنجزة: صورة كبرى بالعنوان فوقها، أرقام المشروع،
 * ثمّ الحكاية في ثلاث بطاقات (مشكلة ← حلّ ← نتيجة)، ثمّ الألبوم بمراحله.
 */
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

  const stats = [
    c.area_m2 ? { label: t.cases.areaLabel, value: Math.round(Number(c.area_m2)), unit: t.cases.areaUnit } : null,
    c.duration_months ? { label: t.cases.durationLabel, value: c.duration_months, unit: t.cases.months } : null,
    photos.length ? { label: t.cases.photosShort, value: photos.length, unit: '' } : null,
    c.completed_at ? { label: t.cases.completedLabel, value: c.completed_at.slice(0, 4), unit: '' } : null,
  ].filter(Boolean) as { label: string; value: number | string; unit: string }[]

  const story = [
    { label: t.cases.problemLabel, body: problem, navy: false },
    { label: t.cases.solutionLabel, body: solution, navy: true },
    ...(result ? [{ label: t.cases.resultLabel, body: result, navy: true }] : []),
  ]

  return (
    <div className="lp">
      <div className="wrap" style={{ paddingTop: 12 }}>
        <Link href={path(locale, '/realisations')} className="back">
          {t.cases.backToCases}
        </Link>

        <div className="dhero">
          {cover ? <img src={cover.url} alt={title} /> : null}
          <div className="dhero__shade" aria-hidden="true" />
          <div className="dhero__txt">
            <div className="tags">
              <span className="tag">{t.cases.kinds[c.kind] ?? c.kind}</span>
              {place && (
                <span className="tag">
                  <IcPin style={{ width: 14, height: 14 }} />
                  {place}
                </span>
              )}
              {c.is_demo && <span className="tag">{t.demoBadge}</span>}
            </div>
            <h1>{title}</h1>
          </div>
        </div>

        {stats.length > 0 && (
          <div className="kpis">
            {stats.map((s) => (
              <div className="kpi" key={s.label}>
                <b>
                  {s.value}
                  {s.unit && <span>{s.unit}</span>}
                </b>
                <small>{s.label}</small>
              </div>
            ))}
          </div>
        )}

        <section style={{ marginTop: 32 }}>
          <span className="eyebrow">{t.cases.storyTitle}</span>
          <div className="story">
            {story.map((step, i) => (
              <div className={`story__item${step.navy ? ' is-navy' : ''}`} key={step.label}>
                <h3>
                  {String(i + 1).padStart(2, '0')} · {step.label}
                </h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {groups.length > 0 && (
          <section style={{ marginTop: 36 }}>
            <span className="eyebrow">{t.cases.albumTitle}</span>
            <p className="lead" style={{ marginTop: 4 }}>
              {t.cases.albumLede} · {fmt(t.cases.photoCount, { n: photos.length })}
            </p>
            {groups.map((g) => (
              <div key={g.stage}>
                <div className="stage-title">{t.cases.stage[g.stage]}</div>
                <div className="album">
                  {g.photos.map((ph) => {
                    const caption = (isFr && ph.caption_fr) || ph.caption_ar
                    return (
                      <figure key={ph.id}>
                        <img
                          src={photoPublicUrl(baseUrl, ph.storage_path)}
                          alt={caption ?? t.cases.stage[g.stage]}
                          loading="lazy"
                        />
                        {(caption || ph.taken_at) && (
                          <figcaption>
                            <span>{caption}</span>
                            {ph.taken_at && <time>{ph.taken_at.slice(0, 7)}</time>}
                          </figcaption>
                        )}
                      </figure>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        <p className="fine">{t.cases.consentNote}</p>

        <div className="cta-band">
          <div>
            <h2>{t.cases.ctaTitle}</h2>
            <p>{t.cases.ctaBody}</p>
          </div>
          <Link href={path(locale, '/demande')} className="btn btn--gold">
            {t.nav.cta}
            <IcArrow className="arr" />
          </Link>
        </div>
      </div>
    </div>
  )
}
