'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { PHOTO_BUCKET, isPhotoStage, photoRejection, storagePathFor } from '@/lib/photos'

export type PhotoUploadState = {
  ok: boolean
  error?: 'type' | 'size' | 'empty' | 'stage' | 'case' | 'server' | 'forbidden'
}

function refresh(caseId: string) {
  revalidatePath(`/admin/cases`)
  revalidatePath(`/admin/cases?case=${caseId}`)
  revalidatePath('/ar/realisations')
  revalidatePath('/fr/realisations')
}

/**
 * رفع صورة إلى ألبوم حالة منجزة.
 *
 * الملفّ يمرّ من المتصفّح إلى هذا الخادم ثمّ إلى المخزن بمفتاح الخادم.
 * لا يلمس المتصفّح المخزن مباشرةً: هكذا نتحقّق من النوع والحجم والمرحلة
 * والصلاحية في مكان واحد، والمخزن نفسه يعيد التحقّق من الحجم والنوع
 * (حدود الـbucket في الهجرة 0019) — طبقتان لا واحدة.
 */
export async function uploadCasePhotoAction(
  _prev: PhotoUploadState,
  formData: FormData
): Promise<PhotoUploadState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'forbidden' }

  const caseId = String(formData.get('case_id') ?? '').trim()
  const stage = String(formData.get('stage') ?? '').trim()
  const file = formData.get('photo')

  if (!caseId) return { ok: false, error: 'case' }
  if (!isPhotoStage(stage)) return { ok: false, error: 'stage' }
  if (!(file instanceof File)) return { ok: false, error: 'empty' }

  const rejection = photoRejection(file.type, file.size)
  if (rejection) return { ok: false, error: rejection }

  const { data: parent } = await db
    .from('case_studies')
    .select('id')
    .eq('id', caseId)
    .maybeSingle()
  if (!parent) return { ok: false, error: 'case' }

  const path = storagePathFor(caseId, stage, file.type)
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: upErr } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '31536000', // المسار فريد فلا يتغيّر محتواه أبداً
    upsert: false,
  })
  if (upErr) {
    console.error('storage upload', upErr)
    return { ok: false, error: 'server' }
  }

  // آخر ترتيب في المرحلة + 1: الصورة الجديدة تلحق لا تتقدّم
  const { data: last } = await db
    .from('case_photos')
    .select('sort_order')
    .eq('case_id', caseId)
    .eq('stage', stage)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const str = (k: string) => String(formData.get(k) ?? '').trim() || null

  const { error } = await db.from('case_photos').insert({
    case_id: caseId,
    storage_path: path,
    stage,
    caption_ar: str('caption_ar'),
    caption_fr: str('caption_fr'),
    taken_at: str('taken_at'),
    sort_order: (last?.sort_order ?? -1) + 1,
    mime: file.type,
    bytes: file.size,
    created_by: actor.userId,
  })

  if (error) {
    // الصفّ لم يُكتب: نمسح الملفّ حتى لا يبقى يتيماً في المخزن
    console.error('case_photos insert', error)
    await db.storage.from(PHOTO_BUCKET).remove([path])
    return { ok: false, error: 'server' }
  }

  refresh(caseId)
  return { ok: true }
}

/** حذف صورة: الصفّ أوّلاً ثمّ الملفّ — العكس يترك رابطاً مكسوراً لو فشلت الخطوة الثانية */
export async function deleteCasePhotoAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('photo_id') ?? '').trim()
  if (!id) return

  const { data: photo } = await db
    .from('case_photos')
    .select('id, case_id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!photo) return

  const { error } = await db.from('case_photos').delete().eq('id', id)
  if (error) {
    console.error('case_photos delete', error)
    return
  }

  const { error: rmErr } = await db.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
  if (rmErr) console.error('storage remove (row already gone)', rmErr)

  refresh(photo.case_id)
}

/** تحيين التعليق والتاريخ والمرحلة والترتيب — بلا إعادة رفع */
export async function updateCasePhotoAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('photo_id') ?? '').trim()
  const stage = String(formData.get('stage') ?? '').trim()
  if (!id || !isPhotoStage(stage)) return

  const str = (k: string) => String(formData.get(k) ?? '').trim() || null
  const order = Number(String(formData.get('sort_order') ?? '0').trim())

  const { data: photo, error } = await db
    .from('case_photos')
    .update({
      stage,
      caption_ar: str('caption_ar'),
      caption_fr: str('caption_fr'),
      taken_at: str('taken_at'),
      sort_order: Number.isFinite(order) ? order : 0,
    })
    .eq('id', id)
    .select('case_id')
    .maybeSingle()

  if (error) console.error('case_photos update', error)
  if (photo) refresh(photo.case_id)
}
