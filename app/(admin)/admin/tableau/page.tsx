import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db, getDelegations } from '@/lib/supabase/server'
import { isolateNumbers } from '@/lib/format'
import { publicStateOf } from '@/lib/public-state'
import { getDictionary } from '@/lib/i18n'
import Icon, { type IconName } from '@/components/Icon'
import { requestTypeIcon, requestTypeName } from '@/lib/request-types'
import { ColumnChart, Panel, Pill, StatCard, type Tone } from '@/components/admin/Ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'لوحة القيادة — اللَّبنة' }



/** لون الشارة حسب الحالة — الذهبي لما ينتظرنا، والأخضر لما انتهى */
const STATE_TONE: Record<string, Tone> = {
  waiting: 'gold',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'gray',
}

/**
 * لوحة القيادة — أربعة أعداد وآخر المطالب.
 *
 * والأعداد **حقيقية**: التجارب موسومة وتُستبعَد. لوحةٌ تعدّ تجاربنا
 * طلباً تجعلنا نقرّر على عددٍ صنعناه بأيدينا. وما كان تجربةً يُقال
 * عددُه إلى جانبها بلا أن يُجمع معها.
 */
export default async function TableauPage() {
  const staff = await requirePermission('requests.read')
  const dict = getDictionary('ar')

  const [requests, demo, devisReview, chantiers, reports, recent, delegations] = await Promise.all([
    db.from('housing_requests').select('id', { count: 'exact', head: true }).eq('is_demo', false),
    db.from('housing_requests').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    db.from('devis').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
    db.from('chantiers').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    db.from('site_reports').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    db
      .from('housing_requests')
      .select('id, ref_code, request_type, delegation_id, status, created_at, is_demo')
      .eq('is_demo', false)
      .order('created_at', { ascending: false })
      .limit(6),
    getDelegations('SFX'),
  ])

  const { data: byType } = await db
    .from('housing_requests')
    .select('request_type')
    .eq('is_demo', false)

  const counts = new Map<string, number>()
  for (const r of byType ?? []) {
    const k = String(r.request_type ?? 'other')
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const bars = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxBar = Math.max(1, ...bars.map(([, v]) => v))

  const delegName = new Map(delegations.map((d) => [String(d.id), d.name_ar]))

  const cards: { label: string; value: number; href: string; icon: IconName; note?: string }[] = [
    {
      label: 'مطالب وصلت',
      value: requests.count ?? 0,
      href: '/admin',
      icon: 'clipboard',
      note: (demo.count ?? 0) > 0 ? `و${demo.count} تجربة ما تتعدّش` : undefined,
    },
    {
      label: 'عروض تستنّى الاعتماد',
      value: devisReview.count ?? 0,
      href: '/admin/approbations',
      icon: 'file',
    },
    {
      label: 'ورشات في التنفيذ',
      value: chantiers.count ?? 0,
      href: '/admin/chantiers',
      icon: 'helmet',
    },
    {
      label: 'تقارير تستنّى الاعتماد',
      value: reports.count ?? 0,
      href: '/admin/chantiers',
      icon: 'check-circle',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
      <p className="text-sm text-muted">
        مرحباً {staff.fullName} — الأعداد من المطالب الحقيقية، والتجارب مستبعدة.
      </p>

      {/* ── العدّادات ── */}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <StatCard
              label={c.label}
              value={c.value}
              icon={c.icon}
              href={c.href}
              note={c.note}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* ── آخر المطالب ── */}
        <Panel
          title="آخر المطالب"
          icon="clipboard"
          action={
            <Link
              href="/admin"
              className="shrink-0 text-xs text-muted underline underline-offset-4 hover:text-brand"
            >
              شوفهم الكلّ ←
            </Link>
          }
        >
          {(recent.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-muted">
              ما ثمّ مطلب حقيقي بعد. الموقع ما خرجش للناس، والتجارب ما تتعدّش.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-sm">
                <thead>
                  <tr className="bg-ground">
                    <th className="rounded-s-lg p-2.5 text-start text-[11px] font-medium text-muted">
                      المشروع
                    </th>
                    <th className="p-2.5 text-start text-[11px] font-medium text-muted">المنطقة</th>
                    <th className="p-2.5 text-start text-[11px] font-medium text-muted">المرجع</th>
                    <th className="rounded-e-lg p-2.5 text-start text-[11px] font-medium text-muted">
                      الحالة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(recent.data ?? []).map((r) => {
                    const state = publicStateOf(String(r.status))
                    return (
                      <tr key={String(r.id)} className="border-b border-line last:border-0">
                        <td className="p-2.5">
                          <Link
                            href={`/admin/${r.id}`}
                            className="flex items-center gap-2 font-medium hover:text-brand"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
                              <Icon
                                name={requestTypeIcon(String(r.request_type))}
                                className="h-4 w-4"
                              />
                            </span>
                            <span className="truncate">
                              {requestTypeName(String(r.request_type))}
                            </span>
                          </Link>
                        </td>
                        <td className="p-2.5 text-muted">
                          {delegName.get(String(r.delegation_id)) ?? '—'}
                        </td>
                        <td className="num p-2.5 text-xs text-faint">
                          {isolateNumbers(String(r.ref_code))}
                        </td>
                        <td className="p-2.5">
                          <Pill tone={STATE_TONE[state] ?? 'gray'}>
                            {dict.suivi.states[state] ?? String(r.status)}
                          </Pill>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── المطالب حسب النوع ── */}
        <Panel
          title="المطالب حسب النوع"
          icon="chart"
          note="معطيات داخلية — التجارب مستبعدة"
        >
          {bars.length === 0 ? (
            <p className="mt-3 text-sm text-muted">ما ثمّ معطيات بعد.</p>
          ) : (
            <ColumnChart
              data={bars.map(([k, v]) => ({ label: requestTypeName(k), value: v }))}
            />
          )}
        </Panel>
      </div>
    </div>
  )
}
