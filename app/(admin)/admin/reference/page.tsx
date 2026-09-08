import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth'
import { db, getBuildTiers, getFinanceContext, getFinancingProducts } from '@/lib/supabase/server'
import { formatNumber, formatRange } from '@/lib/format'
import ImadaImport from '@/components/ImadaImport'
import AssessmentConfigForm from '@/components/AssessmentConfigForm'
import { loadAssessmentConfig } from '@/lib/actions/assessment'

export const metadata = { title: 'المعطيات المرجعية — اللَّبنة' }
export const dynamic = 'force-dynamic'

export default async function ReferencePage() {
  await requirePermission('reference.manage')
  const assessmentConfig = await loadAssessmentConfig()

  const [finance, build, products, { data: delegs }, { data: imadas }, { data: prices }] =
    await Promise.all([
      getFinanceContext(),
      getBuildTiers('SFX'),
      getFinancingProducts(),
      db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX').order('id'),
      db.from('imadas').select('id, delegation_id'),
      db
        .from('price_references')
        .select('product, zone, tier, price_per_m2_tnd, price_min_tnd, price_max_tnd, source')
        .eq('gov_code', 'SFX')
        .order('product'),
    ])

  const imadaCount = new Map<number, number>()
  for (const i of imadas ?? []) imadaCount.set(i.delegation_id, (imadaCount.get(i.delegation_id) ?? 0) + 1)
  const totalImadas = (imadas ?? []).length

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← رجوع للوحة القيادة
      </Link>
      <h1 className="display mt-3 text-2xl font-semibold">المعطيات المرجعية للمشروع</h1>
      <p className="mt-2 max-w-2xl text-muted">
        الفرضيات والأسعار اللي تشتغل بيها المنصة. كل شي مخزّن في قاعدة البيانات ويتبدّل بلا ما
        يتعاود نشر الكود.
      </p>

      {/* الفرضيات البنكية */}
      <Section title="الفرضيات البنكية والمالية">
        <div className="rounded border border-line bg-gold-soft p-5 text-sm leading-8">
          {finance.bankTermsNote}
        </div>
        <p className="mt-4 text-sm leading-7 text-muted">
          لذلك المنصة ما تعرضش أيّ نسبة كأنها شرط بنكي. المحاكي يشتغل بفرضيات يضبطها المستعمل،
          والتنقيط يستعمل فرضيات داخلية موحّدة <b>غرضها الوحيد ترتيب المطالب فيما بينها</b>:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Kv k="نسبة سنوية" v={`${finance.assumptions.annualRatePct}%`} />
          <Kv k="سقف الاستدانة" v={`${finance.assumptions.maxDtiPct}%`} />
          <Kv k="المدّة" v={`${finance.assumptions.maxYears} سنة`} />
          <Kv k="مصاريف إضافية" v={`${finance.assumptions.registrationFeesPct}%`} />
        </div>
        <p className="mt-3 text-xs text-faint">
          تتبدّل من جدول <code className="text-xs">app_settings</code> (المفاتيح{' '}
          <code className="text-xs">scoring.assumed_*</code>).
        </p>
      </Section>

      {/* صيغ التمويل */}
      <Section title="صيغ التمويل المرجعية">
        <div className="overflow-x-auto rounded border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-surface-2">
                <Th>البنك</Th>
                <Th>الصيغة</Th>
                <Th>الموجّهة لـ</Th>
                <Th>أقصى نسبة</Th>
                <Th>أقصى مدّة</Th>
                <Th>التثبّت</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3">{p.bank}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.purpose && <div className="text-xs text-muted">{p.purpose}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {p.target === 'individual' ? 'الأفراد' : 'المهنيين'}
                  </td>
                  <td className="num px-4 py-3">
                    {p.max_share_pct != null ? `${p.max_share_pct}%` : '—'}
                  </td>
                  <td className="num px-4 py-3">
                    {p.max_years != null ? `${p.max_years} سنة` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.verified_at ? (
                      <span className="num text-xs text-brand">{p.verified_at}</span>
                    ) : (
                      <span className="rounded bg-gold-soft px-2 py-0.5 text-xs text-gold">
                        في طور التثبّت
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* أسعار البناء */}
      <Section title="أسعار البناء (HT)">
        <div className="grid gap-3 sm:grid-cols-3">
          {build.tiers.map((t) => (
            <div key={t.tier} className="rounded border border-line bg-surface p-5">
              <div className="font-semibold">{t.label}</div>
              <div className="num mt-1 text-lg text-brand">
                <bdi dir="ltr">{formatRange(t.min, t.max)}</bdi> د/م²
              </div>
              <div className="mt-2 text-xs text-muted">مرجعي: {formatNumber(t.price)}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          السعر المرجعي للدراسات:{' '}
          <span className="num font-medium">{formatNumber(build.referencePrice)} د/م² HT</span>{' '}
          · دراسة الحساسية:{' '}
          <span className="num">
            {formatNumber(build.sensitivity.min)} –{' '}
            {formatNumber(build.sensitivity.max)}
          </span>
        </p>

        {/* أسعار ناقصة */}
        <div className="mt-5 overflow-x-auto rounded border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-surface-2">
                <Th>المنتج</Th>
                <Th>النطاق</Th>
                <Th>المستوى</Th>
                <Th>السعر د/م²</Th>
              </tr>
            </thead>
            <tbody>
              {(prices ?? []).map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-4 py-2.5">{PRODUCT_AR[p.product] ?? p.product}</td>
                  <td className="px-4 py-2.5">{ZONE_AR[p.zone ?? ''] ?? '—'}</td>
                  <td className="px-4 py-2.5">{TIER_AR[p.tier ?? ''] ?? '—'}</td>
                  <td className="num px-4 py-2.5">
                    {p.price_per_m2_tnd ? (
                      formatNumber(Number(p.price_per_m2_tnd))
                    ) : (
                      <span className="text-gold">غير معبّأ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* الجغرافيا */}
      <Section title="الجغرافيا: ولاية ← معتمدية ← عمادة">
        <p className="text-sm leading-7 text-muted">
          صفاقس: <b>{(delegs ?? []).length} معتمدية</b> · <b>{totalImadas} عمادة</b> مسجّلة.
          العمادات تتلصّق من قائمة وزارة الداخلية — المنصة ما تخترعش أسماء.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(delegs ?? []).map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded border border-line bg-surface px-3 py-2 text-sm"
            >
              <span>{d.name_ar}</span>
              <span
                className={`num text-xs ${
                  imadaCount.get(d.id) ? 'text-brand' : 'text-faint'
                }`}
              >
                {imadaCount.get(d.id) ?? 0}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <ImadaImport />
        </div>
      </Section>

      {/* دراسة طلب المساندة — الأوزان والحدود */}
      <section className="mt-10 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">دراسة طلب المساندة: الأوزان وحدود الفئات</h2>
        <p className="mt-1 max-w-3xl text-xs leading-6 text-muted">
          ستّة معايير يقيّمها المستشار 0→3 بوصف مكتوب. الوزن يقول قدّاش يحسب كلّ معيار في
          المجموع من 100. الحدود تقسم المجموع إلى أولوية · مؤهّل · للمراجعة · غير مؤهّل. حاجز
          الصحّة (لا أولوية بلا تثبّت) ثابت في المحرّك ولا يُعدَّل من هنا — هو قاعدة لا إعداد.
        </p>
        <AssessmentConfigForm weights={assessmentConfig.weights} thresholds={assessmentConfig.thresholds} />
      </section>
    </div>
  )
}

const PRODUCT_AR: Record<string, string> = {
  land: 'أرض',
  construction: 'بناء',
  apartment: 'شقة',
  house: 'دار',
}
const ZONE_AR: Record<string, string> = { city: 'المدينة', suburb: 'الضاحية', rural: 'الأرياف' }
const TIER_AR: Record<string, string> = {
  standard: 'عادي',
  mid: 'متوسّط',
  premium: 'Haut Standing',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-line pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <div className="text-xs text-muted">{k}</div>
      <div className="num mt-1 text-lg font-medium">{v}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}
