'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'

export async function updateStatusAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('id'))
  const status = String(formData.get('status'))
  const note = String(formData.get('note') ?? '')

  const { data: before } = await db
    .from('housing_requests')
    .select('status')
    .eq('id', id)
    .single()

  const { error } = await db.from('housing_requests').update({ status }).eq('id', id)
  if (error) {
    console.error('update status', error)
    return
  }

  await db.from('request_events').insert({
    request_id: id,
    event_type: 'status_change',
    actor: actor.userId,
    from_status: before?.status ?? null,
    to_status: status,
    note: note || null,
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/${id}`)
}

/** الإجراء الواجب اتخاذه + صيغة التمويل المقترحة */
export async function updateFollowUpAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('id'))
  const nextAction = String(formData.get('next_action') ?? '').trim()
  const nextAt = String(formData.get('next_action_at') ?? '').trim()
  const financing = String(formData.get('financing_id') ?? '').trim()

  const { error } = await db
    .from('housing_requests')
    .update({
      next_action: nextAction || null,
      next_action_at: nextAt || null,
      financing_id: financing ? Number(financing) : null,
    })
    .eq('id', id)

  if (error) {
    console.error('update follow-up', error)
    return
  }

  await db.from('request_events').insert({
    request_id: id,
    event_type: 'note',
    actor: actor.userId,
    note: nextAction ? `الإجراء القادم: ${nextAction}` : 'حُذف الإجراء القادم',
  })

  revalidatePath(`/admin/${id}`)
  revalidatePath('/admin')
}

/** سؤال، مشكل، اعتراض، طلب خاصّ، مكالمة، ملاحظة */
export async function addInteractionAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('id'))
  const kind = String(formData.get('kind') ?? 'note')
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return

  const { error } = await db.from('request_interactions').insert({
    request_id: id,
    kind,
    body,
    actor: actor.userId,
  })
  if (error) console.error('add interaction', error)

  revalidatePath(`/admin/${id}`)
  revalidatePath('/admin')
}

export async function resolveInteractionAction(formData: FormData) {
  if (!(await staffWithPermission('requests.update'))) return
  const interactionId = String(formData.get('interaction_id'))
  const requestId = String(formData.get('id'))
  const answer = String(formData.get('answer') ?? '').trim()

  const { error } = await db
    .from('request_interactions')
    .update({ answer: answer || null, resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', interactionId)
  if (error) console.error('resolve interaction', error)

  revalidatePath(`/admin/${requestId}`)
  revalidatePath('/admin')
}

/** الوثائق المتوفّرة — تسجيل التوفّر فقط */
export async function toggleDocumentAction(formData: FormData) {
  if (!(await staffWithPermission('requests.update'))) return
  const requestId = String(formData.get('id'))
  const docType = String(formData.get('doc_type'))
  const available = formData.get('available') === 'on'

  const { error } = await db
    .from('request_documents')
    .upsert(
      { request_id: requestId, doc_type: docType, available, updated_at: new Date().toISOString() },
      { onConflict: 'request_id,doc_type' }
    )
  if (error) console.error('toggle document', error)

  revalidatePath(`/admin/${requestId}`)
}

/**
 * استيراد العمادات: سطر لكلّ معتمدية بالشكل
 *   المعتمدية: عمادة، عمادة، عمادة
 * لا تُخترع أسماء — تُلصق من قائمة وزارة الداخلية.
 */
export async function importImadasAction(
  _prev: { message?: string; error?: string },
  formData: FormData
) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { error: 'غير مصرّح' }
  const raw = String(formData.get('data') ?? '').trim()
  if (!raw) return { error: 'ما فمّا شي باش يتسجّل.' }

  const { data: delegs } = await db.from('delegations').select('id, name_ar').eq('gov_code', 'SFX')
  const byName = new Map((delegs ?? []).map((d) => [d.name_ar.trim(), d.id]))

  const rows: { delegation_id: number; name_ar: string }[] = []
  const unknown: string[] = []

  for (const line of raw.split('\n')) {
    const [head, tail] = line.split(':')
    if (!head || !tail) continue
    const delegationId = byName.get(head.trim())
    if (!delegationId) {
      if (head.trim()) unknown.push(head.trim())
      continue
    }
    for (const name of tail.split(/[،,]/)) {
      const n = name.trim()
      if (n) rows.push({ delegation_id: delegationId, name_ar: n })
    }
  }

  if (!rows.length) {
    return {
      error: unknown.length
        ? `ما تعرّفناش على المعتمديات: ${unknown.join('، ')}`
        : 'الصيغة غير صحيحة. استعمل: المعتمدية: عمادة، عمادة',
    }
  }

  const { error } = await db.from('imadas').upsert(rows, { onConflict: 'delegation_id,name_ar' })
  if (error) {
    console.error('import imadas', error)
    return { error: 'تعذّر التسجيل.' }
  }

  revalidatePath('/admin/reference')
  revalidatePath('/ar/demande')
  revalidatePath('/fr/demande')
  return {
    message: `تسجّلت ${rows.length} عمادة.${
      unknown.length ? ` معتمديات غير معروفة: ${unknown.join('، ')}` : ''
    }`,
  }
}

/** تصنيف الملفّ: نوع الإشكال، وضع التمويل، المسؤول */
export async function updateClassificationAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('id'))
  const problem = String(formData.get('problem_type') ?? '').trim()
  const financing = String(formData.get('financing_state') ?? '').trim()
  const assigned = String(formData.get('assigned_to') ?? '').trim()

  const { error } = await db
    .from('housing_requests')
    .update({
      problem_type: problem || null,
      financing_state: financing || 'not_started',
      assigned_to: assigned || null,
    })
    .eq('id', id)

  if (error) {
    console.error('update classification', error)
    return
  }

  revalidatePath(`/admin/${id}`)
  revalidatePath('/admin')
}

/**
 * ما يراه الحريف في صفحة المتابعة.
 * منفصل عن الملاحظات الداخلية: هنا يُكتب النصّ الموجّه للحريف عمداً.
 */
export async function updatePublicUpdateAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('id'))
  const update = String(formData.get('public_update') ?? '').trim()
  const nextStep = String(formData.get('public_next_step') ?? '').trim()

  const { error } = await db
    .from('housing_requests')
    .update({
      public_update: update || null,
      public_next_step: nextStep || null,
    })
    .eq('id', id)

  if (error) {
    console.error('update public message', error)
    return
  }

  await db.from('request_events').insert({
    request_id: id,
    event_type: 'note',
    actor: actor.userId,
    note: update ? `تحيين معروض للحريف: ${update}` : 'حُذف التحيين المعروض للحريف',
  })

  revalidatePath(`/admin/${id}`)
  revalidatePath('/ar/suivi')
  revalidatePath('/fr/suivi')
}
