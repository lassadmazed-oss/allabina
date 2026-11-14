import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { isPublishable } from '@/lib/article-media'
import { PRODUCT_MEDIA_BUCKET, type ArticleProduct, type Product } from '@/lib/products'

/**
 * قراءات طبقة المنتَج.
 *
 * الصور موقّعة لساعة من دلو خاصّ، والصورة بلا مصدر وإذن لا تخرج —
 * الترشيح هنا لا في الصفحة، فصفحةٌ تنسى الشرط لا تنشر ما ليس لها.
 */
type Row = Record<string, unknown>

const SELECT =
  'id, code, manufacturer_code, brand, range_name, name_ar, name_fr, pack_size, pack_unit, ' +
  'price, price_includes_tax, tax_rate_pct, price_source, price_checked_at, price_verified, ' +
  'specs, standard, notes, is_active, is_public'

function shape(r: Row, imageUrl: string | null = null): Product {
  return {
    id: String(r.id),
    code: String(r.code),
    brand: (r.brand as string) ?? null,
    rangeName: (r.range_name as string) ?? null,
    nameAr: String(r.name_ar ?? ''),
    nameFr: (r.name_fr as string) ?? null,
    packSize: r.pack_size === null || r.pack_size === undefined ? null : Number(r.pack_size),
    packUnit: (r.pack_unit as string) ?? null,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    priceIncludesTax: r.price_includes_tax !== false,
    taxRatePct:
      r.tax_rate_pct === null || r.tax_rate_pct === undefined ? null : Number(r.tax_rate_pct),
    priceSource: (r.price_source as string) ?? null,
    priceCheckedAt: (r.price_checked_at as string) ?? null,
    priceVerified: r.price_verified === true,
    specs: (r.specs as Record<string, string>) ?? null,
    standard: (r.standard as string) ?? null,
    notes: (r.notes as string) ?? null,
    imageUrl,
    isPublic: r.is_public === true,
  }
}

/**
 * صورة الغلاف لكلّ منتَج — المنشورة وحدها (مصدر وإذن).
 * روابط موقّعة لساعة: الدلو خاصّ.
 */
async function coverUrls(productIds: string[]): Promise<Map<string, string>> {
  if (!productIds.length) return new Map()
  const { data } = await db
    .from('product_media')
    .select('product_id, storage_path, credit, license, sort_order')
    .in('product_id', productIds)
    .order('sort_order')

  const first = new Map<string, string>()
  for (const m of data ?? []) {
    if (!isPublishable({ credit: m.credit as string, license: m.license as string })) continue
    const id = String(m.product_id)
    if (!first.has(id)) first.set(id, String(m.storage_path))
  }
  if (!first.size) return new Map()

  const paths = [...first.values()]
  const { data: signed } = await db.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrls(paths, 3600)
  const byPath = new Map((signed ?? []).map((s) => [String(s.path), s.signedUrl]))

  const out = new Map<string, string>()
  for (const [id, path] of first) {
    const url = byPath.get(path)
    if (url) out.set(id, url)
  }
  return out
}

/** كلّ المنتجات — للإدارة. تشمل غير المنشور وغير المتثبَّت منه. */
export async function getProducts(): Promise<Product[]> {
  const { data } = await db.from('products').select(SELECT).eq('is_active', true).order('code')
  const rows = (data ?? []) as unknown as Row[]
  const covers = await coverUrls(rows.map((r) => String(r.id)))
  return rows.map((r) => shape(r, covers.get(String(r.id)) ?? null))
}

export async function getProduct(code: string): Promise<Product | null> {
  const { data } = await db.from('products').select(SELECT).eq('code', code).maybeSingle()
  if (!data) return null
  const row = data as unknown as Row
  const covers = await coverUrls([String(row.id)])
  return shape(row, covers.get(String(row.id)) ?? null)
}

export type ProductMediaRow = {
  id: string
  storagePath: string
  credit: string | null
  license: string | null
  sourceUrl: string | null
  url: string | null
}

/** كلّ صور المنتج — للإدارة، بما فيها ما لا يُنشر، كي يُرى ويُصلَح */
export async function getProductMedia(productId: string): Promise<ProductMediaRow[]> {
  const { data } = await db
    .from('product_media')
    .select('id, storage_path, credit, license, source_url, sort_order')
    .eq('product_id', productId)
    .order('sort_order')

  const rows = data ?? []
  if (!rows.length) return []
  const { data: signed } = await db.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrls(rows.map((r) => String(r.storage_path)), 3600)
  const byPath = new Map((signed ?? []).map((s) => [String(s.path), s.signedUrl]))

  return rows.map((r) => ({
    id: String(r.id),
    storagePath: String(r.storage_path),
    credit: (r.credit as string) ?? null,
    license: (r.license as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    url: byPath.get(String(r.storage_path)) ?? null,
  }))
}

export type ProductLink = ArticleProduct & {
  articleId: string
  articleCode: string
  articleName: string
  articleUnit: string
}

/** المقالات المربوطة بمنتَج، ومعها جسر التغطية */
export async function getProductLinks(productId: string): Promise<ProductLink[]> {
  const { data } = await db
    .from('article_products')
    .select('coverage_per_pack, coverage_note, is_default, articles(id, code, designation_ar, unit)')
    .eq('product_id', productId)

  const out: ProductLink[] = []
  for (const r of (data ?? []) as unknown as Row[]) {
    const raw = r.articles as Row | Row[] | null
    const a = Array.isArray(raw) ? raw[0] : raw
    if (!a) continue
    out.push({
      product: null as unknown as Product, // غير مستعمل في هذا الاتّجاه
      coveragePerPack:
        r.coverage_per_pack === null || r.coverage_per_pack === undefined
          ? null
          : Number(r.coverage_per_pack),
      coverageNote: (r.coverage_note as string) ?? null,
      isDefault: r.is_default === true,
      articleId: String(a.id),
      articleCode: String(a.code),
      articleName: String(a.designation_ar ?? ''),
      articleUnit: String(a.unit ?? ''),
    })
  }
  return out.sort((x, y) => x.articleCode.localeCompare(y.articleCode))
}

/** منتجات مقال — للبطاقة العمومية ولشاشة المقال في الإدارة */
export const getArticleProducts = cache(async (articleId: string): Promise<ArticleProduct[]> => {
  const { data } = await db
    .from('article_products')
    .select(`coverage_per_pack, coverage_note, is_default, sort_order, products(${SELECT})`)
    .eq('article_id', articleId)
    .order('sort_order')

  const rows = (data ?? []) as unknown as Row[]
  const products: { row: Row; link: Row }[] = []
  for (const r of rows) {
    const raw = r.products as Row | Row[] | null
    const p = Array.isArray(raw) ? raw[0] : raw
    if (p) products.push({ row: p, link: r })
  }

  const covers = await coverUrls(products.map((x) => String(x.row.id)))
  return products.map(({ row, link }) => ({
    product: shape(row, covers.get(String(row.id)) ?? null),
    coveragePerPack:
      link.coverage_per_pack === null || link.coverage_per_pack === undefined
        ? null
        : Number(link.coverage_per_pack),
    coverageNote: (link.coverage_note as string) ?? null,
    isDefault: link.is_default === true,
  }))
})
