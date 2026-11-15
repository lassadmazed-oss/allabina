import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/user-session'
import { getClientChantier } from '@/lib/client-site'
import { lateDays } from '@/lib/site-reports'
import { setClientConsentAction } from '@/lib/actions/publication'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'
import { isolateNumbers } from '@/lib/format'
import Icon from '@/components/Icon'
import Pill, { type Tone } from '@/components/Pill'
import { requestTypeIcon, requestTypeName } from '@/lib/request-types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = getDictionary(isLocale(locale) ? locale : 'ar').account
  // صفحة ورشة حريفٍ بعينه: لا تُفهرس ولا تُتبع
  return { title: t.site.pageTitle, robots: { index: false, follow: false } }
}

/** لون الحالة — الذهبي لما يجري، والأخضر للمسلَّم، والرمادي للموقوف */
const STATUS_TONE: Record<string, Tone> = {
  preparing: 'gray',
  running: 'gold',
  paused: 'red',
  delivered: 'green',
  stopped: 'gray',
}

/**
 * ورشة الحريف كما يراها هو.
 *
 * المعتمَد وحده، وبلا كمّيات ولا أسعار ولا ملاحظات داخلية: النسبة
 * والشغل والصور وبرنامج الغد. والملكية تُفحص في القراءة نفسها، فلا
 * تكفي معرفة المرجع لفتح ورشة غيره.
 */
export default async function ClientChantierPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>
}) {
  const { locale: raw, ref } = await params
  const locale: Locale = isLocale(raw) ? raw : 'ar'
  const dict = getDictionary(locale)
  const t = dict.account

  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/compte?next=/${locale}/compte`)

  const refCode = decodeURIComponent(ref)
  const { data: request } = await db
    .from('housing_requests')
    .select('id, ref_code, request_type')
    .eq('ref_code', refCode)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!request) notFound()

  const site = await getClientChantier(String(request.id), user.id, 10)
  if (!site) notFound()

  const late = lateDays(site.expectedEnd)
  // الشوط الجاري — أو آخر ما تمّ إن لم يبدأ شيء بعد
  const currentStage =
    site.timeline.find((x) => x.state === 'current') ??
    [...site.timeline].reverse().find((x) => x.state === 'done') ??
    null

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link href={`/${locale}/compte`} className="text-sm text-muted underline underline-offset-4">
        {t.site.back}
      </Link>

      <p className="num mt-6 text-xs text-faint">{isolateNumbers(refCode)}</p>
      <h1 className="display mt-1 text-2xl font-semibold sm:text-3xl">{t.site.title}</h1>

      {/* ── الشريط: المرجع · الحالة · الشوط (الماكيتة F04) ── */}
      <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <div className="flex items-center gap-2.5 bg-surface p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
            <Icon name={requestTypeIcon(String(request.request_type))} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <dt className="text-[11px] text-faint">{t.site.refLabel}</dt>
            <dd className="truncate text-sm font-medium">
              {requestTypeName(String(request.request_type), locale)}
            </dd>
          </span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
            <Icon name="file" className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <dt className="text-[11px] text-faint">{t.site.statusLabel}</dt>
            <dd className="mt-0.5">
              <Pill tone={STATUS_TONE[site.status] ?? 'gray'}>{t.site.status[site.status]}</Pill>
            </dd>
          </span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
            <Icon name="bricks" className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <dt className="text-[11px] text-faint">{t.site.stageLabel}</dt>
            <dd className="truncate text-sm font-medium">
              {currentStage
                ? locale === 'fr'
                  ? currentStage.nameFr
                  : currentStage.nameAr
                : '—'}
            </dd>
          </span>
        </div>
      </dl>

      {/* ── التقدّم ── */}
      <section className="mt-6 rounded border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          {site.progress.pct === null ? (
            <span className="text-sm text-muted">{t.site.noContract}</span>
          ) : (
            <>
              <span className="num text-3xl font-semibold">
                {isolateNumbers(String(site.progress.pct))}%
              </span>
              <span className="text-sm text-muted">{t.site.progress}</span>
            </>
          )}
        </div>

        {site.progress.pct !== null && (
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-2.5 rounded-full bg-gold-light transition-[width]"
              style={{ width: `${Math.min(100, site.progress.pct)}%` }}
            />
          </div>
        )}

        {site.statusNote && <p className="mt-3 text-sm leading-7 text-ink-soft">{site.statusNote}</p>}

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {site.startedAt && (
            <div>
              <dt className="text-xs text-faint">{t.site.started}</dt>
              <dd className="num mt-0.5 text-sm">{isolateNumbers(site.startedAt)}</dd>
            </div>
          )}
          {site.expectedEnd && (
            <div>
              <dt className="text-xs text-faint">{t.site.expected}</dt>
              <dd className="num mt-0.5 text-sm">
                {isolateNumbers(site.expectedEnd)}
                {late !== null && late > 0 && (
                  <span className="ms-1 text-xs text-gold">
                    +<span className="num">{isolateNumbers(String(late))}</span> {t.site.days}
                  </span>
                )}
              </dd>
            </div>
          )}
          {site.deliveredAt && (
            <div>
              <dt className="text-xs text-faint">{t.site.delivered}</dt>
              <dd className="num mt-0.5 text-sm">{isolateNumbers(site.deliveredAt)}</dd>
            </div>
          )}
        </dl>

        <p className="mt-3 border-t border-line pt-3 text-xs leading-6 text-faint">
          {t.site.howCounted}
        </p>
      </section>

      {/* ── الخطّ الزمني: كمّل · قاعد يتعمل · جاي ── */}
      {site.timeline.length > 0 && (
        <section className="mt-5 rounded border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">{t.site.timeline}</h2>
          <ol className="mt-3">
            {site.timeline.map((st, i) => {
              const last = i === site.timeline.length - 1
              return (
                <li key={st.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {/* الخيط الواصل: المراحل سلسلة لا قائمة نقاط */}
                  {!last && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-6 bottom-0 w-px ${
                        st.state === 'done' ? 'bg-[#1d6b45]/35' : 'bg-line'
                      }`}
                      style={{ insetInlineStart: '0.625rem' }}
                    />
                  )}
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      st.state === 'done'
                        ? 'border-[#1d6b45] bg-[#1d6b45] text-white'
                        : st.state === 'current'
                          ? 'border-brand bg-surface'
                          : 'border-line bg-surface'
                    }`}
                  >
                    {st.state === 'done' ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    ) : st.state === 'current' ? (
                      <span className="size-2 rounded-full bg-brand" />
                    ) : null}
                  </span>
                  <span className="min-w-0 leading-6">
                    <span
                      className={`block ${st.state === 'upcoming' ? 'text-muted' : 'font-medium'}`}
                    >
                      {locale === 'fr' ? st.nameFr : st.nameAr}
                    </span>
                    <span className="block text-xs text-muted">
                      {st.state === 'done'
                        ? t.site.stageDone
                        : st.state === 'current'
                          ? `${t.site.stageCurrent} · `
                          : t.site.stageUpcoming}
                      {st.state === 'current' && (
                        <span className="num">{isolateNumbers(String(st.pct))}%</span>
                      )}
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* ── الأشواط ── */}
      {site.byLot.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-semibold">{t.site.byLot}</h2>
          <ul className="mt-3 grid gap-2">
            {site.byLot.map((l) => (
              <li key={l.lotCode} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{l.lotNameAr}</span>
                <span className="num text-xs text-muted">
                  {l.pct === null ? '—' : `${isolateNumbers(String(l.pct))}%`}
                </span>
                <span className="h-1.5 w-24 rounded bg-surface-2">
                  <span
                    className="block h-1.5 rounded bg-gold"
                    style={{ width: `${Math.min(100, l.pct ?? 0)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── التقارير ── */}
      <section className="mt-8">
        <h2 className="display text-lg font-semibold">{t.site.reports}</h2>
        {site.reports.length === 0 ? (
          <p className="mt-2 text-sm leading-7 text-muted">{t.site.noReports}</p>
        ) : (
          <ul className="mt-4 grid gap-5">
            {site.reports.map((r) => (
              <li key={r.id} className="rounded border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num text-sm font-semibold">{isolateNumbers(r.reportDate)}</span>
                  {r.weather && <span className="text-xs text-muted">{r.weather}</span>}
                </div>

                {r.done && <p className="mt-2 leading-8">{r.done}</p>}

                {r.blocked && (
                  <p className="mt-2 rounded bg-gold-soft px-3 py-2 text-sm leading-7">
                    <b>{t.site.blocked}:</b> {r.blocked}
                    {r.blockedReason ? ` — ${r.blockedReason}` : ''}
                  </p>
                )}

                {r.photos.length > 0 && (
                  <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {r.photos.map((p, i) => (
                      <li key={i}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.caption ?? ''}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[4/3] w-full rounded border border-line object-cover"
                        />
                        {p.caption && (
                          <span className="mt-1 block text-xs text-faint">{p.caption}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {r.nextPlan && (
                  <p className="mt-3 border-t border-line pt-2 text-sm leading-7 text-muted">
                    <b>{t.site.next}:</b> {r.nextPlan}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── موافقة النشر: ملكُه قصّتَه ── */}
      <section className="mt-8 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{t.site.publishTitle}</h2>
        {/*
          السطر التفسيري يتبدّل مع الحالة: كان يقول «مشروعك خاصّ» دائماً،
          فيقرأ الحريف تناقضاً — «خاصّ» فوق «موافقتك وصلت»، وأسوأ: «خاصّ»
          وهو معروض فعلاً في «ورشاتنا».
        */}
        <p className="mt-1 text-sm leading-7 text-muted">
          {site.consent.isPublic
            ? t.site.publishBodyLive
            : site.consent.clientAt
              ? t.site.publishBodyWaiting
              : t.site.publishBody}
        </p>

        <p className="mt-3 text-sm leading-7">
          {site.consent.isPublic
            ? t.site.publishLive
            : site.consent.clientAt
              ? t.site.publishWaiting
              : t.site.publishPrivate}
        </p>

        <form action={setClientConsentAction} className="mt-3">
          <input type="hidden" name="ref" value={refCode} />
          <input type="hidden" name="consent" value={site.consent.clientAt ? '0' : '1'} />
          <button
            type="submit"
            className={`min-h-10 rounded px-4 text-sm font-semibold ${
              site.consent.clientAt
                ? 'border border-line'
                : 'bg-brand text-white'
            }`}
          >
            {site.consent.clientAt ? t.site.publishWithdraw : t.site.publishGive}
          </button>
        </form>

        <p className="mt-3 text-xs leading-6 text-faint">{t.site.publishNever}</p>
      </section>

      <p className="mt-8 text-xs leading-7 text-faint">{t.site.footer}</p>
    </div>
  )
}
