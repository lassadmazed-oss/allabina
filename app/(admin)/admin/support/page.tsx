import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { addLedgerEntryAction, updatePledgeAction, upsertSupportCaseAction } from '@/lib/actions/support'
import { deleteSupportPhotoAction, makeSupportCoverAction, updateSupportPhotoAction } from '@/lib/actions/support-photos'
import {
  CONTRIBUTION_KINDS,
  CONTRIBUTION_KIND_INFO,
  NEED_STAGES,
  needTimeline,
  needsProgress,
  suggestedKinds,
  type ContributionKind,
  type NeedStage,
} from '@/lib/support'
import { formatMoney } from '@/lib/format'
import { photoPublicUrl } from '@/lib/photos'
import { getDictionary } from '@/lib/i18n'
import { normalizeTnPhone } from '@/lib/sms'
import { BAND_AR, DECISION_AR, type Band, type Decision } from '@/lib/support-assessment'
import SupportPhotoUpload from '@/components/SupportPhotoUpload'

export const metadata = { title: 'المساندة ودفتر الشفافية — اللَّبنة' }
export const dynamic = 'force-dynamic'

/* eslint-disable @next/next/no-img-element -- صور الحالات من المخزن العمومي */

/** تسميات تصريح «اطلب مساندة» — نفس ما يقرأه صاحب الطلب */
const H = getDictionary('ar').soutien.askHelp

const URGENCY_AR: Record<string, string> = { planning: 'يخطّط', within_year: 'خلال سنة', urgent: 'مستعجل', critical: 'حرج' }
const URGENCY_CLS: Record<string, string> = {
  critical: 'bg-[#fbeeeb] text-[#8c2f22] ring-[#8c2f22]/20',
  urgent: 'bg-gold-soft text-gold ring-gold/30',
  within_year: 'bg-brand-soft text-brand ring-brand/20',
  planning: 'bg-surface-2 text-muted ring-line',
}
const BAND_CLS: Record<string, string> = {
  priority: 'bg-brand text-white',
  eligible: 'bg-brand-soft text-brand',
  review: 'bg-gold-soft text-gold',
  not_eligible: 'bg-surface-2 text-muted',
}
const EVENT_AR: Record<string, string> = { needed: 'مطلوب', pledged: 'تعهّد', confirmed: 'مؤكّد', delivered: 'وصل', cancelled: 'ملغى' }
const STAGE_AR: Record<NeedStage, string> = { needed: 'مطلوبة', pledged: 'فيها تعهّد', confirmed: 'تعهّد مؤكّد', delivered: 'وصلت', cancelled: 'ملغاة' }
const STAGE_CLS: Record<NeedStage, string> = {
  needed: 'bg-gold-soft text-gold',
  pledged: 'bg-brand-soft text-brand',
  confirmed: 'bg-brand text-white',
  delivered: 'bg-[#e6f0e9] text-[#1f6b3f]',
  cancelled: 'bg-surface-2 text-muted line-through',
}
const PLEDGE_AR: Record<string, string> = { new: 'جديد', contacted: 'اتّصلنا بيه', accepted: 'قبلناه', declined: 'اعتذرنا' }
const PLEDGE_CLS: Record<string, string> = {
  new: 'bg-gold-soft text-gold',
  contacted: 'bg-brand-soft text-brand',
  accepted: 'bg-[#e6f0e9] text-[#1f6b3f]',
  declined: 'bg-surface-2 text-muted',
}

type InboxRow = {
  id: string
  ref_code: string
  full_name: string
  delegation_id: number | null
  urgency: string | null
  status: string
  problem_note: string | null
  created_at: string
  is_demo: boolean
  total: number | null
  band: string | null
  decision: string | null
  decided_at: string | null
  inconsistencies_found: boolean | null
  checks_done: number | null
}

type SupportCase = {
  id: string
  request_id: string
  title_ar: string
  title_fr: string | null
  summary_ar: string
  summary_fr: string | null
  gov_code: string
  delegation_id: number | null
  consent_given: boolean
  published: boolean
  anonymised: boolean
  closed_at: string | null
}

type LedgerRow = {
  id: number
  request_id: string
  event: string
  label: string
  kind: string | null
  quantity_note: string | null
  value_tnd: number | null
  partner_public: string | null
  need_id: number | null
  occurred_at: string
  note: string | null
}

type Pledge = {
  id: string
  support_case_id: string | null
  need_ids: number[] | null
  full_name: string
  phone: string
  email: string | null
  kind: string
  label: string
  note: string | null
  status: string
  created_at: string
}

type Photo = { id: string; support_case_id: string; storage_path: string; caption_ar: string | null; caption_fr: string | null; sort_order: number }
type Intake = { request_id: string; need_kinds: string[] | null; triggers: string[] | null }
type Option = { id: string | number; name: string }

const inputCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const kindAr = (k: string | null) => (k && k in CONTRIBUTION_KIND_INFO ? CONTRIBUTION_KIND_INFO[k as ContributionKind].ar : 'بلا نوع')

/**
 * المساندة ودفتر الشفافية — مربّعات بدل جداول.
 *
 * ثلاث شبكات: طلبات المساندة الواردة، الحالات بغلاف صورها وحاجياتها مفصّلة
 * حسب نوع التدخّل ومسار كلّ حاجة (مطلوبة ← تعهّد ← مؤكّد ← وصلت)، ثمّ
 * تعهّدات العموم. كلّ نموذج مطويّ داخل بطاقته حتى تبقى الصفحة تُقرأ.
 */
export default async function SupportAdminPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  await requirePermission('requests.update')
  const { request: prefillRequestId } = await searchParams

  const [{ data: casesRaw }, { data: pledgesRaw }, { data: delegs }, { data: partners }, { data: inboxRaw }] = await Promise.all([
    db.from('support_cases').select('*').order('created_at', { ascending: false }),
    db.from('support_pledges').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX').order('id'),
    db.from('partners').select('id, name').order('name'),
    db.from('support_inbox').select('*').order('created_at', { ascending: false }).limit(200),
  ])

  const cases = (casesRaw ?? []) as SupportCase[]
  const pledges = (pledgesRaw ?? []) as Pledge[]
  const delegName = new Map((delegs ?? []).map((d) => [d.id as number, d.name_ar as string]))
  const partnerOptions = ((partners ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name }))
  const delegOptions: Option[] = (delegs ?? []).map((d) => ({ id: d.id as number, name: d.name_ar as string }))

  const URG_RANK: Record<string, number> = { critical: 3, urgent: 2, within_year: 1, planning: 0 }
  const inbox = ((inboxRaw ?? []) as InboxRow[]).sort((a, b) => {
    const u = (URG_RANK[b.urgency ?? ''] ?? 0) - (URG_RANK[a.urgency ?? ''] ?? 0)
    if (u) return u
    const d = Number(!!a.decision && a.decision !== 'pending') - Number(!!b.decision && b.decision !== 'pending')
    if (d) return d
    return a.created_at.localeCompare(b.created_at)
  })

  const requestIds = cases.map((c) => c.request_id)
  const caseIds = cases.map((c) => c.id)
  const intakeIds = [...new Set([...inbox.map((x) => x.id), ...requestIds])]

  const [ledgerRes, photosRes, intakeRes] = await Promise.all([
    requestIds.length
      ? db.from('support_ledger').select('*').in('request_id', requestIds).order('occurred_at', { ascending: false }).order('id', { ascending: false })
      : Promise.resolve({ data: [] }),
    caseIds.length
      ? db.from('support_photos').select('id, support_case_id, storage_path, caption_ar, caption_fr, sort_order').in('support_case_id', caseIds).order('sort_order')
      : Promise.resolve({ data: [] }),
    intakeIds.length
      ? db.from('support_intake').select('request_id, need_kinds, triggers').in('request_id', intakeIds)
      : Promise.resolve({ data: [] }),
  ])

  const ledger = (ledgerRes.data ?? []) as LedgerRow[]
  const byRequest = new Map<string, LedgerRow[]>()
  for (const row of ledger) byRequest.set(row.request_id, [...(byRequest.get(row.request_id) ?? []), row])
  const ledgerById = new Map(ledger.map((r) => [r.id, r]))

  const photosByCase = new Map<string, Photo[]>()
  for (const p of (photosRes.data ?? []) as Photo[]) photosByCase.set(p.support_case_id, [...(photosByCase.get(p.support_case_id) ?? []), p])
  const intakeByRequest = new Map(((intakeRes.data ?? []) as Intake[]).map((i) => [i.request_id, i]))

  const caseByRequest = new Map(cases.map((c) => [c.request_id, c]))
  const caseById = new Map(cases.map((c) => [c.id, c]))
  const openInbox = inbox.filter((x) => !caseByRequest.has(x.id))
  const undecided = inbox.filter((x) => !x.decision || x.decision === 'pending').length
  const newPledges = pledges.filter((p) => p.status === 'new').length
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const caseStats = (c: SupportCase) => {
    const rows = byRequest.get(c.request_id) ?? []
    const needs = rows.filter((r) => r.event === 'needed')
    const timelines = needs.map((n) => ({ need: n, ...needTimeline(n, rows) }))
    const delivered = timelines.filter((t) => t.stage === 'delivered').length
    const cancelled = timelines.filter((t) => t.stage === 'cancelled').length
    return { rows, timelines, progress: needsProgress(needs.length - cancelled, delivered) }
  }
  const stats = new Map(cases.map((c) => [c.id, caseStats(c)]))
  const openNeeds = [...stats.values()].reduce((s, x) => s + (x.progress.total - x.progress.done), 0)
  const sortedCases = [...cases].sort((a, b) => {
    const sa = stats.get(a.id)!.progress
    const sb = stats.get(b.id)!.progress
    return sb.total - sb.done - (sa.total - sa.done)
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/admin" className="text-xs text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-bold text-ink">المساندة ودفتر الشفافية</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">
            ملفّات ما كفاش فيها المسار التجاري. المساندة عينية، والدفتر ما يتعدّلش وما يتحذفش: التصحيح بقيد جديد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi label="طلبات بلا قرار" value={undecided} tone="gold" href="#inbox" />
          <Kpi label="حالات" value={cases.length} href="#cases" />
          <Kpi label="حاجيات مفتوحة" value={openNeeds} tone="brand" href="#cases" />
          <Kpi label="تعهّدات جديدة" value={newPledges} tone="green" href="#pledges" />
        </div>
      </div>

      <nav aria-label="أقسام الصفحة" className="mt-4 flex gap-1.5 overflow-x-auto pb-1 text-xs [scrollbar-width:none]">
        {[
          ['#inbox', `الطلبات الواردة · ${inbox.length}`],
          ['#cases', `الحالات · ${cases.length}`],
          ['#pledges', `التعهّدات · ${pledges.length}`],
          ['#new-case', '+ حالة جديدة'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-ink-soft transition hover:border-brand hover:text-brand">
            {label}
          </a>
        ))}
      </nav>

      {/* ============ الطلبات الواردة ============ */}
      <section id="inbox" className="mt-6 scroll-mt-6">
        <SectionHead title="طلبات المساندة الواردة" hint="الحرج أوّلاً · ثمّ ما لم يُدرَس · ثمّ الأقدم" />
        {inbox.length === 0 ? (
          <Empty text="ما فمّاش طلب مساندة توّا." />
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inbox.map((x) => {
              const intake = intakeByRequest.get(x.id)
              const c = caseByRequest.get(x.id)
              const checks = Math.max(0, Math.min(4, x.checks_done ?? 0))
              return (
                <li key={x.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Link href={`/admin/${x.id}`} className="num text-brand hover:underline" dir="ltr">
                          {x.ref_code}
                        </Link>
                        {x.is_demo && <span className="rounded bg-surface-2 px-1 text-[10px] text-faint">تجريبي</span>}
                      </div>
                      <div className="mt-0.5 truncate font-semibold text-ink">{x.full_name}</div>
                      <div className="text-xs text-muted">{x.delegation_id ? delegName.get(x.delegation_id) ?? '—' : '—'}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${URGENCY_CLS[x.urgency ?? ''] ?? URGENCY_CLS.planning}`}>
                      {URGENCY_AR[x.urgency ?? ''] ?? '—'}
                    </span>
                  </div>

                  {(intake?.need_kinds?.length || intake?.triggers?.length) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(intake?.need_kinds ?? []).map((k) => (
                        <span key={k} className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand">
                          {H.needKindLabels[k] ?? k}
                        </span>
                      ))}
                      {(intake?.triggers ?? [])
                        .filter((t) => t !== 'none')
                        .map((t) => (
                          <span key={t} className="rounded-md bg-[#fbeeeb] px-1.5 py-0.5 text-[11px] text-[#8c2f22]">
                            {H.triggerLabels[t] ?? t}
                          </span>
                        ))}
                    </div>
                  )}

                  {x.problem_note && (
                    <p title={x.problem_note} className="mt-2 line-clamp-3 text-xs leading-6 text-ink-soft [overflow-wrap:anywhere]">
                      {x.problem_note}
                    </p>
                  )}

                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ground p-2 text-center text-[11px]">
                    <div>
                      <dt className="text-faint">الدرجة</dt>
                      <dd className="mt-0.5">
                        {x.band ? (
                          <span className={`num rounded px-1.5 py-0.5 ${BAND_CLS[x.band]}`}>
                            {x.total} · {BAND_AR[x.band as Band]}
                          </span>
                        ) : (
                          <span className="text-muted">لم يُدرَس</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">التثبّت</dt>
                      <dd className="mt-1 flex items-center justify-center gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={`h-1.5 w-3 rounded-full ${i < checks ? 'bg-brand' : 'bg-line'}`} />
                        ))}
                        {x.inconsistencies_found && <span className="text-[#8c2f22]" title="تناقض مرصود">⚠</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-faint">القرار</dt>
                      <dd className="mt-0.5">
                        {x.decision && x.decision !== 'pending' ? (
                          <span className="text-ink">{DECISION_AR[x.decision as Decision]}</span>
                        ) : (
                          <span className="text-gold">بانتظار</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex gap-2 pt-3">
                    <Link href={`/admin/${x.id}#sec-support`} className="flex h-9 flex-1 items-center justify-center rounded-lg border border-line text-xs font-medium text-brand hover:border-brand">
                      ادرس الملفّ
                    </Link>
                    {c ? (
                      <a href={`#case-${c.id}`} className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-soft text-xs font-medium text-brand">
                        الحالة مفتوحة ↓
                      </a>
                    ) : (
                      <Link
                        href={`/admin/support?request=${x.id}#new-case`}
                        className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand text-xs font-medium text-white hover:bg-brand-deep"
                      >
                        افتح حالة
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ============ الحالات ============ */}
      <section id="cases" className="mt-10 scroll-mt-6">
        <SectionHead title="الحالات ودفاترها" hint="ما بقيت فيه حاجيات مفتوحة أكثر يظهر أوّلاً" />
        {cases.length === 0 ? (
          <Empty text="ما فمّا حتّى حالة مسجّلة." />
        ) : (
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            {sortedCases.map((c) => {
              const { rows, timelines, progress } = stats.get(c.id)!
              const photos = photosByCase.get(c.id) ?? []
              const cover = photos[0]
              const intake = intakeByRequest.get(c.request_id)
              const suggestions = suggestedKinds(intake?.need_kinds)
              const internalValue = rows.filter((r) => r.event === 'delivered').reduce((s, r) => s + Number(r.value_tnd ?? 0), 0)
              const kindsPresent = CONTRIBUTION_KINDS.filter((k) => timelines.some((t) => (t.need.kind ?? 'other') === k))
              const openNeedRows = timelines.filter((t) => t.stage !== 'delivered' && t.stage !== 'cancelled')

              return (
                <article key={c.id} id={`case-${c.id}`} className="flex scroll-mt-6 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  {/* الغلاف: أوّل صورة، أو مكان محجوز يدعو لإضافتها */}
                  <div className="relative aspect-[16/9] bg-surface-2">
                    {cover ? (
                      <img src={photoPublicUrl(baseUrl, cover.storage_path)} alt={cover.caption_ar ?? c.title_ar} className="size-full object-cover" loading="lazy" />
                    ) : (
                      <a href={`#photos-${c.id}`} className="flex size-full flex-col items-center justify-center gap-1.5 text-muted transition hover:text-brand">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                          <circle cx="12" cy="13" r="3.5" />
                        </svg>
                        <span className="text-sm font-semibold">مكان صور الحالة</span>
                        <span className="text-[11px] text-faint">زيد صوراً تعرض الحاجة — بلا وجوه ولا أسماء</span>
                      </a>
                    )}
                    <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
                      <Pill ok={c.consent_given} yes="موافق على العرض" no="بلا موافقة" />
                      <Pill ok={c.published} yes="منشورة" no="غير منشورة" />
                    </div>
                    {photos.length > 1 && (
                      <div className="absolute inset-x-3 bottom-3 flex gap-1.5">
                        {photos.slice(1, 5).map((p) => (
                          <img key={p.id} src={photoPublicUrl(baseUrl, p.storage_path)} alt="" className="size-11 rounded-md object-cover ring-2 ring-white/80" loading="lazy" />
                        ))}
                        {photos.length > 5 && (
                          <span className="num flex size-11 items-center justify-center rounded-md bg-black/50 text-xs text-white">+{photos.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {c.delegation_id && <span>{delegName.get(c.delegation_id) ?? '—'}</span>}
                        <Link href={`/admin/${c.request_id}`} className="text-brand hover:underline">
                          ملفّ المطلب
                        </Link>
                        {c.published && (
                          <Link href={`/ar/soutien/${c.id}`} target="_blank" className="text-brand hover:underline">
                            الصفحة العمومية ↗
                          </Link>
                        )}
                      </div>
                      <h3 className="display mt-1 text-lg font-bold leading-snug text-ink">{c.title_ar}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-7 text-ink-soft">{c.summary_ar}</p>
                    </div>

                    {/* التقدّم */}
                    <div className="rounded-xl bg-ground p-3">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted">
                          قُضيت <b className="num text-ink">{progress.done}</b> من <span className="num">{progress.total}</span> حاجيات
                        </span>
                        <span className="flex items-baseline gap-3">
                          {internalValue > 0 && (
                            <span className="num text-faint" title="داخلي — لا يظهر في الصفحة العمومية">
                              وصل ما قيمته {formatMoney(internalValue)} (داخلي)
                            </span>
                          )}
                          <b className="num text-brand">{progress.percent}%</b>
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-line">
                        <div className="h-2 rounded-full bg-gradient-to-l from-brand to-gold-light" style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>

                    {/* ما صرّح به صاحب الطلب ← خيارات التدخّل */}
                    {(intake?.need_kinds?.length || suggestions.length > 0) && (
                      <div className="text-xs">
                        {intake?.need_kinds?.length ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-faint">صرّح بـ:</span>
                            {intake.need_kinds.map((k) => (
                              <span key={k} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-soft">
                                {H.needKindLabels[k] ?? k}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {suggestions.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="text-faint">خيارات التدخّل المناسبة:</span>
                            {suggestions.map((k) => (
                              <span key={k} title={CONTRIBUTION_KIND_INFO[k].hint} className="rounded-md bg-brand-soft px-1.5 py-0.5 text-brand">
                                {CONTRIBUTION_KIND_INFO[k].ar}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* الحاجيات مفصّلة حسب نوع التدخّل */}
                    {timelines.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
                        ما فمّاش حاجيات مسجّلة. سمّي كلّ حاجة بجنسها وكمّيتها من «حاجة جديدة» تحت.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {kindsPresent.map((k) => (
                          <div key={k}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-bold text-ink">{CONTRIBUTION_KIND_INFO[k].ar}</span>
                              <span className="truncate text-[11px] text-faint">{CONTRIBUTION_KIND_INFO[k].hint}</span>
                            </div>
                            <ul className="mt-1.5 space-y-1.5">
                              {timelines
                                .filter((t) => (t.need.kind ?? 'other') === k)
                                .map((t) => (
                                  <li key={t.need.id} className="rounded-xl border border-line p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="min-w-0 text-sm font-medium text-ink">
                                        {t.need.label}
                                        {t.need.quantity_note && <span className="num ms-1.5 text-xs font-normal text-muted">({t.need.quantity_note})</span>}
                                      </span>
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_CLS[t.stage]}`}>{STAGE_AR[t.stage]}</span>
                                    </div>
                                    <Stepper stage={t.stage} />
                                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                                      {t.partner && <span>المتدخّل: {t.partner}</span>}
                                      {t.last && (
                                        <span className="num">
                                          آخر حركة {t.last.occurred_at} · {EVENT_AR[t.last.event] ?? t.last.event}
                                        </span>
                                      )}
                                      {t.need.value_tnd != null && <span className="num text-faint">تقدير {formatMoney(Number(t.need.value_tnd))} (داخلي)</span>}
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* النماذج — مطويّة داخل البطاقة */}
                    <div className="mt-auto space-y-2 border-t border-line pt-4">
                      <Fold title="+ حاجة جديدة" hint="سمّيها بجنسها وكمّيتها">
                        <form action={addLedgerEntryAction} className="space-y-3">
                          <input type="hidden" name="request_id" value={c.request_id} />
                          <input type="hidden" name="event" value="needed" />
                          <KindPicker defaultKind={suggestions[0] ?? 'materials'} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input name="label" required className={inputCls} placeholder="الحاجة: مثال 120 كيس إسمنت" />
                            <input name="quantity_note" className={inputCls} placeholder="الكمّية أو المدّة: مثال 3 أيّام" />
                            <input name="value_tnd" type="number" step="0.01" className={`${inputCls} num`} placeholder="قيمة تقديرية د.ت (داخلي)" />
                            <input name="occurred_at" type="date" className={`${inputCls} num`} />
                          </div>
                          <input name="note" className={inputCls} placeholder="ملاحظة داخلية (اختياري)" />
                          <Submit>سجّل الحاجة</Submit>
                        </form>
                      </Fold>

                      {openNeedRows.length > 0 && (
                        <Fold title="↻ تحديث حاجة" hint="تعهّد، تأكيد، وصول، أو إلغاء">
                          <form action={addLedgerEntryAction} className="space-y-3">
                            <input type="hidden" name="request_id" value={c.request_id} />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="block text-xs text-muted">
                                الحاجة
                                <select name="need_id" required defaultValue="" className={`${inputCls} mt-1`}>
                                  <option value="" disabled>
                                    اختار الحاجة
                                  </option>
                                  {openNeedRows.map((t) => (
                                    <option key={t.need.id} value={t.need.id}>
                                      {t.need.label} · {STAGE_AR[t.stage]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-xs text-muted">
                                شنوّة صار
                                <select name="event" defaultValue="pledged" className={`${inputCls} mt-1`}>
                                  {(['pledged', 'confirmed', 'delivered', 'cancelled'] as const).map((e) => (
                                    <option key={e} value={e}>
                                      {EVENT_AR[e]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <input name="label" required className={inputCls} placeholder="الوصف كما يُقرأ في الدفتر: مثال تعهّد بـ120 كيس إسمنت" />
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select name="partner_id" defaultValue="" className={inputCls}>
                                <option value="">الشريك (اختياري)</option>
                                {partnerOptions.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <input name="partner_public" className={inputCls} placeholder="الاسم كما يُعرض (فارغ = متبرّع غير مسمّى)" />
                              <input name="quantity_note" className={inputCls} placeholder="الكمّية: مثال 80 من 120" />
                              <input name="value_tnd" type="number" step="0.01" className={`${inputCls} num`} placeholder="قيمة تقديرية د.ت (داخلي)" />
                              <input name="occurred_at" type="date" className={`${inputCls} num`} />
                              <input name="note" className={inputCls} placeholder="ملاحظة داخلية" />
                            </div>
                            <Submit>سجّل في الدفتر</Submit>
                          </form>
                        </Fold>
                      )}

                      <Fold id={`photos-${c.id}`} title={`▣ صور الحالة · ${photos.length}`} hint="الغلاف هو أوّل صورة" open={!photos.length && false}>
                        {photos.length > 0 && (
                          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {photos.map((p, i) => (
                              <li key={p.id} className="overflow-hidden rounded-xl border border-line">
                                <div className="relative aspect-[4/3] bg-surface-2">
                                  <img src={photoPublicUrl(baseUrl, p.storage_path)} alt={p.caption_ar ?? ''} className="size-full object-cover" loading="lazy" />
                                  {i === 0 && <span className="absolute start-1.5 top-1.5 rounded bg-brand px-1.5 text-[10px] text-white">الغلاف</span>}
                                </div>
                                <form action={updateSupportPhotoAction} className="space-y-1.5 p-2">
                                  <input type="hidden" name="photo_id" value={p.id} />
                                  <input name="caption_ar" defaultValue={p.caption_ar ?? ''} placeholder="تعليق" className="h-8 w-full rounded-md border border-line px-2 text-xs" />
                                  <input name="caption_fr" defaultValue={p.caption_fr ?? ''} placeholder="Légende" dir="ltr" className="h-8 w-full rounded-md border border-line px-2 text-xs" />
                                  <button className="h-7 w-full rounded-md border border-line text-[11px] text-brand hover:border-brand">حفظ التعليق</button>
                                </form>
                                <div className="flex border-t border-line text-[11px]">
                                  {i > 0 && (
                                    <form action={makeSupportCoverAction} className="flex-1">
                                      <input type="hidden" name="photo_id" value={p.id} />
                                      <button className="h-8 w-full text-brand hover:bg-brand-soft">اجعلها الغلاف</button>
                                    </form>
                                  )}
                                  <form action={deleteSupportPhotoAction} className="flex-1">
                                    <input type="hidden" name="photo_id" value={p.id} />
                                    <button className="h-8 w-full text-[#8c2f22] hover:bg-[#fbeeeb]">احذف</button>
                                  </form>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <SupportPhotoUpload caseId={c.id} />
                      </Fold>

                      <Fold title="✎ تعديل الحالة" hint="العنوان، الوصف، الموافقة، النشر">
                        <CaseForm c={c} requestId={c.request_id} delegations={delegOptions} />
                      </Fold>

                      {rows.length > 0 && (
                        <Fold title={`☰ الدفتر كاملاً · ${rows.length} قيد`} hint="سجلّ إضافي، الأحدث أوّلاً">
                          <ol className="space-y-1.5 text-sm">
                            {rows.map((r) => (
                              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-ground px-2.5 py-1.5">
                                <span className="rounded bg-surface px-1.5 text-[11px] text-muted ring-1 ring-line">{EVENT_AR[r.event] ?? r.event}</span>
                                <span className="num text-[11px] text-faint">{r.occurred_at}</span>
                                <span className="text-ink">{r.label}</span>
                                {r.kind && <span className="text-[11px] text-muted">· {kindAr(r.kind)}</span>}
                                {r.quantity_note && <span className="num text-[11px] text-muted">· {r.quantity_note}</span>}
                                {r.need_id && ledgerById.get(r.need_id) && r.event !== 'needed' && (
                                  <span className="text-[11px] text-brand">← {ledgerById.get(r.need_id)!.label}</span>
                                )}
                                {r.partner_public && <span className="text-[11px] text-muted">· {r.partner_public}</span>}
                                {r.value_tnd != null && <span className="num text-[11px] text-faint">· {formatMoney(Number(r.value_tnd))} داخلي</span>}
                                {r.note && <span className="text-[11px] text-faint">· {r.note}</span>}
                              </li>
                            ))}
                          </ol>
                        </Fold>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ============ التعهّدات ============ */}
      <section id="pledges" className="mt-10 scroll-mt-6">
        <SectionHead title="تعهّدات واردة من العموم" hint="عينية فقط — القاعدة ترفض التعهّدات المالية" />
        {pledges.length === 0 ? (
          <Empty text="ما وصل حتّى تعهّد توّا." />
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pledges.map((p) => {
              const sc = p.support_case_id ? caseById.get(p.support_case_id) : null
              const needLabels = (p.need_ids ?? []).map((id) => ledgerById.get(Number(id))?.label).filter(Boolean) as string[]
              const wa = normalizeTnPhone(p.phone)
              return (
                <li key={p.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{p.full_name}</div>
                      <div className="num text-[11px] text-faint">{p.created_at.slice(0, 10)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PLEDGE_CLS[p.status] ?? PLEDGE_CLS.new}`}>{PLEDGE_AR[p.status] ?? p.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand">{kindAr(p.kind)}</span>
                    {sc && (
                      <a href={`#case-${sc.id}`} className="truncate text-[11px] text-brand hover:underline">
                        لحالة: {sc.title_ar}
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink">{p.label}</p>
                  {needLabels.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {needLabels.map((l) => (
                        <span key={l} className="rounded-md bg-ground px-1.5 py-0.5 text-[11px] text-ink-soft">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <a href={`tel:${p.phone}`} className="num rounded-lg border border-line px-2.5 py-1 text-brand hover:border-brand" dir="ltr">
                      {p.phone}
                    </a>
                    {wa && (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#1f8f4e] px-2.5 py-1 text-white hover:bg-[#177240]">
                        واتساب
                      </a>
                    )}
                    {p.email && <span className="truncate text-faint">{p.email}</span>}
                  </div>
                  <form action={updatePledgeAction} className="mt-auto pt-3">
                    <input type="hidden" name="pledge_id" value={p.id} />
                    <div className="grid grid-cols-4 gap-1">
                      {Object.entries(PLEDGE_AR).map(([k, v]) => (
                        <label
                          key={k}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-line px-1 py-1.5 text-center text-[11px] has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand"
                        >
                          <input type="radio" name="status" value={k} defaultChecked={p.status === k} className="sr-only" />
                          {v}
                        </label>
                      ))}
                    </div>
                    <button className="mt-2 h-8 w-full rounded-lg bg-brand text-xs font-medium text-white hover:bg-brand-deep">حفظ المتابعة</button>
                    {p.status === 'accepted' && sc && (
                      <a href={`#case-${sc.id}`} className="mt-2 block text-center text-[11px] text-brand hover:underline">
                        سجّل تعهّده في دفتر الحالة ↓
                      </a>
                    )}
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ============ حالة جديدة ============ */}
      <section id="new-case" className="mt-10 scroll-mt-6">
        <details open={Boolean(prefillRequestId)} className="group rounded-2xl border border-line bg-surface shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span>
              <b className="text-ink">+ فتح حالة تحتاج مساندة</b>
              <span className="ms-2 text-xs text-muted">العنوان يوصف الحاجة لا الشخص</span>
            </span>
            <span className="text-muted transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="border-t border-line p-5">
            <CaseForm requestId={prefillRequestId ?? ''} delegations={delegOptions} inbox={openInbox} delegName={delegName} />
          </div>
        </details>
      </section>
    </div>
  )
}

/* ---------------- مكوّنات صغيرة ---------------- */

function Kpi({ label, value, tone, href }: { label: string; value: number; tone?: 'brand' | 'gold' | 'green'; href: string }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'gold' ? 'text-gold' : tone === 'green' ? 'text-[#1f6b3f]' : 'text-ink'
  return (
    <a href={href} className="flex items-baseline gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm transition hover:border-brand">
      <span className={`num text-lg font-bold leading-none ${color}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </a>
  )
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink before:h-2.5 before:w-4 before:rounded-sm before:bg-gold-light before:content-['']">{title}</h2>
      <span className="text-xs text-faint">{hint}</span>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">{text}</p>
}

function Pill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur ${ok ? 'bg-[#e6f0e9]/95 text-[#1f6b3f]' : 'bg-white/90 text-gold'}`}>
      {ok ? yes : no}
    </span>
  )
}

/** مسار الحاجة: أربع نقاط تتلوّن حتى المرحلة التي بلغتها */
function Stepper({ stage }: { stage: NeedStage }) {
  const reached = stage === 'cancelled' ? -1 : NEED_STAGES.indexOf(stage)
  return (
    <div className="mt-2 flex items-center gap-1" aria-label={STAGE_AR[stage]}>
      {NEED_STAGES.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-0.5">
          <span className={`h-1.5 w-full rounded-full ${i <= reached ? (stage === 'delivered' ? 'bg-[#1f8f4e]' : 'bg-brand') : 'bg-line'}`} />
          <span className={`text-[10px] ${i <= reached ? 'text-ink-soft' : 'text-faint'}`}>{EVENT_AR[s]}</span>
        </div>
      ))}
    </div>
  )
}

function Fold({ title, hint, children, id, open }: { title: string; hint?: string; children: React.ReactNode; id?: string; open?: boolean }) {
  return (
    <details id={id} open={open} className="group scroll-mt-6 rounded-xl border border-line bg-ground">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm">
        <span className="font-semibold text-brand">{title}</span>
        <span className="flex items-center gap-2">
          {hint && <span className="hidden text-[11px] text-faint sm:inline">{hint}</span>}
          <span className="text-muted transition group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-line bg-surface p-3">{children}</div>
    </details>
  )
}

function Submit({ children }: { children: React.ReactNode }) {
  return <button className="h-10 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-deep">{children}</button>
}

/** اختيار نوع التدخّل ببطاقات فيها شرح ومثال — بدل قائمة منسدلة صمّاء */
function KindPicker({ defaultKind }: { defaultKind: ContributionKind }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs text-muted">نوع التدخّل</legend>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {CONTRIBUTION_KINDS.map((k) => (
          <label
            key={k}
            className="cursor-pointer rounded-lg border border-line p-2 text-xs transition has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
          >
            <input type="radio" name="kind" value={k} defaultChecked={k === defaultKind} className="sr-only" />
            <span className="block font-semibold text-ink">{CONTRIBUTION_KIND_INFO[k].ar}</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-muted">مثال: {CONTRIBUTION_KIND_INFO[k].example}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** إنشاء حالة أو تعديلها — نفس النموذج، والنشر ممنوع بلا موافقة (في القاعدة أيضاً) */
function CaseForm({
  c,
  requestId,
  delegations,
  inbox,
  delegName,
}: {
  c?: SupportCase
  requestId: string
  delegations: Option[]
  inbox?: InboxRow[]
  delegName?: Map<number, string>
}) {
  return (
    <form action={upsertSupportCaseAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="gov_code" value={c?.gov_code ?? 'SFX'} />
      {c ? (
        <input type="hidden" name="request_id" value={c.request_id} />
      ) : (
        <label className="block text-xs text-muted sm:col-span-2">
          المطلب
          {inbox && inbox.length > 0 ? (
            <select name="request_id" required defaultValue={requestId} className={`${inputCls} mt-1`}>
              <option value="" disabled>
                اختار مطلباً من الطلبات الواردة
              </option>
              {inbox.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.ref_code} · {x.full_name}
                  {x.delegation_id ? ` · ${delegName?.get(x.delegation_id) ?? ''}` : ''}
                  {x.urgency ? ` · ${URGENCY_AR[x.urgency] ?? ''}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input name="request_id" required dir="ltr" defaultValue={requestId} placeholder="معرّف المطلب" className={`${inputCls} mt-1`} />
          )}
        </label>
      )}
      <label className="block text-xs text-muted sm:col-span-2">
        العنوان (عربي)
        <input name="title_ar" required defaultValue={c?.title_ar ?? ''} placeholder="مثال: عائلة تحتاج سقف غرفتين في جبنيانة" className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-xs text-muted sm:col-span-2">
        العنوان (فرنسي)
        <input name="title_fr" defaultValue={c?.title_fr ?? ''} dir="ltr" className={`${inputCls} mt-1`} />
      </label>
      <label className="block text-xs text-muted">
        الوصف (عربي)
        <textarea name="summary_ar" required rows={4} defaultValue={c?.summary_ar ?? ''} className="mt-1 w-full rounded-lg border border-line bg-surface p-3 text-sm outline-none focus:border-brand" />
      </label>
      <label className="block text-xs text-muted">
        الوصف (فرنسي)
        <textarea name="summary_fr" rows={4} dir="ltr" defaultValue={c?.summary_fr ?? ''} className="mt-1 w-full rounded-lg border border-line bg-surface p-3 text-sm outline-none focus:border-brand" />
      </label>
      <label className="block text-xs text-muted">
        المعتمدية
        <select name="delegation_id" defaultValue={c?.delegation_id ? String(c.delegation_id) : ''} className={`${inputCls} mt-1`}>
          <option value="">—</option>
          {delegations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2 rounded-xl border border-gold-light bg-gold-soft p-3 text-sm sm:col-span-2">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_given" defaultChecked={c?.consent_given} className="mt-1 size-4 accent-brand" />
          <span className="leading-6">
            <b>صاحب الحالة وافق على عرضها.</b> بلا موافقة ما تتنشرش، حتّى لو اخترت النشر.
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="anonymised" defaultChecked={c ? c.anonymised : true} className="size-4 accent-brand" />
          مجهّلة الهوية
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={c?.published} className="size-4 accent-brand" />
          انشرها في صفحة «حالات تحتاج مساندة»
        </label>
      </div>
      <div className="sm:col-span-2">
        <Submit>{c ? 'حفظ التعديل' : 'حفظ الحالة'}</Submit>
      </div>
    </form>
  )
}
