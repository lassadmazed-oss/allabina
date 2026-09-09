import Link from 'next/link'
import '@/app/landing.css'
import '@/app/landing-pages.css'
import { formatPercent } from '@/lib/format'
import PledgeForm from '@/components/PledgeForm'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { needsProgress } from '@/lib/support'
import { photoPublicUrl } from '@/lib/photos'
import { IcArrow, IcPin } from '@/components/landing/icons'

/* eslint-disable @next/next/no-img-element -- صور من مخزن Supabase */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  return { title: t.soutien.pageTitle, description: t.soutien.lede }
}

type SupportCase = {
  id: string
  request_id: string
  title_ar: string
  title_fr: string | null
  summary_ar: string
  summary_fr: string | null
  delegation_id: number | null
  created_at: string
  is_demo: boolean
}

type LedgerRow = {
  id: number
  request_id: string
  event: string
  label: string
  need_id: number | null
}

type SupportPhoto = {
  support_case_id: string
  storage_path: string
  caption_ar: string | null
  caption_fr: string | null
  sort_order: number
}

/**
 * حالات تحتاج مساندة — الحاجة لا الشخص. كلّ حالة بطاقة بصورتها، تقدّمها
 * بالأعداد، وحاجياتها المفتوحة، ورابط لصفحتها حيث الدفتر الكامل والتعهّد.
 */
export default async function SoutienPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.soutien
  const isFr = locale === 'fr'

  const { data: casesRaw } = await db
    .from('support_cases')
    .select('id, request_id, title_ar, title_fr, summary_ar, summary_fr, delegation_id, created_at, is_demo')
    .eq('published', true)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(40)
  const cases = (casesRaw ?? []) as SupportCase[]
  const requestIds = cases.map((c) => c.request_id)
  const caseIds = cases.map((c) => c.id)

  const [{ data: ledgerRaw }, { data: delegationsRaw }, { data: photosRaw }] = await Promise.all([
    requestIds.length
      ? db
          .from('support_ledger')
          .select('id, request_id, event, label, need_id')
          .in('request_id', requestIds)
      : Promise.resolve({ data: [] }),
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX'),
    caseIds.length
      ? db
          .from('support_photos')
          .select('support_case_id, storage_path, caption_ar, caption_fr, sort_order')
          .in('support_case_id', caseIds)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
  ])

  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const delegationName = new Map(
    ((delegationsRaw ?? []) as { id: number; name_ar: string }[]).map((d) => [d.id, d.name_ar])
  )
  const byRequest = new Map<string, LedgerRow[]>()
  for (const row of (ledgerRaw ?? []) as LedgerRow[]) {
    const list = byRequest.get(row.request_id) ?? []
    list.push(row)
    byRequest.set(row.request_id, list)
  }
  const photosByCase = new Map<string, SupportPhoto[]>()
  for (const ph of (photosRaw ?? []) as SupportPhoto[]) {
    const list = photosByCase.get(ph.support_case_id) ?? []
    list.push(ph)
    photosByCase.set(ph.support_case_id, list)
  }

  return (
    <div className="lp">
      <section className="wrap phero">
        <span className="eyebrow">{t.navLink}</span>
        <h1>{t.title}</h1>
        <p className="lead">{t.lede}</p>
        {cases.some((c) => c.is_demo) && <p className="note">{dict.demoNotice}</p>}
        <ul className="principles">
          {t.principles.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="wrap">
        {/* مدخل صاحب الحاجة */}
        <div className="panel panel--soft">
          <h2>{t.askHelp.cardTitle}</h2>
          <p className="lead" style={{ marginTop: 8 }}>
            {t.askHelp.cardBody}
          </p>
          <Link href={path(locale, '/soutien/demande')} className="btn btn--navy" style={{ marginTop: 16 }}>
            {t.askHelp.cardCta}
            <IcArrow className="arr" />
          </Link>
        </div>

        {cases.length === 0 ? (
          <p className="panel">{t.empty}</p>
        ) : (
          <div className="sgrid">
            {cases.map((c) => {
              const rows = byRequest.get(c.request_id) ?? []
              const needs = rows.filter((r) => r.event === 'needed')
              const covered = new Set(
                rows.filter((r) => r.event === 'delivered' && r.need_id).map((r) => r.need_id)
              )
              const progress = needsProgress(needs.length, covered.size)
              const title = (isFr && c.title_fr) || c.title_ar
              const summary = (isFr && c.summary_fr) || c.summary_ar
              const photos = photosByCase.get(c.id) ?? []
              const cover = photos[0]
              const href = path(locale, `/soutien/${c.id}`)
              const place = c.delegation_id ? delegationName.get(c.delegation_id) ?? null : null

              return (
                <article key={c.id} className="scard">
                  <Link href={href} className="scard__img" aria-label={title}>
                    {cover ? (
                      <img src={photoPublicUrl(baseUrl, cover.storage_path)} alt="" loading="lazy" />
                    ) : null}
                    {photos.length > 1 && (
                      <span className="ccard__count">
                        {photos.length} {dict.cases.photosShort}
                      </span>
                    )}
                    {c.is_demo && <span className="ccard__demo">{dict.demoBadge}</span>}
                  </Link>
                  <div className="scard__body">
                    {place && (
                      <span className="ccard__place" style={{ marginTop: 0, paddingTop: 0 }}>
                        <IcPin style={{ width: 16, height: 16 }} />
                        {place}
                      </span>
                    )}
                    <h2>
                      <Link href={href}>{title}</Link>
                    </h2>
                    <p>{summary}</p>

                    {progress.total > 0 && (
                      <div>
                        <div className="progress-row">
                          <span>{fmt(t.progressLabel, { done: progress.done, total: progress.total })}</span>
                          <span>{formatPercent(progress.percent)}</span>
                        </div>
                        <div className="bar" style={{ marginTop: 6 }} aria-hidden="true">
                          <span style={{ width: `${progress.percent}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="needs">
                      {needs.map((n) => (
                        <span key={n.id} className={`need${covered.has(n.id) ? ' is-done' : ''}`}>
                          {n.label}
                        </span>
                      ))}
                      {needs.length === 0 && <span className="fine">{t.noNeeds}</span>}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <Link href={href} className="btn btn--navy btn--sm">
                        {t.caseLink}
                        <IcArrow className="arr" />
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <p className="fine">{t.countsOnlyNote}</p>

        <section id="pledge" className="panel">
          <h2>{t.pledgeTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {t.pledgeLede}
          </p>
          <div style={{ marginTop: 18 }}>
            <PledgeForm
              t={t}
              cases={cases.map((c) => ({ id: c.id, title: (isFr && c.title_fr) || c.title_ar }))}
            />
          </div>
        </section>

        <p className="fine">{dict.cases.disclaimer}</p>

        <div className="cta-band">
          <div>
            <h2>{dict.cases.navLink}</h2>
            <p>{dict.cases.lede}</p>
          </div>
          <Link href={path(locale, '/realisations')} className="btn btn--gold">
            {dict.cases.navLink}
            <IcArrow className="arr" />
          </Link>
        </div>
      </section>
    </div>
  )
}
