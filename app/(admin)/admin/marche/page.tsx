import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { getDelegations } from '@/lib/supabase/server'
import { snapshot, type Dimension } from '@/lib/analytics-server'
import {
  AREA_BUCKETS,
  BUDGET_BUCKETS,
  EVENT_AR,
  FUNNEL,
  MIN_SAMPLE,
  PERIODS,
  funnelOf,
  ratioReliable,
  type PeriodKey,
} from '@/lib/analytics'
import { isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الطلب الحقيقي — اللَّبنة' }

const DIM_LABEL: Record<Dimension, string> = {
  gov_code: 'الولاية',
  delegation_id: 'المعتمدية',
  project_type: 'نوع المشروع',
  area_bucket: 'المساحة',
  budget_bucket: 'نطاق الميزانية',
  standing: 'التشطيب',
  readiness: 'الجاهزية',
}

const PROJECT_AR: Record<string, string> = {
  build_on_land: 'بناء فوق أرض',
  land_and_house: 'أرض وبناء',
  apartment: 'شقّة',
  economic: 'سكن اقتصادي',
  rent_to_own: 'إيجار منتهٍ بالتمليك',
  renovation: 'ترميم أو توسعة',
  other: 'أخرى',
}

const READINESS_AR: Record<string, string> = {
  planning: 'في التخطيط',
  within_year: 'خلال سنة',
  urgent: 'مستعجل',
  critical: 'حرج',
}

export default async function MarchePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  await requirePermission('requests.export')
  const sp = await searchParams
  const period: PeriodKey = (PERIODS.find((x) => x.key === sp.p)?.key ?? '30d') as PeriodKey
  const periodLabel = PERIODS.find((x) => x.key === period)!.label

  const stepEvent = Object.fromEntries(FUNNEL.map((s) => [s.key, s.event]))
  const [snap, delegations] = await Promise.all([snapshot(period, stepEvent), getDelegations('SFX')])
  const delegName = new Map(delegations.map((d) => [String(d.id), d.name_ar]))

  const rows = funnelOf(snap.people)

  const labelFor = (d: Dimension, key: string) =>
    d === 'delegation_id'
      ? (delegName.get(key) ?? key)
      : d === 'project_type'
        ? (PROJECT_AR[key] ?? key)
        : d === 'readiness'
          ? (READINESS_AR[key] ?? key)
          : key

  const order = (d: Dimension, keys: string[]) => {
    if (d === 'area_bucket') return [...keys].sort((a, b) => AREA_BUCKETS.indexOf(a as never) - AREA_BUCKETS.indexOf(b as never))
    if (d === 'budget_bucket') return [...keys].sort((a, b) => BUDGET_BUCKETS.indexOf(a as never) - BUDGET_BUCKETS.indexOf(b as never))
    return keys
  }

  const maxPeople = Math.max(1, ...rows.map((r) => r.value))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">الطلب الحقيقي</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        <b>كلّ نسبة هنا تحمل مقامها وفترتها.</b> «تحويل 12%» بلا مقام رقمٌ لا يُراجَع: من ماذا؟
        وفي أيّ مدّة؟ والعدّ أشخاصٌ فريدون لا أحداث — مئة تقدير ليست مئة شخص.
      </p>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/marche?p=${p.key}`}
            className={`rounded-full border px-3 py-1.5 ${
              p.key === period ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {/* ── القُمع ── */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold">
          القُمع — <span className="font-normal text-muted">{periodLabel}</span>
        </h2>
        <ul className="mt-3 grid gap-2">
          {rows.map((r) => {
            const reliable = ratioReliable(r.ofValue)
            return (
              <li key={r.step.key} className="rounded border border-line bg-surface p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{r.step.label}</span>
                  <span className="num text-lg font-semibold">{isolateNumbers(String(r.value))}</span>
                  <span className="text-xs text-faint">شخصاً</span>

                  {r.ofKey && (
                    <span className="ms-auto text-xs text-muted">
                      {r.pct !== null && reliable ? (
                        <>
                          <b className="num text-ink">{isolateNumbers(r.pct.toFixed(1))}%</b>{' '}
                        </>
                      ) : null}
                      من «{FUNNEL.find((s) => s.key === r.ofKey)?.label}» ={' '}
                      <span className="num">{isolateNumbers(String(r.ofValue ?? 0))}</span>
                      {r.dropped !== null && r.dropped > 0 && (
                        <>
                          {' · '}انقطع <span className="num">{isolateNumbers(String(r.dropped))}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-2 h-1.5 rounded bg-surface-2">
                  <div
                    className="h-1.5 rounded bg-brand"
                    style={{ width: `${Math.round((r.value / maxPeople) * 100)}%` }}
                  />
                </div>

                {r.ofKey && !reliable && (
                  <p className="mt-1.5 text-xs text-faint">
                    العيّنة تحت <span className="num">{isolateNumbers(String(MIN_SAMPLE))}</span> —
                    نعرضو الأعداد بلا نسبة. «3 من 4 = 75%» رقم ما يتحمّلش قرار.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── أشخاص مقابل أحداث ── */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">أشخاص مقابل نسخ</h2>
        <p className="mt-1 text-xs leading-7 text-muted">
          العمود الأوّل أشخاص فريدون، والثاني عدد المرّات. الفرق بينهما هو الفرق بين «مئة شخص
          قدّروا» و«مئة تقدير».
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[22rem] border-collapse bg-surface text-sm">
            <thead>
              <tr>
                <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">الحدث</th>
                <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">أشخاص</th>
                <th className="border-b border-line bg-bg p-2.5 text-start text-xs text-faint">مرّات</th>
              </tr>
            </thead>
            <tbody>
              {FUNNEL.map((s) => (
                <tr key={s.key}>
                  <td className="border-b border-line p-2.5">{EVENT_AR[s.event]}</td>
                  <td className="num border-b border-line p-2.5">
                    {isolateNumbers(String(snap.people[s.key] ?? 0))}
                  </td>
                  <td className="num border-b border-line p-2.5 text-muted">
                    {isolateNumbers(String(snap.events[s.key] ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── التوزيعات ── */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold">التوزيعات</h2>
        <p className="mt-1 text-xs leading-7 text-muted">
          من <b>طلبات المراجعة والقبول والعقود</b> وحدها — «الطلب الاستكشافي لا يساوي طلب شراء»،
          وتوزيع تصفّحٍ على المناطق يضخّم الأقرب لا الأجدّ.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(Object.keys(DIM_LABEL) as Dimension[]).map((d) => {
            const list = snap.breakdowns[d]
            const total = list.reduce((s, x) => s + x.count, 0)
            return (
              <div key={d} className="rounded border border-line bg-surface p-3">
                <h3 className="text-xs font-semibold text-faint">{DIM_LABEL[d]}</h3>
                {list.length === 0 ? (
                  <p className="mt-2 text-xs text-faint">لا معطيات في هذي الفترة.</p>
                ) : (
                  <ul className="mt-2 grid gap-1.5">
                    {order(d, list.map((x) => x.key)).map((key) => {
                      const item = list.find((x) => x.key === key)!
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 truncate">{labelFor(d, key)}</span>
                          <span className="num text-xs text-muted">
                            {isolateNumbers(String(item.count))}
                          </span>
                          <span className="h-1.5 w-16 rounded bg-surface-2">
                            <span
                              className="block h-1.5 rounded bg-gold"
                              style={{ width: `${Math.round((item.count / Math.max(1, total)) * 100)}%` }}
                            />
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <p className="mt-8 text-xs leading-7 text-faint">
        جدول القياس لا يحمل اسماً ولا هاتفاً ولا دخلاً: المساحة والميزانية فئتان لا قيمتان، ولا
        مزوّد خارجي — الأحداث تبقى في قاعدتنا. قُرئ{' '}
        <span className="num">{isolateNumbers(String(snap.rows))}</span> سطراً
        {snap.capped && ' (بلغ السقف — الفترة أطول من المعروض)'}.
      </p>
    </div>
  )
}
