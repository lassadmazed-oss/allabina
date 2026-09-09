'use server'

import { revalidatePath } from 'next/cache'
import { savedRedirect } from '@/lib/actions/saved'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  DEFAULT_VALIDITY_DAYS,
  devisValidUntil,
  evaluateFormula,
  generateDevis,
  type ArticleInput,
  type ProjectConfig,
} from '@/lib/devis'

/** إضافة أو تعديل مقال في البوردرو */
export async function upsertArticleAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const id = String(formData.get('article_id') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim()
  const designation = String(formData.get('designation_ar') ?? '').trim()
  if (!code || !designation) return

  const num = (k: string) => Number(String(formData.get(k) ?? '0').trim() || 0)
  const str = (k: string) => String(formData.get(k) ?? '').trim() || null

  const payload = {
    code,
    lot_id: Number(formData.get('lot_id')),
    designation_ar: designation,
    designation_fr: str('designation_fr'),
    unit: String(formData.get('unit') ?? 'm2'),
    qty_formula: String(formData.get('qty_formula') ?? '0').trim() || '0',
    standing: str('standing'),
    pu_fourniture_ht: num('pu_fourniture_ht'),
    pu_main_oeuvre_ht: num('pu_main_oeuvre_ht'),
    is_active: formData.get('is_active') !== 'off',
    updated_by: actor.userId,
  }

  const { error } = id
    ? await db.from('articles').update(payload).eq('id', id)
    : await db.from('articles').insert(payload)

  if (error) console.error('upsert article', error)
  revalidatePath('/admin/bordereau')
}

/** مواصفات المشروع — مدخل حساب العرض */
export async function updateProjectConfigAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v ? Number(v) : null
  }

  const { error } = await db.from('project_configs').upsert(
    {
      request_id: id,
      surface_m2: num('surface_m2'),
      levels: num('levels') ?? 1,
      bedrooms: num('bedrooms'),
      living_rooms: num('living_rooms'),
      kitchens: num('kitchens'),
      bathrooms: num('bathrooms'),
      garage: formData.get('garage') === 'on',
      terrasse: formData.get('terrasse') === 'on',
      jardin: formData.get('jardin') === 'on',
      standing: String(formData.get('standing') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    },
    { onConflict: 'request_id' }
  )

  if (error) console.error('project config', error)
  revalidatePath(`/admin/${id}`)
  await savedRedirect('config')
}

/**
 * توليد Devis جديد وتجميده.
 * كلّ سطر ينسخ السعر والكمّية والوحدة وقت التوليد: تغيير سعر لاحقاً
 * لا يمسّ عرضاً صدر. النسخة القديمة تُوسم obsolete ولا تُحذف.
 */
export async function generateDevisAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('id'))

  const [{ data: request }, { data: config }] = await Promise.all([
    db.from('housing_requests').select('gov_code, standing, desired_area_m2').eq('id', requestId).maybeSingle(),
    db.from('project_configs').select('*').eq('request_id', requestId).maybeSingle(),
  ])
  if (!request) return

  const standing = config?.standing ?? request.standing
  const surface = Number(config?.surface_m2 ?? request.desired_area_m2 ?? 0)
  if (!surface) return

  const { data: land } = await db
    .from('request_land')
    .select('area_m2')
    .eq('request_id', requestId)
    .maybeSingle()

  const projectConfig: ProjectConfig = {
    surface,
    levels: Number(config?.levels ?? 1),
    bedrooms: Number(config?.bedrooms ?? 0),
    livingRooms: Number(config?.living_rooms ?? 0),
    kitchens: Number(config?.kitchens ?? 0),
    bathrooms: Number(config?.bathrooms ?? 0),
    garage: Boolean(config?.garage),
    terrasse: Boolean(config?.terrasse),
    jardin: Boolean(config?.jardin),
    cloture: Boolean(config?.cloture),
    majel: Boolean(config?.majel),
    piscine: Boolean(config?.piscine),
    annexe: Boolean(config?.annexe),
    solar: Boolean(config?.solar),
    ascenseur: Boolean(config?.ascenseur),
    landArea: Number(land?.area_m2 ?? 0),
  }

  // المقالات المطابقة: مستوى التشطيب (أو العامّة) والجهة (أو العامّة)
  let query = db
    .from('articles')
    .select('id, code, unit, qty_formula, pu_fourniture_ht, pu_main_oeuvre_ht, designation_ar, lots(code, name_ar)')
    .eq('is_active', true)

  if (standing) query = query.or(`standing.is.null,standing.eq.${standing}`)
  else query = query.is('standing', null)

  const { data: rows, error: articlesError } = await query
  if (articlesError) {
    console.error('load articles', articlesError)
    return
  }

  type Row = {
    id: string
    code: string
    unit: string
    qty_formula: string
    pu_fourniture_ht: number
    pu_main_oeuvre_ht: number
    designation_ar: string
    lots: { code: number; name_ar: string } | null
  }

  const articles: ArticleInput[] = ((rows ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    code: r.code,
    lotCode: r.lots?.code ?? 0,
    lotNameAr: r.lots?.name_ar ?? '—',
    designationAr: r.designation_ar,
    unit: r.unit,
    qtyFormula: r.qty_formula,
    puFournitureHt: Number(r.pu_fourniture_ht),
    puMainOeuvreHt: Number(r.pu_main_oeuvre_ht),
  }))

  const result = generateDevis(projectConfig, articles)
  if (result.lines.length === 0) return

  // النسخة الجديدة، والقديمة تصير obsolete
  const { data: last } = await db
    .from('devis')
    .select('version')
    .eq('request_id', requestId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  // مدّة الصلاحية إعداد إداري
  const { data: validitySetting } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'devis.validity_days')
    .maybeSingle()
  const validityDays =
    typeof validitySetting?.value === 'number' ? validitySetting.value : DEFAULT_VALIDITY_DAYS

  const version = (last?.version ?? 0) + 1
  await db.from('devis').update({ status: 'obsolete' }).eq('request_id', requestId).neq('status', 'accepted')

  const { data: devis, error } = await db
    .from('devis')
    .insert({
      request_id: requestId,
      version,
      standing,
      gov_code: request.gov_code,
      surface_m2: surface,
      total_ht: result.totalHt,
      status: 'draft',
      valid_until: devisValidUntil(new Date(), validityDays),
      generated_by: actor.userId,
      note: result.errors.length ? `مقالات تعذّر حسابها: ${result.errors.map((e) => e.code).join('، ')}` : null,
    })
    .select('id, ref_code')
    .single()

  if (error || !devis) {
    console.error('insert devis', error)
    return
  }

  const { error: linesError } = await db.from('devis_lines').insert(
    result.lines.map((l, i) => ({
      devis_id: devis.id,
      article_id: l.articleId,
      lot_code: l.lotCode,
      lot_name_ar: l.lotNameAr,
      article_code: l.articleCode,
      designation_ar: l.designationAr,
      unit: l.unit,
      quantity: l.quantity,
      pu_fourniture_ht: l.puFournitureHt,
      pu_main_oeuvre_ht: l.puMainOeuvreHt,
      pu_total_ht: l.puTotalHt,
      total_ht: l.totalHt,
      sort_order: i,
    }))
  )
  if (linesError) console.error('insert devis lines', linesError)

  await db.from('request_events').insert({
    request_id: requestId,
    event_type: 'note',
    actor: actor.userId,
    note: `توليد عرض تقديري ${devis.ref_code} (نسخة ${version})`,
  })

  revalidatePath(`/admin/${requestId}`)
  await savedRedirect('devis')
}

/** تجربة صيغة كمّية قبل حفظها */
export async function testFormulaAction(
  _prev: { result?: string; error?: string },
  formData: FormData
): Promise<{ result?: string; error?: string }> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { error: 'غير مصرّح' }

  const formula = String(formData.get('formula') ?? '')
  const sample: ProjectConfig = {
    surface: 120,
    levels: 1,
    bedrooms: 3,
    livingRooms: 1,
    kitchens: 1,
    bathrooms: 2,
    garage: true,
    terrasse: false,
    jardin: false,
    cloture: false,
    majel: false,
    piscine: false,
    annexe: false,
    solar: false,
    ascenseur: false,
    landArea: 400,
  }

  try {
    const value = evaluateFormula(formula, sample)
    return { result: `على مشروع نموذجي (120 م² · RDC · 3 غرف · حمّامان · جراج): ${value}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'صيغة غير صالحة' }
  }
}
