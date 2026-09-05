import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { FinanceSettings } from '@/lib/finance'
import { PROVISIONAL_SETTINGS } from '@/lib/finance'
import { DEFAULT_TIERS, REFERENCE_PRICE_HT, SENSITIVITY_HT, type TierPrice } from '@/lib/pricing'

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
 * بنك الزيتونة والمؤسّسات البنكية التونسية والتشريع الجاري به العمل بتاريخ إسناد
 * التمويل. ما نخزّنه هنا شيئان فقط:
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
  'مصاريف التسجيل والتأمين والضمانات والمصاريف البنكية وفق الشروط المعمول بها لدى بنك الزيتونة ' +
  'والمؤسسات البنكية التونسية، ووفق التشريع والترتيبات الجاري بها العمل بتاريخ إسناد التمويل.'

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
export async function getBuildTiers(govCode = 'SFX'): Promise<{
  tiers: TierPrice[]
  referencePrice: number
  sensitivity: { min: number; max: number }
  isHt: boolean
}> {
  const [{ data: rows }, { data: settings }] = await Promise.all([
    db
      .from('price_references')
      .select('tier, price_per_m2_tnd, price_min_tnd, price_max_tnd, is_ht')
      .eq('gov_code', govCode)
      .eq('product', 'construction')
      .not('tier', 'is', null),
    db.from('app_settings').select('key, value'),
  ])

  const map = new Map((settings ?? []).map((r) => [r.key as string, r.value]))
  const nb = (k: string, fallback: number) => {
    const v = map.get(k)
    return typeof v === 'number' ? v : fallback
  }

  const tiers = DEFAULT_TIERS.map((d) => {
    const row = (rows ?? []).find((r) => r.tier === d.tier)
    if (!row) return d
    return {
      ...d,
      price: Number(row.price_per_m2_tnd ?? d.price),
      min: Number(row.price_min_tnd ?? d.min),
      max: Number(row.price_max_tnd ?? d.max),
    }
  })

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
