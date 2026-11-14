import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db, getDelegations } from '@/lib/supabase/server'
import { isolateNumbers } from '@/lib/format'
import { publicStateOf } from '@/lib/public-state'
import { getDictionary } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'لوحة القيادة — اللَّبنة' }

const TYPE_AR: Record<string, string> = {
  build_on_land: 'بناء فوق أرض',
  land_and_house: 'أرض وبناء',
  apartment: 'شقّة',
  economic: 'سكن اقتصادي',
  rent_to_own: 'إيجار منتهٍ بالتمليك',
  renovation: 'ترميم أو توسعة',
  other: 'أخرى',
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

  const cards: { label: string; value: number; href: string; note?: string }[] = [
    {
      label: 'مطالب وصلت',
      value: requests.count ?? 0,
      href: '/admin',
      note: (demo.count ?? 0) > 0 ? `و${demo.count} تجربة ما تتعدّش` : undefined,
    },
    { label: 'عروض تستنّى الاعتماد', value: devisReview.count ?? 0, href: '/admin/approbations' },
    { label: 'ورشات في التنفيذ', value: chantiers.count ?? 0, href: '/admin/chantiers' },
    { label: 'تقارير تستنّى الاعتماد', value: reports.count ?? 0, href: '/admin/chantiers' },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <h1 className="display text-lg font-semibold">لوحة القيادة</h1>
      <p className="mt-1 text-sm text-muted">
        مرحباً {staff.fullName} — الأعداد من المطالب الحقيقية، والتجارب مستبعدة.
      </p>

      {/* ── العدّادات ── */}
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              className="flex h-full flex-col rounded border border-line bg-surface p-4 transition hover:border-line-strong"
            >
              <span className="text-xs leading-6 text-muted">{c.label}</span>
              <span className="num mt-1 text-3xl font-semibold">
                {isolateNumbers(String(c.value))}
              </span>
              {c.note && <span className="mt-1 text-xs text-faint">{c.note}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* ── آخر المطالب ── */}
        <section className="rounded border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">آخر المطالب</h2>
            <Link href="/admin" className="text-xs text-muted underline underline-offset-4">
              شوفهم الكلّ
            </Link>
          </div>

          {(recent.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm leading-7 text-muted">
              ما ثمّ مطلب حقيقي بعد. الموقع ما خرجش للناس، والتجارب ما تتعدّش.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-line p-2 text-start text-xs text-faint">المشروع</th>
                    <th className="border-b border-line p-2 text-start text-xs text-faint">المنطقة</th>
                    <th className="border-b border-line p-2 text-start text-xs text-faint">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent.data ?? []).map((r) => (
                    <tr key={String(r.id)}>
                      <td className="border-b border-line p-2">
                        <Link
                          href={`/admin/${r.id}`}
                          className="underline underline-offset-4"
                        >
                          {TYPE_AR[String(r.request_type)] ?? String(r.request_type)}
                        </Link>
                        <span className="num mt-0.5 block text-xs text-faint">
                          {isolateNumbers(String(r.ref_code))}
                        </span>
                      </td>
                      <td className="border-b border-line p-2 text-muted">
                        {delegName.get(String(r.delegation_id)) ?? '—'}
                      </td>
                      <td className="border-b border-line p-2">
                        <span className="rounded bg-surface-2 px-1.5 text-xs text-muted">
                          {dict.suivi.states[publicStateOf(String(r.status))] ?? String(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── المطالب حسب النوع ── */}
        <section className="rounded border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">المطالب حسب النوع</h2>
          <p className="mt-0.5 text-xs text-faint">معطيات داخلية</p>

          {bars.length === 0 ? (
            <p className="mt-3 text-sm text-muted">ما ثمّ معطيات بعد.</p>
          ) : (
            <ul className="mt-4 grid gap-2.5">
              {bars.map(([k, v]) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{TYPE_AR[k] ?? k}</span>
                  <span className="num text-xs text-muted">{isolateNumbers(String(v))}</span>
                  <span className="h-2 w-28 rounded bg-surface-2">
                    <span
                      className="block h-2 rounded bg-gold"
                      style={{ width: `${Math.round((v / maxBar) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
