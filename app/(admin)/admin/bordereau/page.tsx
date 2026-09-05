import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/format'
import { upsertArticleAction } from '@/lib/actions/devis'
import FormulaTester from '@/components/FormulaTester'

export const metadata = { title: 'البوردرو وقاعدة الأسعار — اللَّبنة' }
export const dynamic = 'force-dynamic'

const UNITS: Record<string, string> = {
  m2: 'م²',
  ml: 'م.ط',
  m3: 'م³',
  kg: 'كغ',
  u: 'وحدة',
  forfait: 'جزافي',
}

const STANDINGS: Record<string, string> = {
  standard: 'عادي',
  mid: 'متوسّط',
  premium: 'Haut Standing',
}

type Lot = { id: number; code: number; name_ar: string; name_fr: string }
type Article = {
  id: string
  code: string
  lot_id: number
  designation_ar: string
  unit: string
  qty_formula: string
  standing: string | null
  pu_fourniture_ht: number
  pu_main_oeuvre_ht: number
  is_active: boolean
  updated_at: string
}

export default async function BordereauPage({
  searchParams,
}: {
  searchParams: Promise<{ lot?: string }>
}) {
  await requirePermission('reference.manage')
  const sp = await searchParams

  const [{ data: lotsRaw }, { data: articlesRaw }] = await Promise.all([
    db.from('lots').select('*').order('code'),
    db.from('articles').select('*').order('code'),
  ])

  const lots = (lotsRaw ?? []) as Lot[]
  const articles = (articlesRaw ?? []) as Article[]
  const selectedLot = sp.lot ? Number(sp.lot) : null
  const shown = selectedLot ? articles.filter((a) => a.lot_id === selectedLot) : articles

  const countByLot = new Map<number, number>()
  for (const a of articles) countByLot.set(a.lot_id, (countByLot.get(a.lot_id) ?? 0) + 1)

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-green">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-2 text-2xl font-semibold">البوردرو وقاعدة الأسعار</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        عشرون <span dir="ltr">Lot</span> جاهزة. تزيد تحت كلّ واحد المقالات بأسعارها وصيغة كمّيتها،
        والعروض التقديرية تتولّد منها. <b>ما فمّاش سعر مكتوب في الكود</b> — كل شي من هنا.
      </p>

      <div className="mt-4 rounded border border-line bg-bronze-soft p-4 text-sm leading-7">
        <b>تنبيه:</b> تغيير سعر يُطبَّق على العروض <b>الجديدة</b> فقط. العروض اللي تولّدت قبل
        يبقاو بأسعارهم كما هي — كل سطر عرض ينسخ سعره وقت التوليد.
      </div>

      {/* الـLots */}
      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/bordereau"
          className={`rounded border px-3 py-1.5 transition ${
            !selectedLot ? 'border-green bg-green text-white' : 'border-line bg-surface hover:border-line-strong'
          }`}
        >
          الكلّ ({articles.length})
        </Link>
        {lots.map((l) => (
          <Link
            key={l.id}
            href={`/admin/bordereau?lot=${l.id}`}
            className={`rounded border px-3 py-1.5 transition ${
              selectedLot === l.id
                ? 'border-green bg-green text-white'
                : 'border-line bg-surface hover:border-line-strong'
            }`}
          >
            <span className="num text-xs opacity-70">{l.code}</span> {l.name_ar}
            <span className="num mr-1 text-xs opacity-60">({countByLot.get(l.id) ?? 0})</span>
          </Link>
        ))}
      </div>

      {/* مقال جديد */}
      <section className="mt-8 rounded border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">إضافة مقال</h2>
        <form action={upsertArticleAction} className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الرمز</span>
            <input name="code" required placeholder="MAC-001" dir="ltr" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted">التسمية</span>
            <input name="designation_ar" required placeholder="بناء جدران آجرّ 20" className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الـLot</span>
            <select name="lot_id" className={inputCls} defaultValue={selectedLot ?? lots[0]?.id}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">الوحدة</span>
            <select name="unit" className={inputCls} defaultValue="m2">
              {Object.entries(UNITS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">مستوى التشطيب</span>
            <select name="standing" className={inputCls} defaultValue="">
              <option value="">كلّ المستويات</option>
              {Object.entries(STANDINGS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">سعر التوريد HT</span>
            <input name="pu_fourniture_ht" type="number" step="0.001" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">سعر اليد العاملة HT</span>
            <input name="pu_main_oeuvre_ht" type="number" step="0.001" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">صيغة الكمّية</span>
            <input name="qty_formula" defaultValue="surface" dir="ltr" className={`${inputCls} text-left`} />
          </label>

          <button className="justify-self-start rounded bg-green px-6 py-2.5 text-sm font-medium text-white hover:bg-green-deep">
            إضافة المقال
          </button>
        </form>

        <FormulaTester />
      </section>

      {/* القائمة */}
      <div className="mt-8 overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-surface-2">
              <Th>الرمز</Th>
              <Th>التسمية</Th>
              <Th>الوحدة</Th>
              <Th>الصيغة</Th>
              <Th>المستوى</Th>
              <Th>توريد</Th>
              <Th>يد عاملة</Th>
              <Th>المجموع</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="p-10 text-center leading-8 text-muted">
                  ما فمّاش مقال مسجّل بعد. زيد أوّل مقال من فوق — ومن ساعتها تنجّم تولّد عروضاً
                  تقديرية للحرفاء.
                </td>
              </tr>
            )}
            {shown.map((a) => (
              <tr key={a.id} className="border-t border-line align-middle">
                <td className="num px-3 py-2" dir="ltr">
                  {a.code}
                </td>
                <td className="px-3 py-2">{a.designation_ar}</td>
                <td className="px-3 py-2 text-xs">{UNITS[a.unit] ?? a.unit}</td>
                <td className="num px-3 py-2 text-xs" dir="ltr">
                  {a.qty_formula}
                </td>
                <td className="px-3 py-2 text-xs">
                  {a.standing ? STANDINGS[a.standing] : 'الكلّ'}
                </td>
                <td className="num px-3 py-2">{formatNumber(Number(a.pu_fourniture_ht), 3)}</td>
                <td className="num px-3 py-2">{formatNumber(Number(a.pu_main_oeuvre_ht), 3)}</td>
                <td className="num px-3 py-2 font-medium text-green">
                  {formatNumber(Number(a.pu_fourniture_ht) + Number(a.pu_main_oeuvre_ht), 3)}
                </td>
                <td className="px-3 py-2">
                  <form action={upsertArticleAction} className="flex items-center gap-1">
                    <input type="hidden" name="article_id" value={a.id} />
                    <input type="hidden" name="code" value={a.code} />
                    <input type="hidden" name="designation_ar" value={a.designation_ar} />
                    <input type="hidden" name="lot_id" value={a.lot_id} />
                    <input type="hidden" name="unit" value={a.unit} />
                    <input type="hidden" name="qty_formula" value={a.qty_formula} />
                    <input type="hidden" name="standing" value={a.standing ?? ''} />
                    <input
                      name="pu_fourniture_ht"
                      type="number"
                      step="0.001"
                      defaultValue={Number(a.pu_fourniture_ht)}
                      className="num w-20 rounded border border-line px-2 py-1 text-xs"
                      aria-label="سعر التوريد"
                    />
                    <input
                      name="pu_main_oeuvre_ht"
                      type="number"
                      step="0.001"
                      defaultValue={Number(a.pu_main_oeuvre_ht)}
                      className="num w-20 rounded border border-line px-2 py-1 text-xs"
                      aria-label="سعر اليد العاملة"
                    />
                    <button className="rounded border border-line px-2 py-1 text-xs hover:border-green hover:text-green">
                      حفظ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-green'

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-3 text-right text-xs font-semibold text-muted">{children}</th>
}
