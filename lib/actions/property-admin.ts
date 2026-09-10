'use server'

import { revalidatePath } from 'next/cache'
import { savedRedirect } from '@/lib/actions/saved'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'

/** مراجعة عرض عقار: قبول، رفض، حجز، أو إخراج من السوق */
export async function reviewPropertyAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const status = String(formData.get('status'))
  const note = String(formData.get('review_note') ?? '').trim()

  const { error } = await db
    .from('properties')
    .update({
      status,
      review_note: note || null,
      reviewed_by: actor.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('review property', error)
    return
  }

  revalidatePath('/admin/properties')
  revalidatePath('/admin')
  await savedRedirect('status')
}

/** حفظ مطابقة اقترحها المحرّك حتى يتابعها الفريق */
export async function saveMatchAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id'))
  const propertyId = String(formData.get('property_id'))
  const score = Number(formData.get('score') ?? 0)
  const reasons = String(formData.get('reasons') ?? '[]')

  const { error } = await db.from('matches').upsert(
    {
      request_id: requestId,
      property_id: propertyId,
      score,
      reasons: JSON.parse(reasons),
      status: 'shortlisted',
      actor: actor.userId,
    },
    { onConflict: 'request_id,property_id' }
  )

  if (error) {
    console.error('save match', error)
    return
  }

  await db.from('request_events').insert({
    request_id: requestId,
    event_type: 'note',
    actor: actor.userId,
    note: `عرض عقاري محفوظ للمتابعة (مطابقة ${score}%)`,
  })

  revalidatePath(`/admin/${requestId}`)
  // صفحة العقار تعرض «محفوظ للمتابعة» على نفس الحريف
  revalidatePath('/admin/properties', 'layout')
}

/** تغيير حالة مطابقة محفوظة */
export async function updateMatchAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('match_id'))
  const requestId = String(formData.get('request_id'))
  const status = String(formData.get('status'))
  const note = String(formData.get('note') ?? '').trim()

  const { error } = await db
    .from('matches')
    .update({ status, note: note || null, actor: actor.userId })
    .eq('id', id)

  if (error) {
    console.error('update match', error)
    return
  }

  revalidatePath(`/admin/${requestId}`)
}
