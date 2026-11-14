import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { baseCode, toPublic, type Availability, type CatalogArticle } from '@/lib/catalog'
import { ARTICLE_MEDIA_BUCKET, isPublishable } from '@/lib/article-media'
import { applyRegion, pickRule, type RegionRule } from '@/lib/region-rules'

/**
 * قراءات الكاتالوج العمومي.
 *
 * كلّ استعلام هنا يرشّح بـis_public: ما لم تعتمده الإدارة لا يخرج،
 * والشرط في الاستعلام لا في العرض — صفحة تنسى الترشيح تعرض كلّ شيء.
 */
const SELECT =
  'id, code, unit, designation_ar, designation_fr, description, description_fr, ' +
  'pu_fourniture_ht, pu_main_oeuvre_ht, availability, lead_time_days, ' +
  'installation_note, usage_note, specs, is_active, lot_id, standing, ' +
  'lots(code, name_ar, name_fr), standing_levels(code, name_ar, name_fr, sort_order)'

type Lot = { code: number; name_ar: string; name_fr: string }
type Level = {
  code: string
  name_ar: string
  name_fr: string
  sort_order: number
  description_ar?: string | null
  description_fr?: string | null
}
type Row = Record<string, unknown>

/** supabase-js يُرجع العلاقة كائناً أو مصفوفة حسب الاستدلال — نقبل الاثنين */
const one = <T,>(v: T | T[] | null | undefined): T | null => {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

const lotOf = (r: Row): Lot | null => one(r.lots as Lot | Lot[] | null)
const levelOf = (r: Row): Level | null => one(r.standing_levels as Level | Level[] | null)

function shape(r: Row): CatalogArticle {
  const lot = lotOf(r)
  const level = levelOf(r)
  const fourniture = Number(r.pu_fourniture_ht ?? 0)
  const main = Number(r.pu_main_oeuvre_ht ?? 0)
  const sum = fourniture + main
  return toPublic({
    id: String(r.id),
    code: String(r.code),
    lotCode: Number(lot?.code ?? 0),
    lotNameAr: String(lot?.name_ar ?? ''),
    lotNameFr: String(lot?.name_fr ?? ''),
    standingCode: r.standing === null || r.standing === undefined ? null : String(r.standing),
    standingNameAr: String(level?.name_ar ?? ''),
    standingNameFr: String(level?.name_fr ?? ''),
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
    isActive: r.is_active !== false,
    regionNote: null,
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


export type Region = { govCode: string; delegationId: number | null }

/**
 * قواعد المنطقة المعتمدة النافذة — تُقرأ مرّة لكلّ صفحة لا لكلّ مقال.
 */
export const getRegionRules = cache(async (govCode: string): Promise<RegionRule[]> => {
  const { data: setting } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'catalog.region_rules_enabled')
    .maybeSingle()
  if (setting?.value !== true) return []

  const { data } = await db
    .from('region_rules')
    .select('*')
    .eq('gov_code', govCode)
    .eq('is_approved', true)

  return (data ?? []).map((r) => ({
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
    reasonFr: (r.reason_fr as string) ?? null,
    isApproved: Boolean(r.is_approved),
    effectiveFrom: (r.effective_from as string) ?? null,
  }))
})

/**
 * تطبيق قاعدة المنطقة على مقال مُشكَّل.
 *
 * الحساب يحتاج فصل التوريد عن اليد العاملة — والفصل يبقى في الخادم:
 * ما يخرج هو السعر النهائي وسببه، لا تركيبته.
 */
function withRegion(
  article: CatalogArticle,
  row: Row,
  rules: RegionRule[],
  region: Region | null,
  locale: 'ar' | 'fr'
): CatalogArticle {
  if (!region || !rules.length) return article
  const rule = pickRule(rules, {
    govCode: region.govCode,
    delegationId: region.delegationId,
    lotId: row.lot_id === null || row.lot_id === undefined ? null : Number(row.lot_id),
  })
  if (!rule) return article

  const effect = applyRegion(
    {
      supplyHt: row.pu_fourniture_ht === null ? null : Number(row.pu_fourniture_ht),
      labourHt: row.pu_main_oeuvre_ht === null ? null : Number(row.pu_main_oeuvre_ht),
      availability: article.availability,
      leadTimeDays: article.leadTimeDays,
    },
    rule,
    locale
  )
  if (!effect.changed) return article

  return {
    ...article,
    priceHt: effect.priceHt !== null && effect.priceHt > 0 ? effect.priceHt : article.priceHt,
    availability: effect.availability,
    leadTimeDays: effect.leadTimeDays,
    regionNote: effect.reasons.find((r) => r.text)?.text ?? null,
  }
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

/**
 * مستويات التشطيب الموجودة فعلاً في الكاتالوج المنشور.
 *
 * تُقرأ من المنشور لا من جدول المستويات: مستوى بلا مقال منشور لا يُعرض
 * في المُنتقي ثمّ يعطي صفحة فارغة.
 */
export type PublicStanding = {
  code: string
  nameAr: string
  nameFr: string
  descAr: string | null
  descFr: string | null
  sort: number
}

export const getPublicStandings = cache(async (): Promise<PublicStanding[]> => {
  const { data } = await db
    .from('articles')
    .select(
      'standing, standing_levels(code, name_ar, name_fr, sort_order, description_ar, description_fr)'
    )
    .eq('is_public', true)
    .eq('is_active', true)
    .not('standing', 'is', null)

  const byCode = new Map<string, PublicStanding>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const lv = levelOf(r)
    if (!lv || byCode.has(lv.code)) continue
    byCode.set(lv.code, {
      code: lv.code,
      nameAr: lv.name_ar,
      nameFr: lv.name_fr,
      descAr: lv.description_ar ?? null,
      descFr: lv.description_fr ?? null,
      sort: Number(lv.sort_order ?? 0),
    })
  }
  return [...byCode.values()].sort((a, b) => a.sort - b.sort)
})

/**
 * تاريخ قائمة الأسعار — رقمٌ بلا تاريخه لا يُراجَع.
 *
 * ولا يُقرأ من articles.updated_at: على الجدول مُطلِقٌ يحرّك العمود عند
 * **أيّ** تحديث، وزرّ النشر تحديث. فأوّل نشر كان يجعل الصفحة تقول
 * «الأسعار محيَّنة اليوم» وما تبدّل منها سنتيم. المصدر الصحيح تغييرُ
 * سعرٍ فعلي (المُطلِق يكتبه حين يختلف السعر وحده)، وإلّا فتاريخٌ
 * مُعلَن في المعطيات المرجعية.
 */
export const getPriceListDate = cache(async (): Promise<string | null> => {
  const { data: hist } = await db
    .from('article_price_history')
    .select('changed_at')
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (hist?.changed_at) return String(hist.changed_at)

  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'catalog.price_list_date')
    .maybeSingle()
  const v = data?.value
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null
})

/**
 * مراجع المقالات المنشورة — لخريطة الموقع وحدها.
 *
 * صفحةٌ منشورة لا يصل إليها أحد ليست منشورة. ولا نعيد استعمال
 * getPublicArticles هنا: تلك تجلب كلّ الأعمدة وتوقّع روابط الصور،
 * وخريطة الموقع لا تحتاج إلّا المرجع.
 */
export const getPublicArticleCodes = cache(async (): Promise<string[]> => {
  const { data } = await db
    .from('articles')
    .select('code')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('code')
  return (data ?? []).map((r) => String(r.code))
})

/** اللوطات التي فيها مقال منشور واحد على الأقلّ — لا صفحات أصناف فارغة */
export const getPublicLots = cache(async (standing?: string): Promise<{ code: number; nameAr: string; nameFr: string; count: number }[]> => {
  let q = db
    .from('articles')
    .select('lots(code, name_ar, name_fr)')
    .eq('is_public', true)
    .eq('is_active', true)
  if (standing) q = q.eq('standing', standing)
  const { data } = await q

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

export async function getPublicArticles(
  limit = 300,
  region: Region | null = null,
  locale: 'ar' | 'fr' = 'ar',
  standing?: string
): Promise<CatalogArticle[]> {
  let q = db
    .from('articles')
    .select(SELECT)
    .eq('is_public', true)
    .eq('is_active', true)
  // الترشيح في الاستعلام لا في العرض: سقف 300 يقطع قبل الترشيح، فلو
  // رُشّح بعد القراءة لظهر مستوى ناقصاً بلا أن يقول أحد لماذا
  if (standing) q = q.eq('standing', standing)
  const { data } = await q.order('code').limit(limit)

  const rows = (data ?? []) as unknown as Row[]
  const [covers, rules] = await Promise.all([
    coverUrls(rows.map((r) => String(r.id))),
    region ? getRegionRules(region.govCode) : Promise.resolve([] as RegionRule[]),
  ])
  return rows.map((r) =>
    withRegion(
      { ...shape(r), imageUrl: covers.get(String(r.id)) ?? null },
      r,
      rules,
      region,
      locale
    )
  )
}

/**
 * مقال واحد بمرجعه.
 * المتوقّف (is_active = false) يبقى مقروءاً بمرجعه — «المنتج المتوقف
 * يبقى في المشاريع القديمة بمرجعه» — لكن لا يظهر في القوائم.
 */
export async function getPublicArticle(
  code: string,
  region: Region | null = null,
  locale: 'ar' | 'fr' = 'ar'
): Promise<CatalogArticle | null> {
  const { data } = await db.from('articles').select(SELECT).eq('code', code).eq('is_public', true).maybeSingle()
  if (!data) return null
  const row = data as unknown as Row
  const [covers, rules] = await Promise.all([
    coverUrls([String(row.id)]),
    region ? getRegionRules(region.govCode) : Promise.resolve([] as RegionRule[]),
  ])
  return withRegion(
    { ...shape(row), imageUrl: covers.get(String(row.id)) ?? null },
    row,
    rules,
    region,
    locale
  )
}

/**
 * مقالات بمراجعها، بترتيب المراجع كما طلبها الزائر.
 * ترتيب القاعدة ليس ترتيب الأعمدة الذي يراه: من يختار «ب ثمّ أ» يتوقّع
 * «ب ثمّ أ».
 */
export async function getPublicArticlesByCodes(codes: string[]): Promise<CatalogArticle[]> {
  if (!codes.length) return []
  const { data } = await db
    .from('articles')
    .select(SELECT)
    .in('code', codes)
    .eq('is_public', true)
    .eq('is_active', true)

  const rows = (data ?? []) as unknown as Row[]
  const covers = await coverUrls(rows.map((r) => String(r.id)))
  const byCode = new Map(
    rows.map((r) => [String(r.code), { ...shape(r), imageUrl: covers.get(String(r.id)) ?? null }])
  )
  return codes.map((c) => byCode.get(c)).filter((a): a is CatalogArticle => Boolean(a))
}

/**
 * نفس المقال في بقيّة مستويات التشطيب.
 *
 * هذا ما يُخرج الكاتالوج من الكذب: «أبواب داخلية» بـ425 د وبـ850 د ليسا
 * سعرين لنفس الشيء، بل مستويين. من يرى الواحد يرى السلّم كاملاً بأسعاره
 * بدل أن يظنّ الفرق مزاجاً.
 */
export async function getStandingSiblings(article: CatalogArticle): Promise<CatalogArticle[]> {
  if (!article.standingCode) return []
  const base = baseCode(article.code)
  if (base === article.code) return []

  const { data } = await db
    .from('articles')
    .select(SELECT)
    .like('code', `${base}-B%`)
    .eq('is_public', true)
    .eq('is_active', true)
    .neq('id', article.id)
    .order('standing')

  return ((data ?? []) as unknown as Row[]).map(shape)
}

/**
 * بدائل مقال — في الاتّجاهين.
 *
 * العلاقة متماثلة منطقياً: «ب بديل أ» يعني «أ بديل ب». تُكتب باتّجاه
 * واحد ليبقى السطر واحداً، وتُقرأ في الاتّجاهين حتّى لا يقع ما يقع
 * دائماً: يُضاف البديل من بطاقة، فلا يظهر في البطاقة الأخرى، فيُضاف
 * ثانيةً مقلوباً، فيصير سطران لنفس العلاقة.
 *
 * ولا يُقترح إلّا المنشور والمشتغل: بديل متوقّف ليس بديلاً.
 */
export async function getAlternatives(articleId: string): Promise<CatalogArticle[]> {
  const [{ data: forward }, { data: back }] = await Promise.all([
    db.from('article_alternatives').select('alternative_id').eq('article_id', articleId),
    db.from('article_alternatives').select('article_id').eq('alternative_id', articleId),
  ])

  const ids = [
    ...new Set([
      ...(forward ?? []).map((r) => String(r.alternative_id)),
      ...(back ?? []).map((r) => String(r.article_id)),
    ]),
  ].filter((id) => id !== articleId)
  if (!ids.length) return []

  const { data } = await db
    .from('articles')
    .select(SELECT)
    .in('id', ids)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('code')

  const rows = (data ?? []) as unknown as Row[]
  const covers = await coverUrls(rows.map((r) => String(r.id)))
  return rows.map((r) => ({ ...shape(r), imageUrl: covers.get(String(r.id)) ?? null }))
}

