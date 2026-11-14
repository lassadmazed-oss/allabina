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

