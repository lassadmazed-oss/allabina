import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { getProducts } from '@/lib/products-server'
import {
  packLabel,
  packPriceHt,
  priceIsStale,
  productOwnGaps,
  productSubtitle,
  type ProductGap,
} from '@/lib/products'
import { formatMoney, isolateNumbers } from '@/lib/format'
import { createProductAction } from '@/lib/actions/products'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المنتجات — اللَّبنة' }

const GAP_AR: Record<ProductGap, string> = {
  price: 'بلا سعر',
  price_unverified: 'سعر ما تثبّتناش منّو',
  coverage: 'بلا تغطية',
  photo: 'بلا صورة',
  specs: 'مواصفات ناقصة',
}

export default async function ProductsPage() {
  await requirePermission('reference.manage')
  const products = await getProducts()

  const ready = products.filter((p) => p.isPublic)
  const byBrand = new Map<string, typeof products>()
  for (const p of products) {
    const k = p.brand ?? '—'
    const list = byBrand.get(k)
    if (list) list.push(p)
    else byBrand.set(k, [p])
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← لوحة القيادة
      </Link>
      <h1 className="display mt-1 text-lg font-semibold">المنتجات</h1>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted">
        المقال هو اللي يتسعّر في البوردرو، <b>والمنتَج هو اللي يختارو الحريف</b>. وبيناتهم رقم
        واحد: عبوة وحدة تغطّي قدّاش. بلا الرقم هذا ما يتحسبش سعر المادّة — وما نخمّنوهش.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded border border-line bg-surface px-3 py-1.5">
          <span className="num font-semibold">{isolateNumbers(String(products.length))}</span>{' '}
          منتَج
        </span>
        <span className="rounded border border-line bg-surface px-3 py-1.5">
          <span className="num font-semibold">{isolateNumbers(String(ready.length))}</span> منشور
        </span>
      </div>


      {/* الزليج والبيبان ما عندهمش كاتالوج على الويب: المعطيات تدخل
          من هنا بعد زيارة ديبو، لا من موقع يُقرأ */}
      <details className="mt-5 rounded border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">زيد منتَج جديد</summary>
        <p className="mt-2 text-sm leading-7 text-muted">
          المرجع والاسم واجبين، والباقي تنجّم تكمّلو من بعد. وإذا كتبت مرجع مقال، المنتَج
          يتربط <b>بكلّ مستوياتو</b> دفعة.
        </p>
        <form action={createProductAction} className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">المرجع</span>
              <input name="code" required dir="ltr" placeholder="SOM-GC-60" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">مرجع المقال (اختياري)</span>
              <input name="article_code" dir="ltr" placeholder="RE-01" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">الاسم بالعربية</span>
            <input name="name_ar" required placeholder="بلاط ڤري سيرام 60×60 بيج" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">العلامة</span>
              <input name="brand" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">الجمّة</span>
              <input name="range_name" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">حجم العبوة</span>
              <input name="pack_size" inputMode="decimal" placeholder="1.44" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">وحدتها</span>
              <input name="pack_unit" dir="ltr" placeholder="m2 · u · kg" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">السعر</span>
              <input name="price" inputMode="decimal" className="num w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">تاريخ التثبّت</span>
              <input name="price_checked_at" type="date" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="price_includes_tax" defaultChecked className="size-4" />
              مع الأداء
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">مصدر السعر</span>
            <input name="price_source" placeholder="ديبو فلان، صفاقس — فاتورة ولّا ديڤي" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">المواصفات</span>
            <textarea name="specs" rows={4} placeholder="المقاس: 60×60 / النوع: ڤري سيرام / الصندوق: 1.44 م² — سطر لكلّ وحدة" className="w-full rounded border border-line bg-surface px-3 py-2 text-sm" />
          </label>
          <button type="submit" className="min-h-10 justify-self-start rounded bg-brand px-4 text-sm font-semibold text-white">
            زيدو
          </button>
          <p className="text-xs leading-7 text-faint">
            يولد <b>مغلق وسعرو غير متثبَّت منّو</b>، كيما الكلّ. ما يوصل لحريف حتّى تأكّد السعر وتنشرو.
          </p>
        </form>
      </details>

      {products.length === 0 ? (
        <p className="mt-6 rounded border border-line bg-surface px-4 py-6 text-sm text-muted">
          ما ثمّ منتجات بعد.
        </p>
      ) : (
        [...byBrand.entries()].map(([brand, list]) => (
          <section key={brand} className="mt-7">
            <h2 className="text-sm font-semibold">{brand}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {list.map((p) => {
                const gaps = productOwnGaps(p)
                const ht = packPriceHt(p, 19)
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/produits/${encodeURIComponent(p.code)}`}
                      className="flex h-full gap-3 rounded border border-line bg-surface p-3 transition hover:border-line-strong"
                    >
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded bg-surface-2 text-xs text-faint">
                          بلا صورة
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="num text-xs text-faint">{isolateNumbers(p.code)}</span>
                        <span className="font-medium leading-7">{p.nameAr}</span>
                        <span className="text-xs text-muted">
                          {productSubtitle(p)}
                          {packLabel(p) ? ` · ${packLabel(p)}` : ''}
                        </span>
                        <span className="mt-1 flex flex-wrap items-baseline gap-2">
                          {ht === null ? (
                            <span className="text-xs text-faint">بلا سعر</span>
                          ) : (
                            <>
                              <b className="num text-sm">{isolateNumbers(formatMoney(ht))}</b>
                              <span className="text-xs text-faint">بلا أداء · للعبوة</span>
                            </>
                          )}
                          {p.isPublic && (
                            <span className="rounded bg-[#e4f1ea] px-1.5 text-xs text-[#1d6b45]">
                              منشور
                            </span>
                          )}
                          {priceIsStale(p) && (
                            <span className="rounded bg-gold-soft px-1.5 text-xs text-gold">
                              سعر قديم
                            </span>
                          )}
                        </span>
                        {gaps.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {gaps.map((g) => (
                              <span
                                key={g}
                                className="rounded bg-surface-2 px-1.5 text-xs text-muted"
                              >
                                {GAP_AR[g]}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
