import Link from 'next/link'
import { notFound } from 'next/navigation'
import ProductMediaUpload from '@/components/ProductMediaUpload'
import { requirePermission } from '@/lib/auth'
import { getProduct, getProductLinks, getProductMedia } from '@/lib/products-server'
import {
  deleteProductMediaAction,
  saveProductAction,
  setCoverageAction,
  setDefaultProductAction,
  setProductPublicAction,
  verifyProductPriceAction,
} from '@/lib/actions/products'
import { formatSpecs } from '@/lib/catalog'
import { isPublishable } from '@/lib/article-media'
import { packPriceHt, priceAgeDays } from '@/lib/products'
import { formatMillimes, formatMoney, isolateNumbers } from '@/lib/format'

export const dynamic = 'force-dynamic'

const input = 'w-full rounded border border-line bg-surface px-3 py-2 text-sm'
const label = 'mb-1.5 block text-sm font-medium'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return { title: `${decodeURIComponent(code)} — المنتجات` }
}

export default async function ProductPage({ params }: { params: Promise<{ code: string }> }) {
  await requirePermission('reference.manage')
  const { code: raw } = await params
  const code = decodeURIComponent(raw)
  const product = await getProduct(code)
  if (!product) notFound()

  const [links, media] = await Promise.all([getProductLinks(product.id), getProductMedia(product.id)])
  const ht = packPriceHt(product, 19)
  const age = priceAgeDays(product)
  const canPublish = product.priceVerified && product.price !== null

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin/produits" className="text-sm text-muted hover:text-brand">
        ← المنتجات
      </Link>
      <p className="num mt-2 text-xs text-faint">{isolateNumbers(product.code)}</p>
      <h1 className="display mt-0.5 text-lg font-semibold">{product.nameAr}</h1>

      {/* ── الحالة ── */}
      <section className="mt-4 rounded border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              product.isPublic ? 'bg-[#e4f1ea] text-[#1d6b45]' : 'bg-surface-2 text-muted'
            }`}
          >
            {product.isPublic ? 'منشور للحرفاء' : 'مغلق'}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              product.priceVerified ? 'bg-[#e4f1ea] text-[#1d6b45]' : 'bg-gold-soft text-gold'
            }`}
          >
            {product.priceVerified ? 'السعر متثبَّت منّو' : 'سعر ما تثبّتناش منّو'}
          </span>
          {ht !== null && (
            <span className="text-sm">
              <b className="num">{isolateNumbers(formatMoney(ht))}</b>{' '}
              <span className="text-xs text-faint">بلا أداء · للعبوة</span>
            </span>
          )}
          {age !== null && (
            <span className="text-xs text-muted">
              تثبّتنا منّو من <span className="num">{isolateNumbers(String(age))}</span> يوم
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <form action={verifyProductPriceAction}>
            <input type="hidden" name="code" value={product.code} />
            <input type="hidden" name="verified" value={product.priceVerified ? '0' : '1'} />
            <button type="submit" className="min-h-9 rounded border border-line px-3 text-sm">
              {product.priceVerified ? 'ارجع: ما تثبّتناش' : 'تثبّتنا من السعر مع المورّد'}
            </button>
          </form>
          <form action={setProductPublicAction}>
            <input type="hidden" name="code" value={product.code} />
            <input type="hidden" name="public" value={product.isPublic ? '0' : '1'} />
            <button
              type="submit"
              disabled={!canPublish && !product.isPublic}
              className="min-h-9 rounded border border-line px-3 text-sm disabled:opacity-40"
            >
              {product.isPublic ? 'اسحب من الحرفاء' : 'انشر للحرفاء'}
            </button>
          </form>
        </div>

        {!canPublish && !product.isPublic && (
          <p className="mt-2 text-xs leading-7 text-muted">
            ما ينشرش قبل ما نتثبّتو من السعر مع المورّد. <b>سعر بائع بتخفيض موش سعر مورّد</b> —
            واللي يدخل عرضاً بسعر غالط يخرج منّو خسارة.
          </p>
        )}
        {product.priceSource && (
          <p className="mt-2 break-all text-xs text-faint" dir="ltr">
            {product.priceSource}
          </p>
        )}
      </section>

      {/* ── التحرير ── */}
      <form action={saveProductAction} className="mt-5 grid gap-3 rounded border border-line bg-surface p-4">
        <input type="hidden" name="code" value={product.code} />
        <h2 className="text-sm font-semibold">المعطيات</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>الاسم بالعربية</span>
            <input name="name_ar" defaultValue={product.nameAr} required className={input} />
          </label>
          <label className="block">
            <span className={label}>الاسم بالفرنسية</span>
            <input name="name_fr" defaultValue={product.nameFr ?? ''} dir="ltr" className={input} />
          </label>
          <label className="block">
            <span className={label}>العلامة</span>
            <input name="brand" defaultValue={product.brand ?? ''} className={input} />
          </label>
          <label className="block">
            <span className={label}>الجمّة</span>
            <input name="range_name" defaultValue={product.rangeName ?? ''} className={input} />
          </label>
          <label className="block">
            <span className={label}>حجم العبوة</span>
            <input
              name="pack_size"
              inputMode="decimal"
              defaultValue={product.packSize ?? ''}
              className={`num ${input}`}
            />
          </label>
          <label className="block">
            <span className={label}>وحدة العبوة</span>
            <input
              name="pack_unit"
              defaultValue={product.packUnit ?? ''}
              placeholder="kg · L · u"
              dir="ltr"
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>السعر</span>
            <input
              name="price"
              inputMode="decimal"
              defaultValue={product.price ?? ''}
              className={`num ${input}`}
            />
          </label>
          <label className="block">
            <span className={label}>نسبة الأداء %</span>
            <input
              name="tax_rate_pct"
              inputMode="decimal"
              defaultValue={product.taxRatePct ?? ''}
              placeholder="19"
              className={`num ${input}`}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="price_includes_tax"
            defaultChecked={product.priceIncludesTax}
            className="size-4"
          />
          السعر مكتوب <b>مع</b> الأداء
        </label>

        <label className="block">
          <span className={label}>مصدر السعر</span>
          <input
            name="price_source"
            defaultValue={product.priceSource ?? ''}
            dir="ltr"
            className={input}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>تاريخ التثبّت</span>
            <input
              name="price_checked_at"
              type="date"
              defaultValue={product.priceCheckedAt ?? ''}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>المعيار</span>
            <input
              name="standard"
              defaultValue={product.standard ?? ''}
              placeholder="NT 47.01 · EN 13813"
              dir="ltr"
              className={input}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>المواصفات</span>
          <textarea
            name="specs"
            rows={6}
            defaultValue={formatSpecs(product.specs)}
            placeholder={'التشطيب: مات\nالقاعدة: أكريليك بالماء'}
            className={input}
          />
          <span className="mt-1 block text-xs text-faint">سطر لكلّ مواصفة: «المفتاح: القيمة».</span>
        </label>

        <label className="block">
          <span className={label}>ملاحظات داخلية</span>
          <textarea name="notes" rows={2} defaultValue={product.notes ?? ''} className={input} />
        </label>

        <button
          type="submit"
          className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white"
        >
          احفظ
        </button>
        <p className="text-xs leading-7 text-faint">
          تبديل السعر يسقّط تثبيته وحدو — رقم جديد ما أكّدو حتّى حدّ بعد.
        </p>
      </form>

      {/* ── الجسر: التغطية ── */}
      <section className="mt-5 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">في أيّ مقال يدخل</h2>
        <p className="mt-1 text-sm leading-7 text-muted">
          <b>عبوة وحدة تغطّي قدّاش من وحدة المقال</b>، بعدد الطبقات المعتاد. الرقم هذا يجي من
          الورقة الفنّية متاع المصنّع. خلّيه فارغ إذا ما تعرفوش — ما نحسبوش على تخمين.
        </p>

        {links.length === 0 ? (
          <p className="mt-3 text-sm text-faint">ما هوش مربوط بأيّ مقال.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {links.map((l) => (
              <li key={l.articleId} className="rounded border border-line p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/articles/${encodeURIComponent(l.articleCode)}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {l.articleName}
                  </Link>
                  <span className="num text-xs text-faint">{isolateNumbers(l.articleCode)}</span>
                  {l.isDefault && (
                    <span className="rounded bg-brand-soft px-1.5 text-xs text-brand">
                      المادّة الافتراضية
                    </span>
                  )}
                </div>

                <form
                  action={setCoverageAction}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="code" value={product.code} />
                  <input type="hidden" name="product_id" value={product.id} />
                  <input type="hidden" name="article_id" value={l.articleId} />
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">
                      العبوة تغطّي ({l.articleUnit})
                    </span>
                    <input
                      name="coverage"
                      inputMode="decimal"
                      defaultValue={l.coveragePerPack ?? ''}
                      className={`num w-28 rounded border border-line bg-surface px-2 py-1.5 text-sm`}
                    />
                  </label>
                  <label className="block flex-1 basis-48">
                    <span className="mb-1 block text-xs text-muted">الملاحظة</span>
                    <input
                      name="coverage_note"
                      defaultValue={l.coverageNote ?? ''}
                      placeholder="طبقتان على تلبيس"
                      className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="min-h-8 rounded border border-line px-3 text-xs"
                  >
                    احفظ
                  </button>
                </form>

                {/* الأثر يُرى فور كتابته: رقمٌ يُكتب ولا يُرى أثره لا يُراجَع */}
                {l.coveragePerPack !== null && ht !== null && (
                  <p className="mt-1.5 text-xs text-muted">
                    {/* بالمليم لا بالدينار: كلفة المادّة للمتر أغلبها تحت
                        الدينار، والتدوير يمسحها */}
                    يعني{' '}
                    <b className="num text-ink">
                      {isolateNumbers(formatMillimes(ht / l.coveragePerPack))}
                    </b>{' '}
                    مادّة لكلّ <span className="num">{l.articleUnit}</span>
                    {l.coverageNote ? ` · ${l.coverageNote}` : ''}
                  </p>
                )}

                {!l.isDefault && (
                  <form action={setDefaultProductAction} className="mt-1.5">
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="product_id" value={product.id} />
                    <input type="hidden" name="article_id" value={l.articleId} />
                    <button type="submit" className="text-xs text-muted underline underline-offset-4">
                      اجعلها المادّة الافتراضية لهذا المقال
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── الصور ── */}
      <section className="mt-5 rounded border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">الصور</h2>
        {media.length > 0 && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {media.map((m) => (
              <li key={m.id} className="rounded border border-line p-2">
                {m.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                )}
                <p className="mt-1.5 text-xs text-muted">{m.credit ?? '—'}</p>
                <p className="text-xs text-faint">{m.license ?? '—'}</p>
                {!isPublishable(m) && (
                  <p className="mt-1 rounded bg-gold-soft px-1.5 text-xs text-gold">
                    ما تتنشرش: ينقص المصدر ولّا الإذن
                  </p>
                )}
                <form action={deleteProductMediaAction} className="mt-1.5">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="code" value={product.code} />
                  <button type="submit" className="text-xs text-[#a32a24] underline underline-offset-4">
                    احذف
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <ProductMediaUpload code={product.code} />
        </div>
      </section>
    </div>
  )
}
