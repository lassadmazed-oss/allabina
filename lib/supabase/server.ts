import 'server-only'
import type { CatalogDoc } from '@/lib/request-documents'
import { createClient } from '@supabase/supabase-js'
import type { FinanceSettings } from '@/lib/finance'
import { PROVISIONAL_SETTINGS } from '@/lib/finance'
import { DEFAULT_TIERS, REFERENCE_PRICE_HT, SENSITIVITY_HT, type TierPrice } from '@/lib/pricing'
import type { ConstructionSystem } from '@/lib/construction'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

if (!url || !secret) {
  throw new Error('SUPABASE_URL أو SUPABASE_SECRET_KEY غير معرّفين في .env')
}

/** عميل الخادم — يتجاوز RLS. لا يُستورَد أبداً في مكوّن يعمل في المتصفّح. */
export const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type Governorate = { code: string; name_ar: string; is_active: boolean }
export type Delegation = { id: number; gov_code: string; name_ar: string }

export async function getGovernorates(): Promise<Governorate[]> {
  const { data } = await db
    .from('governorates')
    .select('code, name_ar, is_active')
    .order('is_active', { ascending: false })
    .order('name_ar')
  return data ?? []
}

export async function getDelegations(govCode: string): Promise<Delegation[]> {
  const { data } = await db
    .from('delegations')
    .select('id, gov_code, name_ar')
    .eq('gov_code', govCode)
    .order('id')
  return data ?? []
}

/**
 * السياق المالي.
 * المنصة لا تثبّت أيّ شرط بنكي: هامش الربح/نسبة التمويل، سقف الاستدانة، المدّة،
 * المساهمة الذاتية، ومصاريف التسجيل والتأمين والضمانات تُحدَّد وفق المعمول به لدى
 * البنوك والمؤسّسات البنكية التونسية والتشريع الجاري به العمل بتاريخ إسناد
 * التمويل — **بلا تسمية بنك بعينه**: هذا التنبيه يظهر تحت كلّ نتيجة محاكاة،
 * واسم بنك في تنبيه قانوني يُقرأ توصيةً أو شراكةً، وكلاهما غير صحيح.
 * ما نخزّنه هنا شيئان فقط:
 *   1. النصّ الذي يُعرض تحت كلّ نتيجة (bankTermsNote)
 *   2. فرضيات داخلية موحّدة لترتيب المطالب فيما بينها (assumptions) — لا تُقدَّم
 *      للحريف كشروط تمويل، وهي نقطة انطلاق قابلة للتعديل في المحاكي.
 */
export type FinanceContext = {
  bankTermsNote: string
  assumptions: FinanceSettings
  assumptionNote: string
}

const FALLBACK_TERMS_NOTE =
  'يتم تحديد هامش الربح/نسبة التمويل المرجعية، سقف الاستدانة، مدة التمويل، المساهمة الذاتية، ' +
  'مصاريف التسجيل والتأمين والضمانات والمصاريف البنكية وفق الشروط المعمول بها لدى البنوك ' +
  'التونسية والمؤسسات البنكية التونسية، ووفق التشريع والترتيبات الجاري بها العمل بتاريخ ' +
  'إسناد التمويل.'

export async function getFinanceContext(): Promise<FinanceContext> {
  const { data } = await db.from('app_settings').select('key, value')
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]))
  const nb = (k: string, fallback: number) => {
    const v = map.get(k)
    return typeof v === 'number' ? v : fallback
  }
  const str = (k: string, fallback: string) => {
    const v = map.get(k)
    return typeof v === 'string' && v.trim() ? v : fallback
  }

  return {
    bankTermsNote: str('finance.terms_note', FALLBACK_TERMS_NOTE),
    assumptionNote: str(
      'scoring.assumption_note',
      'فرضيات داخلية للترتيب فقط — لا تمثّل شروط تمويل'
    ),
    assumptions: {
      annualRatePct: nb('scoring.assumed_rate_pct', PROVISIONAL_SETTINGS.annualRatePct),
      maxDtiPct: nb('scoring.assumed_dti_pct', PROVISIONAL_SETTINGS.maxDtiPct),
      maxYears: nb('scoring.assumed_years', PROVISIONAL_SETTINGS.maxYears),
      registrationFeesPct: nb('scoring.assumed_fees_pct', 0),
    },
  }
}

export type FinancingProduct = {
  id: number
  bank: string
  name: string
  target: string
  purpose: string | null
  max_share_pct: number | null
  max_years: number | null
  own_share_note: string | null
  conditions: string | null
  source: string | null
  verified_at: string | null
}

export async function getFinancingProducts(): Promise<FinancingProduct[]> {
  const { data } = await db
    .from('financing_products')
    .select('*')
    .eq('is_active', true)
    .order('target')
    .order('name')
  return (data ?? []) as FinancingProduct[]
}

export type Imada = { id: number; delegation_id: number; name_ar: string }

export async function getImadas(govCode = 'SFX'): Promise<Imada[]> {
  const { data: delegs } = await db.from('delegations').select('id').eq('gov_code', govCode)
  const ids = (delegs ?? []).map((d) => d.id)
  if (!ids.length) return []
  const { data } = await db
    .from('imadas')
    .select('id, delegation_id, name_ar')
    .in('delegation_id', ids)
    .eq('is_active', true)
    .order('name_ar')
  return (data ?? []) as Imada[]
}

export type Zone = {
  id: number
  gov_code: string
  delegation_id: number | null
  name_ar: string
  name_fr: string | null
}

/** المناطق المتداولة المقترحة في خانة الموقع — تُدار من الـBack-office */
export async function getZones(govCode = 'SFX'): Promise<Zone[]> {
  const { data } = await db
    .from('zones')
    .select('id, gov_code, delegation_id, name_ar, name_fr')
    .eq('gov_code', govCode)
    .eq('is_active', true)
    .order('sort_order')
    .order('name_ar')
  return (data ?? []) as Zone[]
}

/**
 * أسعار البناء حسب مستوى التشطيب (HT) من قاعدة البيانات.
 * عند غياب السطور نرجع للقيم الافتراضية في lib/pricing.ts.
 */
export type StandingLevel = {
  code: string
  nameAr: string
  nameFr: string | null
  descriptionAr: string | null
  descriptionFr: string | null
  price: number
  min: number
  max: number
  sortOrder: number
}

/** مستويات التشطيب كما تضبطها الإدارة — المرجع الوحيد */
export async function getStandingLevels(): Promise<StandingLevel[]> {
  const { data } = await db
    .from('standing_levels')
    .select('code, name_ar, name_fr, description_ar, description_fr, price_ht_m2, price_min_ht, price_max_ht, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  return (data ?? []).map((r) => ({
    code: r.code as string,
    nameAr: r.name_ar as string,
    nameFr: (r.name_fr as string) ?? null,
    descriptionAr: (r.description_ar as string) ?? null,
    descriptionFr: (r.description_fr as string) ?? null,
    price: Number(r.price_ht_m2),
    min: Number(r.price_min_ht ?? r.price_ht_m2),
    max: Number(r.price_max_ht ?? r.price_ht_m2),
    sortOrder: Number(r.sort_order),
  }))
}

/**
 * الشبكة السعرية للواجهة. المصدر standing_levels — أي مستوى تزيده
 * الإدارة يظهر للمواطن مباشرةً بلا تدخّل مطوّر. عند فراغ الجدول نرجع
 * للشبكة الاحتياطية في lib/pricing.ts.
 */
export async function getBuildTiers(
  _govCode = 'SFX',
  locale: 'ar' | 'fr' = 'ar'
): Promise<{
  tiers: TierPrice[]
  referencePrice: number
  sensitivity: { min: number; max: number }
  isHt: boolean
}> {
  const [levels, { data: settings }] = await Promise.all([
    getStandingLevels(),
    db.from('app_settings').select('key, value'),
  ])

  const map = new Map((settings ?? []).map((r) => [r.key as string, r.value]))
  const nb = (k: string, fallback: number) => {
    const v = map.get(k)
    return typeof v === 'number' ? v : fallback
  }

  const tiers: TierPrice[] =
    levels.length > 0
      ? levels.map((l) => ({
          tier: l.code,
          label: (locale === 'fr' ? l.nameFr : l.nameAr) || l.nameAr,
          description:
            (locale === 'fr' ? l.descriptionFr : l.descriptionAr) || l.descriptionAr || '',
          price: l.price,
          min: l.min,
          max: l.max,
        }))
      : DEFAULT_TIERS

  return {
    tiers,
    referencePrice: nb('build.reference_price_ht', REFERENCE_PRICE_HT),
    sensitivity: {
      min: nb('build.sensitivity_min_ht', SENSITIVITY_HT.min),
      max: nb('build.sensitivity_max_ht', SENSITIVITY_HT.max),
    },
    isHt: map.get('build.prices_are_ht') !== false,
  }
}

/**
 * أنظمة البناء المتاحة للاختيار — كراس الشروط، القسم 12.
 *
 * البوردرو القائم كلّه موسوم `TRAD`: النظام التقليدي كان الافتراض الضمنيّ
 * للمنصة، فصار خياراً صريحاً بين خيارين بدل أن يبقى مجهولاً.
 */
export async function getConstructionSystems(): Promise<ConstructionSystem[]> {
  const { data } = await db
    .from('construction_systems')
    .select(
      'code, name_ar, name_fr, citizen_summary_ar, citizen_summary_fr, principle_ar, principle_fr, sort_order, is_active, constraints'
    )
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as ConstructionSystem[]
}

/**
 * دليل وثائق المطلب.
 *
 * في القاعدة لا في الكود: الأوراق تتبدّل بتبدّل المناشير، والفريق
 * يعرف الواقع الإداري أكثر من أيّ قائمة مكتوبة في ملفّ TypeScript.
 * الترشيح حسب الملفّ في lib/request-documents.ts.
 */
export async function getDocCatalog(): Promise<CatalogDoc[]> {
  const { data, error } = await db
    .from('request_doc_catalog')
    .select('code, name_ar, name_fr, why_ar, issuer_ar, doc_group, applies_to, only_if, is_required, sort_order')
    .eq('is_active', true)
    .order('doc_group')
    .order('sort_order')

  if (error) {
    console.error('getDocCatalog', error)
    return []
  }

  return (data ?? []).map((d) => ({
    code: String(d.code),
    nameAr: String(d.name_ar),
    nameFr: (d.name_fr as string | null) ?? null,
    whyAr: (d.why_ar as string | null) ?? null,
    issuerAr: (d.issuer_ar as string | null) ?? null,
    group: d.doc_group as CatalogDoc['group'],
    appliesTo: (d.applies_to as string[] | null) ?? null,
    onlyIf: (d.only_if as string[] | null) ?? [],
    required: Boolean(d.is_required),
    sortOrder: Number(d.sort_order ?? 0),
  }))
}
