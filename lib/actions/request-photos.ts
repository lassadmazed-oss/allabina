'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { photoRejection } from '@/lib/photos'
import {
  MAX_PHOTOS_PER_UPLOAD,
  REQUEST_PHOTO_BUCKET,
  isProgressStage,
  requestPhotoPath,
} from '@/lib/request-photos'

export type RequestPhotoState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'stage' | 'request' | 'server' | 'forbidden' | 'too_many'
}

function refresh(requestId: string) {
  revalidatePath('/admin')
  revalidatePath(`/admin/${requestId}`)
}

/**
 * صور تقدّم الأشغال لمطلب — حتى ستّ صور في الدفعة، كلّها بنفس المرحلة والتاريخ.
 * الملفّ يمرّ بالخادم: النوع والحجم والمرحلة والصلاحية تُتحقَّق هنا، والمخزن
 * الخاصّ يعيد التحقّق بحدوده. صورة يفشل سطرها تُمسح حتى لا تبقى يتيمة.
 */
export async function uploadRequestPhotosAction(
  _prev: RequestPhotoState,
  formData: FormData
): Promise<RequestPhotoState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'forbidden' }

  const requestId = String(formData.get('request_id') ?? '').trim()
  const stage = String(formData.get('stage') ?? '').trim()
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)

  if (!requestId) return { ok: false, error: 'request' }
  if (!isProgressStage(stage)) return { ok: false, error: 'stage' }
  if (!files.length) return { ok: false, error: 'empty' }
  if (files.length > MAX_PHOTOS_PER_UPLOAD) return { ok: false, error: 'too_many' }
  for (const f of files) {
    const rejection = photoRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: parent } = await db.from('housing_requests').select('id').eq('id', requestId).maybeSingle()
  if (!parent) return { ok: false, error: 'request' }

  const { data: last } = await db
    .from('request_photos')
    .select('sort_order')
    .eq('request_id', requestId)
    .eq('stage', stage)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  let order = (last?.sort_order ?? -1) + 1

  const caption = String(formData.get('caption') ?? '').trim().slice(0, 300) || null
  const takenRaw = String(formData.get('taken_at') ?? '').trim()
  const takenAt = /^\d{4}-\d{2}-\d{2}$/.test(takenRaw) ? takenRaw : null
  const showToClient = formData.get('show_to_client') === 'on'

  let uploaded = 0
  for (const f of files) {
    const path = requestPhotoPath(requestId, stage, f.type)
    const { error: upErr } = await db.storage
      .from(REQUEST_PHOTO_BUCKET)
      .upload(path, new Uint8Array(await f.arrayBuffer()), {
        contentType: f.type,
        cacheControl: '31536000', // المسار فريد فلا يتغيّر محتواه أبداً
        upsert: false,
      })
    if (upErr) {
      console.error('request photo upload', upErr)
      break
    }
    const { error } = await db.from('request_photos').insert({
      request_id: requestId,
      storage_path: path,
      stage,
      caption,
      taken_at: takenAt,
      show_to_client: showToClient,
      sort_order: order++,
      mime: f.type,
      bytes: f.size,
      created_by: actor.userId,
    })
    if (error) {
      console.error('request_photos insert', error)
      await db.storage.from(REQUEST_PHOTO_BUCKET).remove([path])
      break
    }
    uploaded++
  }

  if (uploaded) refresh(requestId)
  return uploaded ? { ok: true, uploaded } : { ok: false, error: 'server' }
}

/** حذف صورة: السطر أوّلاً ثمّ الملفّ — العكس يترك رابطاً مكسوراً إن فشلت الثانية */
export async function deleteRequestPhotoAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return

  const { data: photo } = await db
    .from('request_photos')
    .select('id, request_id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!photo) return

  const { error } = await db.from('request_photos').delete().eq('id', id)
  if (error) {
    console.error('request_photos delete', error)
    return
  }
  const { error: rmErr } = await db.storage.from(REQUEST_PHOTO_BUCKET).remove([photo.storage_path])
  if (rmErr) console.error('storage remove (row already gone)', rmErr)
  refresh(photo.request_id)
}

/** يراها صاحب المطلب أو لا — قرار الفريق لكلّ صورة */
export async function toggleRequestPhotoClientAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return
  const show = formData.get('show') === '1'

  const { data: photo, error } = await db
    .from('request_photos')
    .update({ show_to_client: show })
    .eq('id', id)
    .select('request_id')
    .maybeSingle()
  if (error) console.error('request_photos toggle', error)
  if (photo) refresh(photo.request_id)
}
