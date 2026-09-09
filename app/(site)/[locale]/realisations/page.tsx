import Link from 'next/link'
import '@/app/landing.css'
import '@/app/landing-pages.css'
import { db } from '@/lib/supabase/server'
import { getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { formatNumber } from '@/lib/format'
import { type CasePhoto } from '@/lib/photos'
import { coverFor, metaLine } from '@/lib/case-cover'
import { IcArrow, IcPin } from '@/components/landing/icons'

/* eslint-disable @next/next/no-img-element -- صور من مخزن Supabase */

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

/**
 * الحالات المنجزة — بهوية صفحة الاستقبال: ترويسة كبيرة، شرائح المعتمديات،
 * ثمّ شبكة بطاقات الصورة فيها أوّلاً. كلّ بطاقة رابط لصفحة الحالة.
 */
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
    <div className="lp">
      <section className="wrap phero">
        <span className="eyebrow">{t.cases.navLink}</span>
        <h1>{t.cases.title}</h1>
        <p className="lead">{t.cases.lede}</p>

        {/* نبض الولاية — أعداد فقط */}
        <div className="totals">
          <span>
            <span className="dot" style={{ background: '#0E3A5B' }} aria-hidden="true" />
            <b>{formatNumber(totals.completed)}</b>
            {t.cases.mapCompleted}
          </span>
          <span>
            <span className="dot" style={{ background: '#D4A15E' }} aria-hidden="true" />
            <b>{formatNumber(totals.active)}</b>
            {t.cases.mapActive}
          </span>
          <span>
            <span className="dot" style={{ background: '#9CCFAE' }} aria-hidden="true" />
            <b>{formatNumber(totals.properties)}</b>
            {t.cases.mapProperties}
          </span>
        </div>

        <div className="chips">
          <Link
            href={path(locale, '/realisations')}
            className={`chip${selected === null ? ' is-on' : ''}`}
            aria-current={selected === null ? 'true' : undefined}
          >
            {t.cases.allDelegations}
          </Link>
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
                aria-current={active ? 'true' : undefined}
                title={`${a.completed_cases} ${t.cases.mapCompleted} · ${a.active_files} ${t.cases.mapActive} · ${a.available_properties} ${t.cases.mapProperties}`}
                className={`chip${active ? ' is-on' : ''}`}
              >
                {a.name_ar}
                <b>{total}</b>
              </Link>
            )
          })}
        </div>

        {cases.some((c) => c.is_demo) && <p className="note">{t.demoNotice}</p>}
      </section>

      <section className="wrap">
        {cases.length === 0 ? (
          <p className="panel">{t.cases.empty}</p>
        ) : (
          <div className="cgrid">
            {cases.map((c) => {
              const cover = coverFor(photosByCase.get(c.id) ?? [], c, baseUrl)
              const place = c.delegation_id ? delegationName.get(c.delegation_id) ?? null : null
              return (
                <Link key={c.id} href={path(locale, `/realisations/${c.id}`)} className="ccard">
                  <div className="ccard__img">
                    {cover ? <img src={cover.url} alt="" loading="lazy" /> : null}
                    <span className="ccard__kind">{t.cases.kinds[c.kind] ?? c.kind}</span>
                    {cover && cover.count > 1 && (
                      <span className="ccard__count">
                        {cover.count} {t.cases.photosShort}
                      </span>
                    )}
                    {c.is_demo && <span className="ccard__demo">{t.demoBadge}</span>}
                  </div>
                  <div className="ccard__body">
                    <h3>{(isFr && c.title_fr) || c.title_ar}</h3>
                    <span className="ccard__meta">
                      {metaLine(
                        { completedAt: c.completed_at, areaM2: c.area_m2, months: c.duration_months },
                        { m2: t.cases.areaUnit, months: t.cases.months }
                      )}
                    </span>
                    {place && (
                      <span className="ccard__place">
                        <IcPin style={{ width: 16, height: 16 }} />
                        {place}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <p className="fine">{t.cases.consentNote}</p>
        <p className="fine">{t.cases.disclaimer}</p>

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
      </section>
    </div>
  )
}
