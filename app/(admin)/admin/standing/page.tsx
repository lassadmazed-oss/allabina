import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db, getStandingLevels } from '@/lib/supabase/server'
import {
  equaliseSharesAction,
  updateLotSharesAction,
  upsertStandingLevelAction,
} from '@/lib/actions/standing'
import { lotBreakdown, sharesBalanced, shareTotal, type LotShare } from '@/lib/standing'
import { formatNumber } from '@/lib/format'

export const metadata = { title: 'مستويات التشطيب — اللَّبنة' }
export const dynamic = 'force-dynamic'

/** المشروع المرجعي الذي تُعرض عليه الأرقام — نفس معايرة البوردرو */
const REFERENCE_SURFACE = 120

type Lot = { code: number; name_ar: string }
type ShareRow = { standing_code: string; lot_code: number; share_pct: number }

export default async function StandingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>
}) {
  await requirePermission('reference.manage')
  const sp = await searchParams

  const [levels, { data: lotsRaw }, { data: sharesRaw }, { data: articleCounts }] =
    await Promise.all([
      getStandingLevels(),
      db.from('lots').select('code, name_ar').eq('is_active', true).order('code'),
      db.from('standing_lot_shares').select('standing_code, lot_code, share_pct'),
      db.from('articles').select('standing').eq('is_active', true),
    ])

  const lots = (lotsRaw ?? []) as Lot[]
  const shares = (sharesRaw ?? []) as ShareRow[]

  const articlesPerLevel = new Map<string, number>()
  for (const a of (articleCounts ?? []) as { standing: string | null }[]) {
    if (!a.standing) continue
    articlesPerLevel.set(a.standing, (articlesPerLevel.get(a.standing) ?? 0) + 1)
  }

  const selected = levels.find((l) => l.code === sp.level) ?? levels[0] ?? null

  const sharesOf = (code: string): LotShare[] =>
    lots.map((lot) => ({
      lotCode: lot.code,
      lotNameAr: lot.name_ar,
      sharePct:
        shares.find((s) => s.standing_code === code && s.lot_code === lot.code)?.share_pct ?? 0,
    }))

  const selectedShares = selected ? sharesOf(selected.code) : []
  const breakdown = selected
    ? lotBreakdown(selected.price, selectedShares, REFERENCE_SURFACE)
    : []
  const total = shareTotal(selectedShares)
  const balanced = sharesBalanced(selectedShares)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-2 text-2xl font-semibold">مستويات التشطيب</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        سعر المتر المربّع لكلّ مستوى، وتوزيعه على العشرين Lot.{' '}
        <b>تزيد مستوى جديد من هنا بلا مطوّر</b> — يظهر في استمارة المواطن مباشرةً. الأرقام تحت
        محسوبة على مشروع مرجعي <span className="num">{REFERENCE_SURFACE}</span> م².
      </p>

      {/* شريط المستويات */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-surface-2">
              <Th>الرمز</Th>
              <Th>التسمية</Th>
              <Th>د/م² HT</Th>
              <Th>النطاق</Th>
              <Th>مجموع النسب</Th>
              <Th>المقالات</Th>
              <Th>الكلفة على {REFERENCE_SURFACE} م²</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {levels.map((lv) => {
              const t = shareTotal(sharesOf(lv.code))
              const ok = Math.abs(t - 100) <= 0.05
              return (
                <tr
                  key={lv.code}
                  className={`border-t border-line ${
                    selected?.code === lv.code ? 'bg-brand-soft' : ''
                  }`}
                >
                  <td className="num px-4 py-3 font-medium">{lv.code}</td>
                  <td className="px-4 py-3">{lv.nameAr}</td>
                  <td className="num px-4 py-3">{formatNumber(lv.price)}</td>
                  <td className="num px-4 py-3 text-xs text-faint">
                    {formatNumber(lv.min)} – {formatNumber(lv.max)}
                  </td>
                  <td className="num px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        ok ? 'bg-brand-soft text-brand' : 'bg-gold-soft text-gold'
                      }`}
                    >
                      {t}%
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-xs text-muted">
                    {articlesPerLevel.get(lv.code) ?? 0}
                  </td>
                  <td className="num px-4 py-3">
                    {formatNumber(lv.price * REFERENCE_SURFACE)} د.ت
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/standing?level=${lv.code}`}
                      className="text-xs text-brand hover:underline"
                    >
                      عدّل ←
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* تحرير المستوى المختار */}
      {selected && (
        <section className="mt-10 rounded border border-line bg-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold">
            المستوى <span className="num">{selected.code}</span> — {selected.nameAr}
          </h2>

          <form action={upsertStandingLevelAction} className="mt-4 grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="code" value={selected.code} />
            <L label="التسمية (عربي)">
              <input name="name_ar" defaultValue={selected.nameAr} required className={inputCls} />
            </L>
            <L label="التسمية (فرنسي)">
              <input name="name_fr" defaultValue={selected.nameFr ?? ''} className={inputCls} />
            </L>
            <L label="الترتيب">
              <input
                name="sort_order"
                type="number"
                defaultValue={selected.sortOrder}
                className={`${inputCls} num`}
              />
            </L>
            <L label="السعر المرجعي د/م² HT">
              <input
                name="price_ht_m2"
                type="number"
                step="1"
                defaultValue={selected.price}
                required
                className={`${inputCls} num`}
              />
            </L>
            <L label="أدنى النطاق">
              <input
                name="price_min_ht"
                type="number"
                step="1"
                defaultValue={selected.min}
                className={`${inputCls} num`}
              />
            </L>
            <L label="أقصى النطاق">
              <input
                name="price_max_ht"
                type="number"
                step="1"
                defaultValue={selected.max}
                className={`${inputCls} num`}
              />
            </L>
            <L label="الوصف (عربي)" wide>
              <textarea
                name="description_ar"
                rows={2}
                defaultValue={selected.descriptionAr ?? ''}
                className={inputCls}
              />
            </L>
            <L label="الوصف (فرنسي)" wide>
              <textarea
                name="description_fr"
                rows={2}
                defaultValue={selected.descriptionFr ?? ''}
                className={inputCls}
              />
            </L>
            <div className="sm:col-span-3">
              <button className="rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep">
                حفظ المستوى
              </button>
            </div>
          </form>

          {/* التوزيع على الـLots */}
          <div className="mt-8 border-t border-line pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">التوزيع على الـLots</h3>
              <span
                className={`num rounded px-2.5 py-1 text-xs ${
                  balanced ? 'bg-brand-soft text-brand' : 'bg-gold-soft text-gold'
                }`}
              >
                المجموع {total}%{balanced ? '' : ' — لازم 100%'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-6 text-muted">
              النسبة هي المرجع، والدينار للمتر يُشتقّ منها. ما نمنعوش الحفظ بمجموع ناقص — تنجّم
              تكمّل بعدُ — أمّا العروض تتحسب على اللي مسجّل.
            </p>

            <form action={updateLotSharesAction} className="mt-5">
              <input type="hidden" name="standing_code" value={selected.code} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="bg-surface-2">
                      <Th>Lot</Th>
                      <Th>النسبة %</Th>
                      <Th>د/م²</Th>
                      <Th>على {REFERENCE_SURFACE} م²</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((line) => (
                      <tr key={line.lotCode} className="border-t border-line">
                        <td className="px-4 py-2">
                          <span className="num text-xs text-faint">{line.lotCode}</span>{' '}
                          {line.lotNameAr}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            name={`share_${line.lotCode}`}
                            type="number"
                            step="0.001"
                            min="0"
                            max="100"
                            defaultValue={line.sharePct}
                            className={`${inputCls} num w-28`}
                          />
                        </td>
                        <td className="num px-4 py-2 text-muted">{formatNumber(line.perM2, 2)}</td>
                        <td className="num px-4 py-2">{formatNumber(line.total)} د.ت</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button className="rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep">
                  حفظ التوزيع
                </button>
              </div>
            </form>

            <form action={equaliseSharesAction} className="mt-3">
              <input type="hidden" name="standing_code" value={selected.code} />
              <button className="rounded border border-line px-4 py-2 text-xs text-muted hover:border-line-strong">
                وزّع بالتساوي على كلّ الـLots
              </button>
            </form>
          </div>
        </section>
      )}

      {/* مستوى جديد */}
      <section className="mt-10 rounded border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-sm font-semibold">مستوى جديد</h2>
        <p className="mt-1 text-xs leading-6 text-muted">
          الرمز حروف وأرقام فقط (B06 مثلاً). التوزيع يُنسخ تلقائياً من أقرب مستوى بالسعر، وتنجّم
          تعدّلو بعدها. <b>ما تنساش تزيد مقالات البوردرو للمستوى الجديد</b> — وإلّا خرج عرضه
          فارغاً.
        </p>
        <form action={upsertStandingLevelAction} className="mt-4 grid gap-4 sm:grid-cols-3">
          <L label="الرمز">
            <input name="code" required placeholder="B06" className={`${inputCls} num`} />
          </L>
          <L label="التسمية (عربي)">
            <input name="name_ar" required className={inputCls} />
          </L>
          <L label="التسمية (فرنسي)">
            <input name="name_fr" className={inputCls} />
          </L>
          <L label="السعر المرجعي د/م² HT">
            <input
              name="price_ht_m2"
              type="number"
              step="1"
              required
              className={`${inputCls} num`}
            />
          </L>
          <L label="أدنى النطاق">
            <input name="price_min_ht" type="number" step="1" className={`${inputCls} num`} />
          </L>
          <L label="أقصى النطاق">
            <input name="price_max_ht" type="number" step="1" className={`${inputCls} num`} />
          </L>
          <L label="الوصف (عربي)" wide>
            <textarea name="description_ar" rows={2} className={inputCls} />
          </L>
          <L label="الوصف (فرنسي)" wide>
            <textarea name="description_fr" rows={2} className={inputCls} />
          </L>
          <div className="sm:col-span-3">
            <button className="rounded bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-deep">
              أنشئ المستوى
            </button>
          </div>
        </form>
      </section>

      <p className="mt-6 rounded border border-line bg-gold-soft p-4 text-xs leading-6">
        بعد أيّ تعديل، شغّل <code className="num">npm run check:bordereau</code> — يقولّك إذا بعد
        مجموع العرض التفصيلي على سعر المتر المربّع المعلن.
      </p>
    </div>
  )
}

const inputCls =
  'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}

function L({
  label,
  wide,
  children,
}: {
  label: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`block ${wide ? 'sm:col-span-3' : ''}`}>
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      {children}
    </label>
  )
}
