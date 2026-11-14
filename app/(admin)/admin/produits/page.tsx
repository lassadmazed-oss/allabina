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
