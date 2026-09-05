import Link from 'next/link'
import PledgeForm from '@/components/PledgeForm'
import { db } from '@/lib/supabase/server'
import { fmt, getDictionary, isLocale, path, type Locale } from '@/lib/i18n'
import { needsProgress } from '@/lib/support'

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
}

/**
 * قيد دفتر الشفافية كما يُعرض للعموم.
 * `value_tnd` غائب هنا عمداً: لا يُسحب من القاعدة أصلاً.
 */
type LedgerRow = {
  id: number
  request_id: string
  event: string
  label: string
  kind: string | null
  quantity_note: string | null
  partner_public: string | null
  need_id: number | null
  occurred_at: string
}

const EVENT_TONE: Record<string, string> = {
  needed: 'border-gold/40 bg-gold-soft text-gold',
  pledged: 'border-line-strong bg-surface-2 text-muted',
  confirmed: 'border-brand/40 bg-brand-soft text-brand',
  delivered: 'border-brand bg-brand-soft text-brand-deep',
  cancelled: 'border-line bg-surface-2 text-faint',
}

export default async function SoutienPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.soutien
  const isFr = locale === 'fr'

  const { data: casesRaw } = await db
    .from('support_cases')
    .select('id, request_id, title_ar, title_fr, summary_ar, summary_fr, delegation_id, created_at')
    .eq('published', true)
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const cases = (casesRaw ?? []) as SupportCase[]
  const requestIds = cases.map((c) => c.request_id)

  const [{ data: ledgerRaw }, { data: delegationsRaw }] = await Promise.all([
    requestIds.length
      ? db
          .from('support_ledger')
          .select(
            'id, request_id, event, label, kind, quantity_note, partner_public, need_id, occurred_at'
          )
          .in('request_id', requestIds)
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
      : Promise.resolve({ data: [] }),
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX'),
  ])

  const ledger = (ledgerRaw ?? []) as LedgerRow[]
  const delegationName = new Map(
    ((delegationsRaw ?? []) as { id: number; name_ar: string }[]).map((d) => [d.id, d.name_ar])
  )

  const byRequest = new Map<string, LedgerRow[]>()
  for (const row of ledger) {
    const list = byRequest.get(row.request_id) ?? []
    list.push(row)
    byRequest.set(row.request_id, list)
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="display text-3xl font-semibold">{t.title}</h1>
      <p className="mt-4 max-w-3xl leading-8 text-muted">{t.lede}</p>

      <ul className="mt-6 flex flex-col gap-2 rounded border border-line bg-surface p-6 text-sm leading-7 text-muted">
        {t.principles.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <section className="mt-12">
        {cases.length === 0 ? (
          <p className="rounded border border-line bg-surface p-10 text-center leading-8 text-muted">
            {t.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {cases.map((c) => {
              const rows = byRequest.get(c.request_id) ?? []
              const needs = rows.filter((r) => r.event === 'needed')
              const covered = new Set(
                rows.filter((r) => r.event === 'delivered' && r.need_id).map((r) => r.need_id)
              )
              const progress = needsProgress(needs.length, covered.size)
              const open = needs.filter((n) => !covered.has(n.id))
              const title = (isFr && c.title_fr) || c.title_ar
              const summary = (isFr && c.summary_fr) || c.summary_ar

              return (
                <article key={c.id} className="rounded border border-line bg-surface p-6 sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="display text-xl font-semibold">{title}</h2>
                    {c.delegation_id && delegationName.has(c.delegation_id) && (
                      <span className="rounded bg-surface-2 px-3 py-1 text-xs text-muted">
                        {delegationName.get(c.delegation_id)}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 leading-8 text-muted">{summary}</p>

                  {/* التقدّم بالأعداد لا بالدنانير — progression en nombre de besoins */}
                  {progress.total > 0 && (
                    <div className="mt-5">
                      <div className="flex items-baseline justify-between text-xs text-muted">
                        <span>
                          {fmt(t.progressLabel, { done: progress.done, total: progress.total })}
                        </span>
                        <span className="num text-faint">{progress.percent}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-surface-2" aria-hidden="true">
                        <div
                          className="h-1.5 rounded-full bg-brand"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <h3 className="mt-6 text-sm font-medium">{t.openNeeds}</h3>
                  {open.length === 0 ? (
                    <p className="mt-2 text-sm text-faint">{t.noNeeds}</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {open.map((n) => (
                        <li
                          key={n.id}
                          className="rounded border border-gold/40 bg-gold-soft px-3 py-1.5 text-sm text-gold"
                        >
                          {n.label}
                          {n.quantity_note && (
                            <span className="num ms-2 text-xs opacity-80">{n.quantity_note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {rows.length > 0 && (
                    <details className="mt-6 border-t border-line pt-4">
                      <summary className="cursor-pointer text-sm font-medium text-brand">
                        {t.caseLink}
                      </summary>
                      <p className="mt-2 text-xs leading-6 text-faint">{t.ledgerLede}</p>
                      <ol className="mt-4 flex flex-col gap-3">
                        {rows.map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                          >
                            <span
                              className={`rounded border px-2 py-0.5 text-xs ${
                                EVENT_TONE[r.event] ?? 'border-line bg-surface-2 text-muted'
                              }`}
                            >
                              {t.events[r.event] ?? r.event}
                            </span>
                            <span className="num text-xs text-faint">{r.occurred_at}</span>
                            <span>{r.label}</span>
                            {r.quantity_note && (
                              <span className="num text-xs text-muted">{r.quantity_note}</span>
                            )}
                            {r.event !== 'needed' && (
                              <span className="text-xs text-muted">
                                — {r.partner_public || t.anonymousDonor}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <p className="mt-6 text-xs leading-6 text-faint">{t.countsOnlyNote}</p>

      <section id="pledge" className="mt-12 rounded border border-line bg-surface p-6 sm:p-8">
        <h2 className="display text-xl font-semibold">{t.pledgeTitle}</h2>
        <p className="mt-2 max-w-3xl leading-8 text-muted">{t.pledgeLede}</p>
        <div className="mt-6">
          <PledgeForm
            t={t}
            cases={cases.map((c) => ({ id: c.id, title: (isFr && c.title_fr) || c.title_ar }))}
          />
        </div>
      </section>

      <p className="mt-8 rounded border border-line bg-gold-soft p-4 text-sm leading-7">
        {dict.cases.disclaimer}
      </p>

      <div className="mt-6 text-sm">
        <Link href={path(locale, '/realisations')} className="text-brand hover:underline">
          {dict.cases.navLink} ←
        </Link>
      </div>
    </div>
  )
}
