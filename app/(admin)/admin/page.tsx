import { Suspense } from 'react'
import { formatPercent } from '@/lib/format'
import { checkSmsBalance } from '@/lib/sms/winsms'
import { smsEnvAllows } from '@/lib/sms'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { db } from '@/lib/supabase/server'
import { LABELS } from '@/lib/schema'
import { formatTND } from '@/lib/finance'
import { updateStatusAction } from '@/lib/actions/admin'

export const metadata = { title: 'لوحة القيادة — اللَّبنة' }
export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'contacted', 'qualified', 'matched', 'appointment', 'contract', 'on_hold', 'rejected']

/** لون كلّ حالة: الجديد كحلي، قيد المعالجة ذهبي، المتقدّم أخضر، الموقوف رمادي، المرفوض أحمر */
const STATUS_CLS: Record<string, string> = {
  new: 'bg-brand-soft text-brand',
  contacted: 'bg-gold-soft text-gold',
  qualified: 'bg-[#e6f0e9] text-[#1f6b3f]',
  matched: 'bg-[#e6f0e9] text-[#1f6b3f]',
  appointment: 'bg-[#ece7f6] text-[#4b3a8a]',
  contract: 'bg-brand text-white',
  on_hold: 'bg-surface-2 text-muted',
  rejected: 'bg-[#fbeeeb] text-[#8c2f22]',
}

type Row = {
  id: string
  ref_code: string
  full_name: string
  phone: string
  gov_code: string
  delegation_id: number | null
  request_type: string
  desired_area_m2: number | null
  status: string
  created_at: string
  next_action: string | null
}

type Search = { status?: string; band?: string; gov?: string; q?: string; type?: string }

/** رابط اللوحة بنفس الفلاتر مع تبديل مفتاح واحد — حتى لا يضيع البحث حين نبدّل الحالة */
function hrefWith(sp: Search, patch: Partial<Search>): string {
  const next: Search = { ...sp, ...patch }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v)
  const qs = params.toString()
  return qs ? `/admin?${qs}` : '/admin'
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireStaff()
  const canEdit = can(me.role, 'requests.update')

  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 60)

  let query = db
    .from('housing_requests')
    .select(
      'id, ref_code, full_name, phone, gov_code, delegation_id, request_type, desired_area_m2, status, created_at, next_action'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (sp.status) query = query.eq('status', sp.status)
  if (sp.gov) query = query.eq('gov_code', sp.gov)
  if (sp.type) query = query.eq('request_type', sp.type)
  if (q) {
    // بحث بالاسم أو الهاتف أو الرمز — الفواصل والأقواس والنسبة تُحذف لأنّها من نحو or()
    const safe = q.replace(/[,()%]/g, ' ').trim()
    if (safe) query = query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,ref_code.ilike.%${safe}%`)
  }

  const { data: requestsRaw } = await query
  const requests = (requestsRaw ?? []) as Row[]

  const smsBalancePromise = checkSmsBalance()

  /**
   * نقيس الحاجزين هنا لا داخل المكوّن: القراءة من القاعدة وقراءة
   * البيئة كلتاهما خادمية، والمكوّن يعرض ما نعطيه.
   */
  const { data: smsFlag } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'sms.enabled')
    .maybeSingle()
  const smsOff = !smsEnvAllows({
    SMS_ENABLED: process.env.SMS_ENABLED,
    VERCEL_ENV: process.env.VERCEL_ENV,
  })
    ? 'الإرسال مغلق خارج الإنتاج (SMS_ENABLED في متغيّرات البيئة)'
    : smsFlag?.value === false
      ? 'المفتاح sms.enabled مطفأ في «المعطيات المرجعية»'
      : null
  const [{ data: delegs }, { data: openItems }, { data: dueActions }] = await Promise.all([
    db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX'),
    db.from('request_interactions').select('id, request_id, kind, body').eq('resolved', false),
    db
      .from('housing_requests')
      .select('id, ref_code, full_name, next_action, next_action_at')
      .not('next_action', 'is', null)
      .order('next_action_at', { ascending: true })
      .limit(8),
  ])
  const delegName = new Map((delegs ?? []).map((d) => [d.id, d.name_ar]))
  // استفسارات مفتوحة لكلّ مطلب: تظهر على البطاقة حتى لا تُنسى
  const openByRequest = new Map<string, number>()
  for (const it of openItems ?? []) openByRequest.set(it.request_id, (openByRequest.get(it.request_id) ?? 0) + 1)

  const { data: scoresRaw } = await db
    .from('scores')
    .select('request_id, total, band, max_budget_tnd, computed_at')
    .order('computed_at', { ascending: false })

  const scoreByRequest = new Map<string, { total: number; band: string; max_budget_tnd: number }>()
  for (const s of scoresRaw ?? []) {
    if (!scoreByRequest.has(s.request_id)) {
      scoreByRequest.set(s.request_id, {
        total: s.total,
        band: s.band,
        max_budget_tnd: Number(s.max_budget_tnd ?? 0),
      })
    }
  }

  const rows = requests.filter((r) => !sp.band || scoreByRequest.get(r.id)?.band === sp.band)

  // المؤشرات
  const today = new Date().toISOString().slice(0, 10)
  const countToday = requests.filter((r) => r.created_at.startsWith(today)).length
  const bands = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>
  let budgetSum = 0
  let budgetCount = 0
  for (const r of requests) {
    const s = scoreByRequest.get(r.id)
    if (s) {
      bands[s.band] = (bands[s.band] ?? 0) + 1
      if (s.max_budget_tnd > 0) {
        budgetSum += s.max_budget_tnd
        budgetCount++
      }
    }
  }
  const qualityPct = requests.length
    ? Math.round(((bands.A + bands.B) / requests.length) * 100)
    : 0

  const byGov = new Map<string, number>()
  for (const r of requests) byGov.set(r.gov_code, (byGov.get(r.gov_code) ?? 0) + 1)
  const topGovs = [...byGov.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const byDelegation = new Map<string, number>()
  for (const r of requests) {
    if (r.gov_code !== 'SFX') continue
    const name = r.delegation_id ? delegName.get(r.delegation_id) ?? 'غير محدّدة' : 'غير محدّدة'
    byDelegation.set(name, (byDelegation.get(name) ?? 0) + 1)
  }
  const topDelegations = [...byDelegation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  // أنواع الطلب الموجودة فعلاً — فلتر بحسب ما في القاعدة لا بحسب القاموس كلّه
  const typeCounts = new Map<string, number>()
  for (const r of requests) typeCounts.set(r.request_type, (typeCounts.get(r.request_type) ?? 0) + 1)
  const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])

  const now = Date.now()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-lg font-semibold">لوحة القيادة</h1>
          <p className="mt-1 text-sm text-muted">
            {requests.length} مطلب · {countToday} اليوم
          </p>
        </div>
      </div>

      {/* المؤشرات */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="مجموع المطالب" value={String(requests.length)} />
        <Kpi label="نسبة الأصناف A و B" value={formatPercent(qualityPct)} />
        <Kpi
          label="معدّل الميزانية التقديرية"
          value={budgetCount ? formatTND(budgetSum / budgetCount) : '—'}
        />
        <Kpi label="استفسارات مفتوحة" value={String((openItems ?? []).length)} />
      </div>

      {/* رصيد الرسائل نداء خارجي بمهلة 6 ثوانٍ: يُبثّ ولا يحبس اللوحة */}
      <Suspense
        fallback={
          <p className="mt-3 rounded border border-line bg-surface px-3 py-2 text-xs text-faint">
            رصيد الرسائل القصيرة…
          </p>
        }
      >
        <SmsBalance promise={smsBalancePromise} sendingOff={smsOff} />
      </Suspense>

      {topGovs.length > 0 && (
        <div className="mt-4 rounded border border-line bg-surface p-4">
          <div className="text-sm font-medium">الطلب حسب الولاية</div>
          <div className="mt-4 space-y-2">
            {topGovs.map(([gov, n]) => (
              <div key={gov} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-muted">{gov}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${(n / Math.max(...topGovs.map((g) => g[1]))) * 100}%` }}
                  />
                </div>
                <span className="num w-8 text-left text-muted">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {topDelegations.length > 0 && (
          <div className="rounded border border-line bg-surface p-4">
            <div className="text-sm font-medium">الطلب حسب معتمديات صفاقس</div>
            <div className="mt-4 space-y-2">
              {topDelegations.map(([name, n]) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate text-muted">{name}</span>
                  <div className="h-2 flex-1 rounded-full bg-surface-2">
                    <div
                      className="h-2 rounded-full bg-gold-light"
                      style={{
                        width: `${(n / Math.max(...topDelegations.map((d) => d[1]))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="num w-8 text-left text-muted">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(dueActions ?? []).length > 0 && (
          <div className="rounded border border-line bg-surface p-4">
            <div className="text-sm font-medium">إجراءات في انتظار التنفيذ</div>
            <ul className="mt-4 space-y-2 text-sm">
              {(dueActions ?? []).map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3">
                  <Link href={`/admin/${a.id}`} className="truncate text-brand hover:underline">
                    {a.full_name}: {a.next_action}
                  </Link>
                  <span className="num shrink-0 text-xs text-faint">
                    {a.next_action_at ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* البحث والفلاتر: بحث حرّ بالاسم أو الهاتف أو الرمز، ثمّ الصنف والحالة والنوع */}
      <div className="mt-6 rounded-xl border border-line bg-surface p-4">
        <form action="/admin" method="get" className="flex flex-wrap items-center gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.band && <input type="hidden" name="band" value={sp.band} />}
          {sp.gov && <input type="hidden" name="gov" value={sp.gov} />}
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">بحث</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 my-auto text-faint"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="ابحث بالاسم أو الهاتف أو الرمز…"
              className="h-11 w-full rounded-lg border border-line bg-ground ps-10 pe-3 text-sm outline-none transition focus:border-brand focus:bg-surface"
            />
          </label>
          <button className="h-11 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-deep">
            بحث
          </button>
          {q && (
            <Link href={hrefWith(sp, { q: '' })} className="h-11 rounded-lg border border-line px-3 text-sm leading-[2.7rem] text-muted hover:border-brand hover:text-brand">
              مسح
            </Link>
          )}
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="me-1 text-xs text-faint">الصنف</span>
          <Filter active={!sp.band} href={hrefWith(sp, { band: '' })} label="الكلّ" />
          {['A', 'B', 'C', 'D'].map((b) => (
            <Filter key={b} active={sp.band === b} href={hrefWith(sp, { band: b })} label={`${b} · ${bands[b] ?? 0}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="me-1 text-xs text-faint">الحالة</span>
          <Filter active={!sp.status} href={hrefWith(sp, { status: '' })} label="الكلّ" />
          {STATUSES.map((s) => (
            <Filter key={s} active={sp.status === s} href={hrefWith(sp, { status: s })} label={LABELS.status[s]} />
          ))}
        </div>
        {types.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="me-1 text-xs text-faint">النوع</span>
            <Filter active={!sp.type} href={hrefWith(sp, { type: '' })} label="الكلّ" />
            {types.map(([t, n]) => (
              <Filter
                key={t}
                active={sp.type === t}
                href={hrefWith(sp, { type: t })}
                label={`${LABELS.requestType[t] ?? t} · ${n}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* البطاقات: كلّ مطلب مربّع يُقرأ بنظرة — من هو، أين، ماذا يريد، وقدّاش يقدر، وشنوّة الخطوة الجاية */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted">
          <b className="num text-ink">{rows.length}</b> مطلب
          {q && (
            <>
              {' '}
              يطابق «<span className="text-ink">{q}</span>»
            </>
          )}
        </p>
        <p className="text-xs text-faint">الأحدث أوّلاً</p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line bg-surface p-10 text-center text-muted">
          ما فمّا حتّى مطلب بهالفلاتر.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const s = scoreByRequest.get(r.id)
            const ageDays = Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000)
            // مطلب جديد ما اتّصل به أحد منذ يومين: يستحقّ تنبيهاً
            const stale = r.status === 'new' && ageDays >= 2
            const open = openByRequest.get(r.id) ?? 0
            const deleg = r.delegation_id ? delegName.get(r.delegation_id) ?? null : null
            return (
              <article
                key={r.id}
                className={`flex flex-col rounded-xl border bg-surface p-4 shadow-sm transition hover:border-brand/60 hover:shadow-md ${
                  stale ? 'border-gold/60' : 'border-line'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/${r.id}`} className="num text-xs text-brand hover:underline" dir="ltr">
                    {r.ref_code}
                  </Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? 'bg-surface-2 text-muted'}`}>
                    {LABELS.status[r.status] ?? r.status}
                  </span>
                </div>

                <Link href={`/admin/${r.id}`} className="mt-2 block">
                  <div className="display text-base font-semibold leading-snug text-ink">{r.full_name}</div>
                </Link>
                <a href={`tel:${r.phone}`} className="num mt-0.5 inline-block text-sm text-muted hover:text-brand" dir="ltr">
                  {r.phone}
                </a>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>{r.gov_code === 'SFX' ? 'صفاقس' : r.gov_code}</span>
                  {deleg && (
                    <>
                      <span className="text-faint">·</span>
                      <span>{deleg}</span>
                    </>
                  )}
                  <span className="text-faint">·</span>
                  <span className="text-ink-soft">{LABELS.requestType[r.request_type] ?? r.request_type}</span>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-ground p-2 text-center">
                  <div>
                    <dt className="text-[11px] text-faint">المساحة</dt>
                    <dd className="num mt-0.5 text-sm font-semibold text-ink">
                      {r.desired_area_m2 ? `${r.desired_area_m2} م²` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-faint">التنقيط</dt>
                    <dd className="mt-0.5">
                      {s ? (
                        <span className={`num inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${bandCls(s.band)}`}>
                          {s.band} · {s.total}
                        </span>
                      ) : (
                        <span className="text-sm text-faint">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-faint">الميزانية</dt>
                    <dd className="num mt-0.5 text-sm font-semibold text-ink">
                      {s?.max_budget_tnd ? formatTND(s.max_budget_tnd) : '—'}
                    </dd>
                  </div>
                </dl>

                {(r.next_action || open > 0 || stale) && (
                  <div className="mt-3 space-y-1 text-xs">
                    {r.next_action && (
                      <div className="flex items-start gap-1.5 text-ink-soft">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                        <span className="line-clamp-2">{r.next_action}</span>
                      </div>
                    )}
                    {open > 0 && (
                      <div className="flex items-center gap-1.5 text-gold">
                        <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                        <span>
                          <b className="num">{open}</b> استفسار مفتوح
                        </span>
                      </div>
                    )}
                    {stale && (
                      <div className="flex items-center gap-1.5 text-gold">
                        <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                        <span>
                          جديد منذ <b className="num">{ageDays}</b> أيام بلا اتّصال
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="num text-xs text-faint">
                    {new Date(r.created_at).toLocaleDateString('fr-TN')}
                    {ageDays === 0 ? ' · اليوم' : ageDays === 1 ? ' · أمس' : ` · منذ ${ageDays} يوم`}
                  </span>
                  <Link
                    href={`/admin/${r.id}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-brand transition hover:border-brand hover:bg-brand-soft"
                  >
                    افتح الملفّ
                  </Link>
                </div>

                {canEdit && (
                  <form action={updateStatusAction} className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <select
                      name="status"
                      defaultValue={r.status}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs"
                    >
                      {STATUSES.map((s2) => (
                        <option key={s2} value={s2}>
                          {LABELS.status[s2]}
                        </option>
                      ))}
                    </select>
                    <button className="h-9 rounded-lg border border-line px-3 text-xs hover:border-brand hover:text-brand">
                      حفظ
                    </button>
                  </form>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function bandCls(band: string) {
  return {
    A: 'bg-brand-soft text-brand',
    B: 'bg-[#e6f0e9] text-brand',
    C: 'bg-gold-soft text-gold',
    D: 'bg-surface-2 text-muted',
  }[band] ?? 'bg-surface-2 text-muted'
}

function Kpi({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 font-semibold text-ink ${small ? 'text-sm' : 'text-2xl'}`}>
        {value}
      </div>
    </div>
  )
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      {label}
    </Link>
  )
}

/**
 * رصيد WinSMS وحالة الإرسال.
 *
 * الرصيد وحده لا يكفي: الإرسال يمرّ بحاجزين قبله (البيئة، ومفتاح
 * `sms.enabled`). حاجز مغلق يعني أنّ رسائل التأكيد كلّها تُسجَّل
 * «لم تُرسل» — والفريق كان لازم يفتح مطلباً واحداً واحداً حتى يكتشف
 * ذلك. السبب يظهر هنا، على أوّل شاشة.
 */
async function SmsBalance({
  promise,
  sendingOff,
}: {
  promise: Promise<{ balance: number; licence: string } | null>
  sendingOff: string | null
}) {
  const bal = await promise
  if (!bal) {
    return (
      <p className="mt-4 rounded border border-line bg-surface px-4 py-3 text-xs text-faint">
        رصيد الرسائل القصيرة: غير متاح الآن (المفتاح غير معرّف أو المزوّد لا يردّ).
      </p>
    )
  }
  const low = bal.balance < 100
  return (
    <>
      {sendingOff && (
        <p className="mt-4 rounded border border-[#e0b4ac] bg-[#fbeeeb] px-4 py-3 text-sm leading-7 text-[#8c2f22]">
          الإرسال موقوف — ما من رسالة تأكيد تخرج توّا. السبب: {sendingOff}
        </p>
      )}
    <div
      className={`mt-4 flex flex-wrap items-baseline justify-between gap-3 rounded border px-4 py-3 text-sm ${
        low ? 'border-gold/50 bg-gold-soft' : 'border-line bg-surface'
      }`}
    >
      <span>
        رسائل SMS (WinSMS · المُرسِل MAZED):{' '}
        <b className={`num ${low ? 'text-gold' : ''}`}>{bal.balance}</b> رسالة باقية
        {low && <span className="ms-2 text-gold">— الرصيد منخفض، أعد الشحن قبل ما تتوقّف رسائل التأكيد</span>}
      </span>
      <span className="num text-xs text-faint">الرخصة حتى {bal.licence}</span>
    </div>
    </>
  )
}
