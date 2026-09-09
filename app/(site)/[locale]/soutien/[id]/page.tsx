import Link from 'next/link'
import { notFound } from 'next/navigation'
import '@/app/landing.css'
import '@/app/landing-pages.css'
import { formatPercent } from '@/lib/format'
import PledgeForm from '@/components/PledgeForm'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { needsProgress } from '@/lib/support'
import { photoPublicUrl } from '@/lib/photos'
import { IcPin } from '@/components/landing/icons'

/* eslint-disable @next/next/no-img-element -- صور من مخزن Supabase */

export const dynamic = 'force-dynamic'

type SupportCase = {
  id: string
  request_id: string
  title_ar: string
  title_fr: string | null
  summary_ar: string
  summary_fr: string | null
  delegation_id: number | null
  created_at: string
  closed_at: string | null
  is_demo: boolean
}

type LedgerRow = {
  id: number
  event: string
  label: string
  kind: string | null
  quantity_note: string | null
  partner_public: string | null
  need_id: number | null
  occurred_at: string
}

type SupportPhoto = {
  id: string
  storage_path: string
  caption_ar: string | null
  caption_fr: string | null
  sort_order: number
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar')
  const { data } = await db
    .from('support_cases')
    .select('title_ar, title_fr')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()
  if (!data) return { title: t.soutien.pageTitle }
  const title = (locale === 'fr' && data.title_fr) || data.title_ar
  return { title: `${title} — ${t.nav.brand}` }
}

/**
 * صفحة حالة مساندة واحدة: الصورة والعنوان، الحاجيات بالأعداد، الألبوم،
 * دفتر الشفافية كاملاً، ثمّ استمارة التعهّد مربوطة بهذه الحالة.
 */
export default async function SupportCasePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale: raw, id } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.soutien
  const isFr = locale === 'fr'

  const { data: caseRaw } = await db
    .from('support_cases')
    .select('id, request_id, title_ar, title_fr, summary_ar, summary_fr, delegation_id, created_at, closed_at, is_demo')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()
  if (!caseRaw) notFound()
  const c = caseRaw as SupportCase

  const [{ data: ledgerRaw }, { data: deleg }, { data: photosRaw }] = await Promise.all([
    db
      .from('support_ledger')
      .select('id, event, label, kind, quantity_note, partner_public, need_id, occurred_at')
      .eq('request_id', c.request_id)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false }),
    c.delegation_id
      ? db.from('delegations').select('name_ar').eq('id', c.delegation_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('support_photos')
      .select('id, storage_path, caption_ar, caption_fr, sort_order')
      .eq('support_case_id', c.id)
      .order('sort_order'),
  ])

  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const rows = (ledgerRaw ?? []) as LedgerRow[]
  const photos = (photosRaw ?? []) as SupportPhoto[]
  const place = (deleg as { name_ar: string } | null)?.name_ar ?? null
  const title = (isFr && c.title_fr) || c.title_ar
  const summary = (isFr && c.summary_fr) || c.summary_ar

  const needs = rows.filter((r) => r.event === 'needed')
  const covered = new Set(rows.filter((r) => r.event === 'delivered' && r.need_id).map((r) => r.need_id))
  const progress = needsProgress(needs.length, covered.size)
  const open = needs.filter((n) => !covered.has(n.id))
  const cover = photos[0]

  return (
    <div className="lp">
      <div className="wrap" style={{ paddingTop: 12 }}>
        <Link href={path(locale, '/soutien')} className="back">
          {t.askHelp.backToCases}
        </Link>

        <div className="dhero">
          {cover ? <img src={photoPublicUrl(baseUrl, cover.storage_path)} alt={title} /> : null}
          <div className="dhero__shade" aria-hidden="true" />
          <div className="dhero__txt">
            <div className="tags">
              {place && (
                <span className="tag">
                  <IcPin style={{ width: 14, height: 14 }} />
                  {place}
                </span>
              )}
              {c.is_demo && <span className="tag">{dict.demoBadge}</span>}
            </div>
            <h1>{title}</h1>
          </div>
        </div>

        <p className="lead" style={{ marginTop: 18, maxWidth: '48rem' }}>
          {summary}
        </p>

        <div className="kpis">
          <div className="kpi">
            <b>{progress.total}</b>
            <small>{t.openNeeds}</small>
          </div>
          <div className="kpi">
            <b>{progress.done}</b>
            <small>{t.events.delivered ?? 'delivered'}</small>
          </div>
          <div className="kpi">
            <b>{formatPercent(progress.percent)}</b>
            <small>{fmt(t.progressLabel, { done: progress.done, total: progress.total })}</small>
          </div>
          <div className="kpi">
            <b>{photos.length}</b>
            <small>{dict.cases.photosShort}</small>
          </div>
        </div>

        <section className="panel">
          <h2>{t.openNeeds}</h2>
          {progress.total > 0 && (
            <div className="bar" style={{ marginTop: 12 }} aria-hidden="true">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
          )}
          <div className="needs" style={{ marginTop: 14 }}>
            {needs.map((n) => (
              <span key={n.id} className={`need${covered.has(n.id) ? ' is-done' : ''}`}>
                {n.label}
                {n.quantity_note && <small>{n.quantity_note}</small>}
              </span>
            ))}
            {open.length === 0 && <span className="fine">{t.noNeeds}</span>}
          </div>
        </section>

        {photos.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <span className="eyebrow">{dict.cases.albumTitle}</span>
            <div className="album">
              {photos.map((ph) => {
                const caption = (isFr && ph.caption_fr) || ph.caption_ar
                return (
                  <figure key={ph.id}>
                    <img src={photoPublicUrl(baseUrl, ph.storage_path)} alt={caption ?? title} loading="lazy" />
                    {caption && (
                      <figcaption>
                        <span>{caption}</span>
                      </figcaption>
                    )}
                  </figure>
                )
              })}
            </div>
          </section>
        )}

        <section className="panel">
          <h2>{t.caseLink}</h2>
          <p className="fine" style={{ marginTop: 4 }}>
            {t.ledgerLede}
          </p>
          {rows.length === 0 ? (
            <p className="fine">{t.noNeeds}</p>
          ) : (
            <ol className="ledger">
              {rows.map((r) => (
                <li key={r.id}>
                  <span className={`ev is-${r.event}`}>{t.events[r.event] ?? r.event}</span>
                  <time dateTime={r.occurred_at}>{r.occurred_at}</time>
                  <span>{r.label}</span>
                  {r.quantity_note && <span className="who">{r.quantity_note}</span>}
                  {r.event !== 'needed' && (
                    <span className="who">— {r.partner_public || t.anonymousDonor}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section id="pledge" className="panel">
          <h2>{t.pledgeTitle}</h2>
          <p className="lead" style={{ marginTop: 6 }}>
            {t.pledgeLede}
          </p>
          <div style={{ marginTop: 18 }}>
            <PledgeForm t={t} cases={[{ id: c.id, title }]} />
          </div>
        </section>

        <p className="fine">{t.countsOnlyNote}</p>
        <p className="fine">{dict.cases.disclaimer}</p>
      </div>
    </div>
  )
}
