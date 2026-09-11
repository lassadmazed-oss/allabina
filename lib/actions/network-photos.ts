'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { photoRejection } from '@/lib/photos'
import {
  MAX_NETWORK_PHOTOS_PER_UPLOAD,
  NETWORK_PHOTO_BUCKET,
  NETWORK_PHOTO_KIND_AR,
  coverSortOrder,
  isNetworkPhotoKind,
  networkPhotoPath,
  nextSortOrder,
} from '@/lib/network-photos'

export type NetworkPhotoState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'profile' | 'server' | 'forbidden' | 'too_many'
}

function refresh(intervenantId: string) {
  revalidatePath('/admin/reseau')
  revalidatePath(`/admin/reseau/${intervenantId}`)
}

/**
 * صور أعمال المتدخّل أو منتوجات المزوّد — تحت <المتدخّل>/<النوع>/ في مخزن خاصّ.
 * الملفّ يمرّ بالخادم: النوع والحجم والصلاحية تُتحقَّق هنا، والمخزن يعيد
 * التحقّق بحدوده. صورة يفشل سطرها تُمسح من المخزن حتى لا تبقى يتيمة.
 */
export async function uploadNetworkPhotosAction(_prev: NetworkPhotoState, formData: FormData): Promise<NetworkPhotoState> {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return { ok: false, error: 'forbidden' }

  const id = String(formData.get('intervenant_id') ?? '').trim()
  const kindRaw = formData.get('kind')
  const kind = isNetworkPhotoKind(kindRaw) ? kindRaw : 'work'
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!id) return { ok: false, error: 'profile' }
  if (!files.length) return { ok: false, error: 'empty' }
  if (files.length > MAX_NETWORK_PHOTOS_PER_UPLOAD) return { ok: false, error: 'too_many' }
  for (const f of files) {
    const rejection = photoRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: parent } = await db.from('intervenants').select('id').eq('id', id).maybeSingle()
  if (!parent) return { ok: false, error: 'profile' }

  const { data: orders } = await db.from('intervenant_photos').select('sort_order').eq('intervenant_id', id)
  let order = nextSortOrder((orders ?? []).map((o) => Number(o.sort_order)))
  const caption = String(formData.get('caption_ar') ?? '').trim().slice(0, 200) || null

  let uploaded = 0
  for (const f of files) {
    const path = networkPhotoPath(id, kind, f.type)
    const { error: upErr } = await db.storage.from(NETWORK_PHOTO_BUCKET).upload(path, new Uint8Array(await f.arrayBuffer()), {
      contentType: f.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (upErr) {
      console.error('network photo upload', upErr)
      break
    }
    const { error } = await db.from('intervenant_photos').insert({
      intervenant_id: id,
      kind,
      storage_path: path,
      caption_ar: caption,
      sort_order: order++,
      mime: f.type,
      bytes: f.size,
      created_by: actor.userId,
    })
    if (error) {
      console.error('intervenant_photos insert', error)
      await db.storage.from(NETWORK_PHOTO_BUCKET).remove([path])
      break
    }
    uploaded++
  }

  if (!uploaded) return { ok: false, error: 'server' }

  // في سجلّ الملفّ: من رفع وماذا
  await db.from('intervenant_events').insert({
    intervenant_id: id,
    event_type: 'photo',
    actor: actor.userId,
    note: `${uploaded} صورة · ${NETWORK_PHOTO_KIND_AR[kind]}${caption ? ` — ${caption}` : ''}`,
  })
  refresh(id)
  return { ok: true, uploaded }
}

/** حذف صورة: السطر أوّلاً ثمّ الملفّ — العكس يترك رابطاً مكسوراً إن فشلت الثانية */
export async function deleteNetworkPhotoAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return
  const photoId = String(formData.get('photo_id') ?? '').trim()
  if (!photoId) return

  const { data: photo } = await db
    .from('intervenant_photos')
    .select('id, intervenant_id, storage_path')
    .eq('id', photoId)
    .maybeSingle()
  if (!photo) return

  const { error } = await db.from('intervenant_photos').delete().eq('id', photoId)
  if (error) {
    console.error('intervenant_photos delete', error)
    return
  }
  const { error: rmErr } = await db.storage.from(NETWORK_PHOTO_BUCKET).remove([photo.storage_path])
  if (rmErr) console.error('storage remove (row already gone)', rmErr)
  refresh(photo.intervenant_id)
}

/** التعليق والنوع (عمل أو منتوج) — بلا إعادة رفع */
export async function updateNetworkPhotoAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return
  const photoId = String(formData.get('photo_id') ?? '').trim()
  if (!photoId) return

  const patch: Record<string, unknown> = {
    caption_ar: String(formData.get('caption_ar') ?? '').trim().slice(0, 200) || null,
  }
  const kind = formData.get('kind')
  if (isNetworkPhotoKind(kind)) patch.kind = kind

  const { data: photo, error } = await db
    .from('intervenant_photos')
    .update(patch)
    .eq('id', photoId)
    .select('intervenant_id')
    .maybeSingle()
  if (error) console.error('intervenant_photos update', error)
  if (photo) refresh(photo.intervenant_id)
}

/** اجعلها الغلاف: الصورة التي تفتح بها بطاقة المتدخّل في القائمة */
export async function makeNetworkCoverAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return
  const photoId = String(formData.get('photo_id') ?? '').trim()
  if (!photoId) return

  const { data: photo } = await db.from('intervenant_photos').select('id, intervenant_id').eq('id', photoId).maybeSingle()
  if (!photo) return
  const { data: orders } = await db.from('intervenant_photos').select('sort_order').eq('intervenant_id', photo.intervenant_id)

  const { error } = await db
    .from('intervenant_photos')
    .update({ sort_order: coverSortOrder((orders ?? []).map((o) => Number(o.sort_order))) })
    .eq('id', photoId)
  if (error) console.error('network cover', error)
  refresh(photo.intervenant_id)
}
