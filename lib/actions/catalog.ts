'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { parseSpecs } from '@/lib/catalog'

/**
 * نشر الكاتالوج — قرار إدارة لا حالة تقنية.
 *
 * القسم 03: «النشر يتم بعد موافقة الإدارة». فالمقال يولد مغلقاً، ولا
 * يُفتح إلّا بضغطة من صاحب reference.manage. و333 سعراً لا تخرج إلى
 * العلن لأنّ مطوّراً شغّل هجرة.
 */
function done(code?: string) {
  revalidatePath('/admin/bordereau')
  if (code) revalidatePath(`/admin/articles/${code}`)
  if (code) for (const l of ['ar', 'fr']) revalidatePath(`/${l}/catalogue/${code}`)
  for (const l of ['ar', 'fr']) revalidatePath(`/${l}/catalogue`)
}

export async function setLotPublicAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const lotId = Number(formData.get('lot_id'))
  const publish = formData.get('publish') === '1'
  if (!Number.isFinite(lotId)) return

  const { error } = await db
    .from('articles')
    .update({
      is_public: publish,
      published_at: publish ? new Date().toISOString() : null,
      published_by: publish ? actor.userId : null,
    })
    .eq('lot_id', lotId)
    .eq('is_active', true)
  if (error) {
    console.error('publish lot', error.message)
    return
  }

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'catalog.lot', lotId, publish },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  done()
}

/** المفتاح العامّ: يفتح الكاتالوج أو يغلقه كلّه بلا لمس المقالات */
export async function setCatalogOpenAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const open = formData.get('open') === '1'

  await db
    .from('app_settings')
    .upsert(
      [
        {
          key: 'catalog.public_enabled',
          value: open,
          description: 'فتح الكاتالوج العمومي. مغلق حتّى تعتمد الإدارة المقالات وأسعارها.',
        },
      ],
      { onConflict: 'key' }
    )
    .then(({ error }) => error && console.error('catalog open', error.message))

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'catalog.public_enabled', open },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  done()
}

/**
 * بطاقة المقال: ما يراه الزائر ولا يُحسب منه سعر.
 *
 * التوفّر وأجل التوريد والمواصفات والملاحظات. الأسعار تبقى في البوردرو
 * حيث تُراجَع مع صيغ الكمّيات — خانتان للسعر في شاشتين تعني سعرين.
 */
export async function updateArticleCardAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  if (!code) return

  const availability = String(formData.get('availability') ?? 'on_order')
  const lead = String(formData.get('lead_time_days') ?? '').trim()
  const leadDays = lead ? Number(lead) : null

  const { error } = await db
    .from('articles')
    .update({
      availability: ['in_stock', 'on_order', 'on_survey'].includes(availability)
        ? availability
        : 'on_order',
      lead_time_days: Number.isFinite(leadDays) && leadDays !== null && leadDays >= 0 ? leadDays : null,
      specs: parseSpecs(String(formData.get('specs') ?? '')),
      installation_note: String(formData.get('installation_note') ?? '').trim().slice(0, 500) || null,
      usage_note: String(formData.get('usage_note') ?? '').trim().slice(0, 500) || null,
      description: String(formData.get('description') ?? '').trim().slice(0, 1000) || null,
      description_fr: String(formData.get('description_fr') ?? '').trim().slice(0, 1000) || null,
    })
    .eq('code', code)
  if (error) {
    console.error('update article card', error.message)
    return
  }

  await db
    .from('staff_events')
    .insert({ actor: actor.userId, event_type: 'settings.update', detail: { key: 'article.card', code } })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  done(code)
}

/**
 * ربط بديل بمقال.
 *
 * السطر يُكتب باتّجاه واحد والقراءة تأخذ الاتّجاهين، فإضافة نفس
 * العلاقة مقلوبةً لا تُنشئ سطراً ثانياً — نتثبّت من الاتّجاه المعاكس
 * قبل الكتابة.
 */
export async function addAlternativeAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const altCode = String(formData.get('alt_code') ?? '').trim().toUpperCase()
  if (!code || !altCode || code.toUpperCase() === altCode) return

  const { data: pair } = await db.from('articles').select('id, code').in('code', [code, altCode])
  const byCode = new Map((pair ?? []).map((r) => [String(r.code).toUpperCase(), String(r.id)]))
  const id = byCode.get(code.toUpperCase())
  const altId = byCode.get(altCode)
  if (!id || !altId || id === altId) return

  // موجودة مقلوبةً؟ لا نكتب سطراً ثانياً لنفس العلاقة
  const { data: reverse } = await db
    .from('article_alternatives')
    .select('article_id')
    .eq('article_id', altId)
    .eq('alternative_id', id)
    .maybeSingle()
  if (reverse) return done(code)

  const { error } = await db
    .from('article_alternatives')
    .upsert({ article_id: id, alternative_id: altId }, { onConflict: 'article_id,alternative_id' })
  if (error) console.error('add alternative', error.message)
  done(code)
}

export async function removeAlternativeAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const altId = String(formData.get('alt_id') ?? '').trim()
  const id = String(formData.get('article_id') ?? '').trim()
  if (!id || !altId) return

  // يُحذف الاتّجاهان: المستعمل لا يعرف أيّهما كُتب
  await db.from('article_alternatives').delete().eq('article_id', id).eq('alternative_id', altId)
  await db.from('article_alternatives').delete().eq('article_id', altId).eq('alternative_id', id)
  done(code)
}

// ─────────────────────────────────────────── قواعد المناطق

function regionsDone() {
  revalidatePath('/admin/regions')
  for (const l of ['ar', 'fr']) revalidatePath(`/${l}/catalogue`)
}

const numOrNull = (v: FormDataEntryValue | null) => {
  const t = String(v ?? '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * قاعدة منطقة جديدة — تولد **غير معتمدة**.
 *
 * «لا نعرض تخفيضات أو توفر غير مؤكد» (القسم 03): من يكتب القاعدة لا
 * يعتمدها بنفس الضغطة، وإلّا صار الاعتماد توقيعاً على بياض.
 */
export async function saveRegionRuleAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const delegationId = numOrNull(formData.get('delegation_id'))
  const lotId = numOrNull(formData.get('lot_id'))
  const row = {
    gov_code: String(formData.get('gov_code') ?? 'SFX'),
    delegation_id: delegationId,
    lot_id: lotId,
    transport_pct: numOrNull(formData.get('transport_pct')),
    transport_per_unit: numOrNull(formData.get('transport_per_unit')),
    labour_factor: numOrNull(formData.get('labour_factor')),
    availability: String(formData.get('availability') ?? '') || null,
    lead_time_days: numOrNull(formData.get('lead_time_days')),
    reason_ar: String(formData.get('reason_ar') ?? '').trim().slice(0, 200) || null,
    effective_from: String(formData.get('effective_from') ?? '').trim() || null,
    is_approved: false,
    created_by: actor.userId,
  }

  const { error } = await db.from('region_rules').insert(row)
  if (error) console.error('save region rule', error.message)
  regionsDone()
}

export async function approveRegionRuleAction(formData: FormData) {
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id)) return
  const approve = formData.get('approve') === '1'

  await db
    .from('region_rules')
    .update({
      is_approved: approve,
      approved_by: approve ? actor.userId : null,
      approved_at: approve ? new Date().toISOString() : null,
    })
    .eq('id', id)

  await db
    .from('staff_events')
    .insert({ actor: actor.userId, event_type: 'settings.update', detail: { key: 'region_rule', id, approve } })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  regionsDone()
}

export async function deleteRegionRuleAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id)) return
  await db.from('region_rules').delete().eq('id', id)
  regionsDone()
}

export async function setRegionRulesEnabledAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const on = formData.get('on') === '1'
  await db
    .from('app_settings')
    .upsert(
      [{ key: 'catalog.region_rules_enabled', value: on, description: 'تطبيق قواعد المناطق على الأسعار المعروضة.' }],
      { onConflict: 'key' }
    )
    .then(({ error }) => error && console.error('region rules toggle', error.message))
  regionsDone()
}

