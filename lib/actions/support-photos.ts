'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { PHOTO_BUCKET, photoRejection } from '@/lib/photos'

export type SupportPhotoState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'case' | 'server' | 'forbidden' | 'too_many'
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** دفعة واحدة تبقى تحت حدّ جسم الطلب (16 ميغا في next.config) */
const MAX_PER_UPLOAD = 6

function refresh(caseId: string) {
  revalidatePath('/admin/support')
  for (const l of ['ar', 'fr']) {
    revalidatePath(`/${l}/soutien`)
    revalidatePath(`/${l}/soutien/${caseId}`)
  }
}

/**
 * صور تعرض حالة تحتاج مساندة — نفس مخزن الحالات المنجزة تحت support/<الحالة>/.
 * الملفّ يمرّ بالخادم: النوع والحجم والصلاحية تُتحقَّق هنا، والمخزن يعيد
 * التحقّق بحدوده. صورة يفشل سطرها تُمسح من المخزن حتى لا تبقى يتيمة.
 */
export async function uploadSupportPhotosAction(_prev: SupportPhotoState, formData: FormData): Promise<SupportPhotoState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'forbidden' }

  const caseId = String(formData.get('support_case_id') ?? '').trim()
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!caseId) return { ok: false, error: 'case' }
  if (!files.length) return { ok: false, error: 'empty' }
  if (files.length > MAX_PER_UPLOAD) return { ok: false, error: 'too_many' }
  for (const f of files) {
    const rejection = photoRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: parent } = await db.from('support_cases').select('id').eq('id', caseId).maybeSingle()
  if (!parent) return { ok: false, error: 'case' }

  const { data: last } = await db
    .from('support_photos')
    .select('sort_order')
    .eq('support_case_id', caseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  let order = (last?.sort_order ?? -1) + 1
  const caption = String(formData.get('caption_ar') ?? '').trim() || null

  let uploaded = 0
  for (const f of files) {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const path = `support/${caseId}/${stamp}-${Math.random().toString(36).slice(2, 8)}.${EXT[f.type] ?? 'bin'}`
    const { error: upErr } = await db.storage.from(PHOTO_BUCKET).upload(path, new Uint8Array(await f.arrayBuffer()), {
      contentType: f.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (upErr) {
      console.error('support photo upload', upErr)
      break
    }
    const { error } = await db.from('support_photos').insert({
      support_case_id: caseId,
      storage_path: path,
      caption_ar: caption,
      sort_order: order++,
      mime: f.type,
      bytes: f.size,
    })
    if (error) {
      console.error('support_photos insert', error)
      await db.storage.from(PHOTO_BUCKET).remove([path])
      break
    }
    uploaded++
  }

  if (uploaded) refresh(caseId)
  return uploaded ? { ok: true, uploaded } : { ok: false, error: 'server' }
}

/** حذف صورة: السطر أوّلاً ثمّ الملفّ — العكس يترك رابطاً مكسوراً إن فشلت الثانية */
export async function deleteSupportPhotoAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return

  const { data: photo } = await db.from('support_photos').select('id, support_case_id, storage_path').eq('id', id).maybeSingle()
  if (!photo) return

  const { error } = await db.from('support_photos').delete().eq('id', id)
  if (error) {
    console.error('support_photos delete', error)
    return
  }
  const { error: rmErr } = await db.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
  if (rmErr) console.error('storage remove (row already gone)', rmErr)
  refresh(photo.support_case_id)
}

/** تعليق الصورة بالعربية والفرنسية — بلا إعادة رفع */
export async function updateSupportPhotoAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return
  const str = (k: string) => String(formData.get(k) ?? '').trim() || null

  const { data: photo, error } = await db
    .from('support_photos')
    .update({ caption_ar: str('caption_ar'), caption_fr: str('caption_fr') })
    .eq('id', id)
    .select('support_case_id')
    .maybeSingle()
  if (error) console.error('support_photos update', error)
  if (photo) refresh(photo.support_case_id)
}

/** اجعلها الغلاف: ترتيب أصغر من كلّ صور الحالة */
export async function makeSupportCoverAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return

  const { data: photo } = await db.from('support_photos').select('id, support_case_id').eq('id', id).maybeSingle()
  if (!photo) return
  const { data: first } = await db
    .from('support_photos')
    .select('sort_order')
    .eq('support_case_id', photo.support_case_id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await db
    .from('support_photos')
    .update({ sort_order: (first?.sort_order ?? 0) - 1 })
    .eq('id', id)
  if (error) console.error('support cover', error)
  refresh(photo.support_case_id)
}
