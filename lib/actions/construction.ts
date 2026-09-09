'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { savedRedirect } from '@/lib/actions/saved'
import { db } from '@/lib/supabase/server'
import { ELEMENT_SCOPES, OFFERING_STATUSES } from '@/lib/construction'

const SYSTEM_CODE = /^[A-Z_]{3,20}$/
const MAKER_CODE = /^[A-Z0-9_]{2,20}$/

function refresh() {
  revalidatePath('/admin/systemes')
  revalidatePath('/admin/bordereau')
  revalidatePath('/ar/systemes')
  revalidatePath('/fr/systemes')
  revalidatePath('/ar/demande')
  revalidatePath('/fr/demande')
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim() || null
const num = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * نظام بناء جديد أو تحيين واحد قائم.
 *
 * المقصد نفسه الذي في مستويات التشطيب: نظام ثالث يُضاف من اللوحة بلا
 * هجرة ولا مطوّر. وما يُكتب هنا **بلا أرقام**: الأرقام تُعلَّق على العرض
 * (مصنّع × نظام) لأنّ كلّ رقم في الوثائق هو رقم مصنّع بعينه.
 */
export async function upsertSystemAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const nameAr = str(formData, 'name_ar')
  const summaryAr = str(formData, 'citizen_summary_ar')
  if (!SYSTEM_CODE.test(code) || !nameAr || !summaryAr) return

  const { error } = await db.from('construction_systems').upsert(
    {
      code,
      name_ar: nameAr,
      name_fr: str(formData, 'name_fr'),
      citizen_summary_ar: summaryAr,
      citizen_summary_fr: str(formData, 'citizen_summary_fr'),
      principle_ar: str(formData, 'principle_ar'),
      principle_fr: str(formData, 'principle_fr'),
      sort_order: num(formData, 'sort_order') ?? 99,
      is_active: formData.get('is_active') !== 'off',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'code' }
  )
  if (error) {
    console.error('upsert construction_systems', error)
    return
  }
  refresh()
  await savedRedirect('system')
}

/**
 * حدود النظام — تُكتب حقلاً حقلاً لا JSON خامّاً.
 *
 * لماذا: هذه الحدود **تسري برمجياً** (مشروع بقبو موقف سيارات لا يُقترح
 * عليه النظام). لو تُركت نصّاً حرّاً لصارت زينة تُقرأ ولا تُطبَّق، ولو
 * تُركت JSON لكسرها أوّل خطأ مطبعيّ في اللوحة.
 */
export async function updateSystemConstraintsAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  if (!SYSTEM_CODE.test(code)) return

  const list = (k: string) =>
    String(formData.get(k) ?? '')
      .split(/[,·\s]+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)

  const texts = (k: string) =>
    String(formData.get(k) ?? '')
      .split(/[,·]+/)
      .map((v) => v.trim())
      .filter(Boolean)

  const { data: row } = await db
    .from('construction_systems')
    .select('constraints')
    .eq('code', code)
    .maybeSingle()

  const constraints: Record<string, unknown> = { ...((row?.constraints as object) ?? {}) }
  const setOrDrop = (key: string, value: unknown) => {
    if (value === null || (Array.isArray(value) && value.length === 0)) delete constraints[key]
    else constraints[key] = value
  }

  setOrDrop('fire_resistance_hours', num(formData, 'fire_resistance_hours'))
  setOrDrop('fire_reaction_class', str(formData, 'fire_reaction_class'))
  setOrDrop('load_bearing_series_cm', list('load_bearing_series_cm'))
  setOrDrop('partition_series_cm', list('partition_series_cm'))
  setOrDrop('excluded_uses', texts('excluded_uses'))
  setOrDrop('excluded_reason_ar', str(formData, 'excluded_reason_ar'))
  setOrDrop('raidisseur_spacing_m', num(formData, 'raidisseur_spacing_m'))
  setOrDrop('enduit_exterieur_mm', num(formData, 'enduit_exterieur_mm'))
  setOrDrop('standards', texts('standards'))

  const { error } = await db
    .from('construction_systems')
    .update({ constraints, updated_at: new Date().toISOString() })
    .eq('code', code)
  if (error) {
    console.error('update constraints', error)
    return
  }
  refresh()
  await savedRedirect('limits')
}

export async function upsertManufacturerAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const nameAr = str(formData, 'name_ar')
  if (!MAKER_CODE.test(code) || !nameAr) return

  const { error } = await db.from('manufacturers').upsert(
    {
      code,
      name_ar: nameAr,
      name_fr: str(formData, 'name_fr'),
      gov_code: str(formData, 'gov_code'),
      address: str(formData, 'address'),
      phone: str(formData, 'phone'),
      website: str(formData, 'website'),
      notes: str(formData, 'notes'),
      is_active: formData.get('is_active') !== 'off',
    },
    { onConflict: 'code' }
  )
  if (error) {
    console.error('upsert manufacturers', error)
    return
  }
  refresh()
  await savedRedirect('maker')
}

/**
 * عرض = مصنّع × نظام × جزء من المبنى.
 *
 * لا يُنشر عرض بلا وثيقة: `published` بلا Avis Technique يعني أرقاماً
 * تُعرض على مواطن بلا مصدر. الحالة تُخفَّض تلقائياً إلى «ناقص الوثائق».
 */
export async function upsertOfferingAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const id = num(formData, 'id')
  const systemCode = String(formData.get('system_code') ?? '').trim().toUpperCase()
  const scope = String(formData.get('element_scope') ?? '')
  const label = str(formData, 'label_ar')
  let status = String(formData.get('status') ?? 'draft')

  if (!SYSTEM_CODE.test(systemCode) || !label) return
  if (!ELEMENT_SCOPES.includes(scope as (typeof ELEMENT_SCOPES)[number])) return
  if (!OFFERING_STATUSES.includes(status as (typeof OFFERING_STATUSES)[number])) return

  if (status === 'published' && id) {
    const { count } = await db
      .from('offering_documents')
      .select('id', { count: 'exact', head: true })
      .eq('offering_id', id)
      .eq('is_normative', true)
    if (!count) status = 'partial'
  } else if (status === 'published' && !id) {
    status = 'partial'
  }

  const row = {
    system_code: systemCode,
    manufacturer_code: str(formData, 'manufacturer_code'),
    element_scope: scope,
    label_ar: label,
    status,
    notes: str(formData, 'notes'),
  }

  const { error } = id
    ? await db.from('system_offerings').update(row).eq('id', id)
    : await db.from('system_offerings').insert(row)
  if (error) {
    console.error('upsert system_offerings', error)
    return
  }
  refresh()
  await savedRedirect('offering')
}

export async function upsertDocumentAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const offeringId = num(formData, 'offering_id')
  const title = str(formData, 'title')
  const kind = String(formData.get('doc_kind') ?? 'autre')
  if (!offeringId || !title) return

  const { error } = await db.from('offering_documents').insert({
    offering_id: offeringId,
    doc_kind: kind,
    ref_code: str(formData, 'ref_code'),
    title,
    version: str(formData, 'version'),
    issued_on: str(formData, 'issued_on'),
    source_url: str(formData, 'source_url'),
    is_normative: formData.get('is_normative') !== 'off',
  })
  if (error) {
    console.error('insert offering_documents', error)
    return
  }
  refresh()
  await savedRedirect('document')
}

/**
 * عنصر في الكتالوج.
 *
 * `usage_domain` هو الحارس: عمود كهرباء أو أنبوب من نفس المصنّع لا يدخل
 * كتالوج عناصر المسكن. معيار الدخول نطاق الاستعمال لا اسم المنتَج.
 */
export async function upsertComponentAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const offeringId = num(formData, 'offering_id')
  const ref = str(formData, 'ref_fabricant')
  const nameAr = str(formData, 'name_ar')
  const usage = String(formData.get('usage_domain') ?? '')
  if (!offeringId || !ref || !nameAr) return
  if (!ELEMENT_SCOPES.includes(usage as (typeof ELEMENT_SCOPES)[number])) return

  const bearing = String(formData.get('is_load_bearing') ?? '')
  const { error } = await db.from('system_components').upsert(
    {
      offering_id: offeringId,
      ref_fabricant: ref,
      name_ar: nameAr,
      usage_domain: usage,
      length_mm: num(formData, 'length_mm'),
      width_mm: num(formData, 'width_mm'),
      height_mm: num(formData, 'height_mm'),
      role_ar: str(formData, 'role_ar'),
      is_load_bearing: bearing === '' ? null : bearing === 'yes',
      document_id: num(formData, 'document_id'),
      sort_order: num(formData, 'sort_order') ?? 99,
    },
    { onConflict: 'offering_id,ref_fabricant' }
  )
  if (error) {
    console.error('upsert system_components', error)
    return
  }
  refresh()
  await savedRedirect('component')
}

export async function deleteComponentAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const id = num(formData, 'id')
  if (!id) return
  const { error } = await db.from('system_components').delete().eq('id', id)
  if (error) console.error('delete system_components', error)
  refresh()
  await savedRedirect('component_removed')
}

/**
 * حدّ بحر — لا يُقبل بلا وثيقة.
 *
 * `document_id` مطلوب في القاعدة بـ`on delete restrict` عمداً: رقم بحر
 * بلا مصدر هو أخطر ما يمكن أن يحمله هذا النظام، لأنّه يُقرأ كضمان.
 */
export async function upsertSpanLimitAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const offeringId = num(formData, 'offering_id')
  const documentId = num(formData, 'document_id')
  const usageCode = str(formData, 'usage_code')
  const usageAr = str(formData, 'usage_ar')
  const load = num(formData, 'load_kn_m2')
  const assembly = str(formData, 'assembly_code')
  const span = num(formData, 'span_max_m')
  if (!offeringId || !documentId || !usageCode || !usageAr) return
  if (load === null || !assembly || span === null || span <= 0) return

  const { error } = await db.from('span_limits').upsert(
    {
      offering_id: offeringId,
      document_id: documentId,
      usage_code: usageCode,
      usage_ar: usageAr,
      load_kn_m2: load,
      assembly_code: assembly,
      span_max_m: span,
      reinforcement: str(formData, 'reinforcement'),
    },
    { onConflict: 'offering_id,usage_code,assembly_code' }
  )
  if (error) {
    console.error('upsert span_limits', error)
    return
  }
  refresh()
  await savedRedirect('span')
}

export async function upsertQuantityRuleAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const offeringId = num(formData, 'offering_id')
  const documentId = num(formData, 'document_id')
  const key = str(formData, 'rule_key')
  const value = num(formData, 'value')
  const unit = str(formData, 'unit_ar')
  if (!offeringId || !documentId || !key || value === null || !unit) return

  const { error } = await db.from('offering_quantity_rules').upsert(
    {
      offering_id: offeringId,
      document_id: documentId,
      rule_key: key,
      variant: str(formData, 'variant'),
      value,
      unit_ar: unit,
      condition_ar: str(formData, 'condition_ar'),
    },
    { onConflict: 'offering_id,rule_key,variant' }
  )
  if (error) {
    console.error('upsert offering_quantity_rules', error)
    return
  }
  refresh()
  await savedRedirect('rule')
}

/**
 * تركيبة السقف لمشروع بعينه — **قرار بشري يُسجَّل باسم صاحبه**.
 *
 * الجدول في القسم 8 من الفصل يقول لماذا: غرفة ببحر 4,50 م تتجاوز حدّ
 * 15+5 (4,20) فتستوجب 20+6، ونفس الـ4,20 م تكفي للسكن ولا تكفي لمحلّ
 * تجاري. اشتقاق التركيبة من المساحة وحدها قد يعطي سقفاً خارج حدوده.
 * المنصة تقترح، والمهندس يقرّر، والقرار يبقى منسوباً إليه — نفس مبدأ
 * التنقيط والمطابقة.
 */
export async function setFloorAssemblyAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id') ?? '')
  if (!requestId) return

  const assembly = str(formData, 'floor_assembly')
  const span = num(formData, 'max_span_m')
  const usage = str(formData, 'floor_usage_code')
  const { error } = await db
    .from('project_configs')
    .update({
      floor_assembly: assembly,
      max_span_m: span,
      floor_usage_code: usage,
      assembly_by: assembly ? actor.userId : null,
      assembly_at: assembly ? new Date().toISOString() : null,
      assembly_note: str(formData, 'assembly_note'),
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
  if (error) {
    console.error('set floor assembly', error)
    return
  }
  revalidatePath(`/admin/${requestId}`)
  await savedRedirect('assembly')
}

/** طريقة البناء للمشروع — تبدّل البوردرو الذي يُحسب عليه الـdevis */
export async function setProjectSystemAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id') ?? '')
  const code = String(formData.get('system_code') ?? '').trim().toUpperCase()
  if (!requestId || (code && !SYSTEM_CODE.test(code))) return

  const { error } = await db
    .from('project_configs')
    .update({ system_code: code || null, updated_at: new Date().toISOString() })
    .eq('request_id', requestId)
  if (error) {
    console.error('set project system', error)
    return
  }
  revalidatePath(`/admin/${requestId}`)
  await savedRedirect('system')
}
