import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { toPublic, type Availability, type CatalogArticle } from '@/lib/catalog'
import { ARTICLE_MEDIA_BUCKET, isPublishable } from '@/lib/article-media'

/**
 * قراءات الكاتالوج العمومي.
 *
 * كلّ استعلام هنا يرشّح بـis_public: ما لم تعتمده الإدارة لا يخرج،
 * والشرط في الاستعلام لا في العرض — صفحة تنسى الترشيح تعرض كلّ شيء.
 */
const SELECT =
  'id, code, unit, designation_ar, designation_fr, description, description_fr, ' +
  'pu_fourniture_ht, pu_main_oeuvre_ht, availability, lead_time_days, ' +
  'installation_note, usage_note, specs, lots(code, name_ar, name_fr)'

type Lot = { code: number; name_ar: string; name_fr: string }
type Row = Record<string, unknown>

/** supabase-js يُرجع العلاقة كائناً أو مصفوفة حسب الاستدلال — نقبل الاثنين */
const lotOf = (r: Row): Lot | null => {
  const v = r.lots as Lot | Lot[] | null | undefined
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function shape(r: Row): CatalogArticle {
  const lot = lotOf(r)
  const fourniture = Number(r.pu_fourniture_ht ?? 0)
  const main = Number(r.pu_main_oeuvre_ht ?? 0)
  const sum = fourniture + main
  return toPublic({
    id: String(r.id),
    code: String(r.code),
    lotCode: Number(lot?.code ?? 0),
    lotNameAr: String(lot?.name_ar ?? ''),
    lotNameFr: String(lot?.name_fr ?? ''),
    designationAr: String(r.designation_ar ?? ''),
    designationFr: String(r.designation_fr ?? ''),
    descriptionAr: (r.description as string) ?? null,
    descriptionFr: (r.description_fr as string) ?? null,
    unit: String(r.unit ?? ''),
    // صفر ليس سعراً: priceOf تترجمه إلى «غير متاح» لا إلى مجّاني
    priceHt: sum > 0 ? sum : null,
    availability: (r.availability as Availability) ?? 'on_order',
    leadTimeDays: r.lead_time_days === null ? null : Number(r.lead_time_days),
    installationNote: (r.installation_note as string) ?? null,
    usageNote: (r.usage_note as string) ?? null,
    specs: (r.specs as Record<string, string>) ?? null,
    imageUrl: null,
  })
}


/**
 * صورة الغلاف لكلّ مقال — المنشورة وحدها.
 *
 * «صور وحقوقها»: صورة بلا مصدر وإذن لا تخرج. الترشيح هنا لا في
 * الصفحة، فصفحة تنسى الشرط لا تنشر ما ليس لها.
 * الدلو خاصّ، فالروابط موقّعة لساعة.
 */
async function coverUrls(articleIds: string[]): Promise<Map<string, string>> {
  if (!articleIds.length) return new Map()
  const { data } = await db
    .from('article_media')
    .select('article_id, storage_path, credit, license, sort_order')
    .in('article_id', articleIds)
    .order('sort_order')

  const first = new Map<string, string>()
  for (const m of data ?? []) {
    if (!isPublishable({ credit: m.credit as string, license: m.license as string })) continue
    const id = String(m.article_id)
    if (!first.has(id)) first.set(id, String(m.storage_path))
  }
  if (!first.size) return new Map()

  const paths = [...first.values()]
  const { data: signed } = await db.storage.from(ARTICLE_MEDIA_BUCKET).createSignedUrls(paths, 3600)
  const urlByPath = new Map((signed ?? []).map((s) => [String(s.path), s.signedUrl]))

  const out = new Map<string, string>()
  for (const [id, path] of first) {
    const url = urlByPath.get(path)
    if (url) out.set(id, url)
  }
  return out
}

/** هل الكاتالوج مفتوح أصلاً؟ قرار في «المعطيات المرجعية». */
export const catalogOpen = cache(async (): Promise<boolean> => {
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'catalog.public_enabled')
    .maybeSingle()
  return data?.value === true
})

export const catalogTaxRate = cache(async (): Promise<number | null> => {
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['catalog.show_ttc', 'devis.tax_rate_pct'])
  const m = new Map((data ?? []).map((r) => [r.key as string, r.value]))
  if (m.get('catalog.show_ttc') !== true) return null
  const rate = m.get('devis.tax_rate_pct')
  return typeof rate === 'number' && rate > 0 ? rate : null
})

/** اللوطات التي فيها مقال منشور واحد على الأقلّ — لا صفحات أصناف فارغة */
export const getPublicLots = cache(async (): Promise<{ code: number; nameAr: string; nameFr: string; count: number }[]> => {
  const { data } = await db
    .from('articles')
    .select('lots(code, name_ar, name_fr)')
    .eq('is_public', true)
    .eq('is_active', true)

  const byCode = new Map<number, { code: number; nameAr: string; nameFr: string; count: number }>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const lot = lotOf(r)
    if (!lot) continue
    const prev = byCode.get(lot.code)
    if (prev) prev.count += 1
    else byCode.set(lot.code, { code: lot.code, nameAr: lot.name_ar, nameFr: lot.name_fr, count: 1 })
  }
  return [...byCode.values()].sort((a, b) => a.code - b.code)
})

export async function getPublicArticles(limit = 300): Promise<CatalogArticle[]> {
  const { data } = await db
    .from('articles')
    .select(SELECT)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('code')
    .limit(limit)

  const rows = (data ?? []) as unknown as Row[]
  const covers = await coverUrls(rows.map((r) => String(r.id)))
  return rows.map((r) => ({ ...shape(r), imageUrl: covers.get(String(r.id)) ?? null }))
}

/**
 * مقال واحد بمرجعه.
 * المتوقّف (is_active = false) يبقى مقروءاً بمرجعه — «المنتج المتوقف
 * يبقى في المشاريع القديمة بمرجعه» — لكن لا يظهر في القوائم.
 */
export async function getPublicArticle(code: string): Promise<CatalogArticle | null> {
  const { data } = await db.from('articles').select(SELECT).eq('code', code).eq('is_public', true).maybeSingle()
  if (!data) return null
  const row = data as unknown as Row
  const covers = await coverUrls([String(row.id)])
  return { ...shape(row), imageUrl: covers.get(String(row.id)) ?? null }
}
