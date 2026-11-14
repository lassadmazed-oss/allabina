import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db, getDelegations } from '@/lib/supabase/server'
import {
  approveRegionRuleAction,
  deleteRegionRuleAction,
  saveRegionRuleAction,
  setRegionRulesEnabledAction,
} from '@/lib/actions/catalog'
import { ruleInForce, type RegionRule } from '@/lib/region-rules'
import { isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'قواعد المناطق — اللَّبنة' }

const AVAILABILITY = [
  ['', 'بلا تبديل'],
  ['in_stock', 'متوفّر'],
  ['on_order', 'على الطلب'],
  ['on_survey', 'بعد المعاينة'],
] as const

export default async function RegionsPage() {
  await requirePermission('reference.manage')

  const [{ data: rows }, delegations, { data: lots }, { data: setting }] = await Promise.all([
    db.from('region_rules').select('*').eq('gov_code', 'SFX').order('id', { ascending: false }),
    getDelegations('SFX'),
    db.from('lots').select('id, code, name_ar').eq('is_active', true).order('code'),
    db.from('app_settings').select('value').eq('key', 'catalog.region_rules_enabled').maybeSingle(),
  ])

  const enabled = setting?.value === true
  const delegName = new Map(delegations.map((d) => [Number(d.id), d.name_ar]))
  const lotName = new Map((lots ?? []).map((l) => [Number(l.id), `${l.code} · ${l.name_ar}`]))

  const rules = (rows ?? []).map((r) => ({
    raw: r,
    rule: {
      id: Number(r.id),
      govCode: String(r.gov_code),
      delegationId: r.delegation_id === null ? null : Number(r.delegation_id),
      lotId: r.lot_id === null ? null : Number(r.lot_id),
      transportPct: r.transport_pct === null ? null : Number(r.transport_pct),
      transportPerUnit: r.transport_per_unit === null ? null : Number(r.transport_per_unit),
      labourFactor: r.labour_factor === null ? null : Number(r.labour_factor),
      availability: (r.availability as RegionRule['availability']) ?? null,
      leadTimeDays: r.lead_time_days === null ? null : Number(r.lead_time_days),
      reasonAr: (r.reason_ar as string) ?? null,
      reasonFr: null,
      isApproved: Boolean(r.is_approved),
      effectiveFrom: (r.effective_from as string) ?? null,
    } satisfies RegionRule,
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin/bordereau" className="text-sm text-muted hover:text-brand">
        ← البوردرو
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">قواعد المناطق</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        النقل والتوفّر واليد العاملة حسب المعتمدية. <b>ما تتطبّق قاعدة حتّى تتعتمد ويحلّ تاريخ
        نفاذها</b> — الكرّاس يقول «لا نعرض تخفيضات أو توفر غير مؤكد». واللي يكتب القاعدة ما
        يعتمدهاش بنفس الضغطة.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-line bg-surface p-4">
        <span className="text-sm font-semibold">التطبيق على الأسعار المعروضة</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${enabled ? 'bg-[#e4f1ea] text-[#1d6b45]' : 'bg-surface-2 text-muted'}`}
        >
          {enabled ? 'مفعّل' : 'مغلق'}
        </span>
        <form action={setRegionRulesEnabledAction} className="ms-auto">
          <input type="hidden" name="on" value={enabled ? '0' : '1'} />
          <button type="submit" className="min-h-9 rounded border border-line px-3 text-sm">
            {enabled ? 'غلق' : 'تفعيل'}
          </button>
        </form>
      </div>

      {rules.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {rules.map(({ rule }) => {
            const live = ruleInForce(rule)
            return (
              <li key={rule.id} className="rounded border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    {rule.delegationId ? delegName.get(rule.delegationId) : 'كلّ الولاية'}
                  </span>
                  <span className="text-xs text-muted">
                    {rule.lotId ? lotName.get(rule.lotId) : 'كلّ اللوطات'}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      live
                        ? 'bg-[#e4f1ea] text-[#1d6b45]'
                        : rule.isApproved
                          ? 'bg-[#fbf0d8] text-[#8a5b05]'
                          : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {live ? 'سارية' : rule.isApproved ? 'معتمدة — ما حلّش نفاذها' : 'غير معتمدة'}
                  </span>
                  <span className="ms-auto flex gap-2">
                    <form action={approveRegionRuleAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="approve" value={rule.isApproved ? '0' : '1'} />
                      <button type="submit" className="text-xs underline underline-offset-4">
                        {rule.isApproved ? 'سحب الاعتماد' : 'اعتماد'}
                      </button>
                    </form>
                    <form action={deleteRegionRuleAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="text-xs text-[#a32a24] underline underline-offset-4">
                        حذف
                      </button>
                    </form>
                  </span>
                </div>
                <p className="num mt-1.5 text-xs text-muted" dir="ltr">
                  {[
                    rule.transportPct !== null ? `نقل ${rule.transportPct}%` : null,
                    rule.transportPerUnit !== null ? `نقل ${rule.transportPerUnit}/وحدة` : null,
                    rule.labourFactor !== null ? `يد عاملة ×${rule.labourFactor}` : null,
                    rule.availability ? `توفّر: ${rule.availability}` : null,
                    rule.leadTimeDays !== null ? `أجل ${rule.leadTimeDays} يوم` : null,
                    rule.effectiveFrom ? `من ${rule.effectiveFrom}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {rule.reasonAr && (
                  <p className="mt-1 text-xs text-gold">يُعرض للحريف: {rule.reasonAr}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form action={saveRegionRuleAction} className="mt-6 grid gap-4 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">قاعدة جديدة</h2>
        <input type="hidden" name="gov_code" value="SFX" />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">المعتمدية</span>
            <select name="delegation_id" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm">
              <option value="">كلّ الولاية</option>
              {delegations.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">اللوط</span>
            <select name="lot_id" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm">
              <option value="">كلّ اللوطات</option>
              {(lots ?? []).map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {String(l.code)} · {String(l.name_ar)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">نقل %</span>
            <input name="transport_pct" type="number" step="0.01" min="0" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">نقل للوحدة</span>
            <input name="transport_per_unit" type="number" step="0.001" min="0" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">معامل اليد العاملة</span>
            <input name="labour_factor" type="number" step="0.01" min="0.5" max="2" placeholder="1.00" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">التوفّر</span>
            <select name="availability" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm">
              {AVAILABILITY.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">أجل التوريد (يوم)</span>
            <input name="lead_time_days" type="number" min="0" max="365" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">تاريخ النفاذ</span>
            <input name="effective_from" type="date" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">السبب كما يراه الحريف</span>
          <input
            name="reason_ar"
            placeholder="زيادة نقل إلى جبنيانة"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-faint">
            يظهر تحت السعر. بلا سبب يرى الحريف رقماً تبدّل بلا تفسير.
          </span>
        </label>

        <button type="submit" className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white">
          احفظ — غير معتمدة
        </button>
      </form>

      <p className="mt-4 text-xs leading-7 text-faint">
        القاعدة الأضيق تفوز: معتمدية + لوط، ثمّ المعتمدية، ثمّ الولاية. ولا تُجمع قاعدتان —
        جمعهما يضاعف النقل بلا ما ينتبه حدّ. و
        <span className="num">{isolateNumbers(String(rules.length))}</span> قاعدة مكتوبة اليوم.
      </p>
    </div>
  )
}
