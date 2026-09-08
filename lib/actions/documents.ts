'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  DOCUMENT_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  documentRejection,
  storagePathFor,
} from '@/lib/documents'

export type DocumentUploadState = {
  ok: boolean
  error?: 'type' | 'size' | 'empty' | 'doc_type' | 'request' | 'server' | 'forbidden'
}

/**
 * رفع وثيقة إلى ملفّ مطلب.
 *
 * الوثيقة شخصية، فالمسار: متصفّح عضو الفريق ← هذا الخادم ← مخزن خاصّ.
 * المخزن لا يقبل كتابة من غير مفتاح الخادم، ولا قراءة بلا رابط موقّع.
 * الاسم الأصلي يُحفظ في القاعدة للعرض، ولا يظهر في مسار التخزين.
 */
export async function uploadRequestFileAction(
  _prev: DocumentUploadState,
  formData: FormData
): Promise<DocumentUploadState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'forbidden' }

  const requestId = String(formData.get('request_id') ?? '').trim()
  const docType = String(formData.get('doc_type') ?? '').trim()
  const file = formData.get('file')

  if (!requestId) return { ok: false, error: 'request' }
  if (!docType) return { ok: false, error: 'doc_type' }
  if (!(file instanceof File)) return { ok: false, error: 'empty' }

  const rejection = documentRejection(file.type, file.size)
  if (rejection) return { ok: false, error: rejection }

  const { data: parent } = await db
    .from('housing_requests')
    .select('id')
    .eq('id', requestId)
    .maybeSingle()
  if (!parent) return { ok: false, error: 'request' }

  const path = storagePathFor(requestId, docType, file.type)
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: upErr } = await db.storage.from(DOCUMENT_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '0', // خاصّ: لا يُخزَّن في أيّ وسيط
    upsert: false,
  })
  if (upErr) {
    console.error('document upload', upErr)
    return { ok: false, error: 'server' }
  }

  const { error } = await db.from('request_files').insert({
    request_id: requestId,
    doc_type: docType,
    storage_path: path,
    original_name: file.name.slice(0, 200) || 'document',
    mime: file.type,
    bytes: file.size,
    note: String(formData.get('note') ?? '').trim() || null,
    uploaded_by: actor.userId,
  })

  if (error) {
    console.error('request_files insert', error)
    await db.storage.from(DOCUMENT_BUCKET).remove([path])
    return { ok: false, error: 'server' }
  }

  // الوثيقة صارت موجودة فعلاً: قائمة التحقّق تتبع الواقع
  await db
    .from('request_documents')
    .upsert(
      { request_id: requestId, doc_type: docType, available: true },
      { onConflict: 'request_id,doc_type' }
    )

  await db.from('request_events').insert({
    request_id: requestId,
    event_type: 'note',
    actor: actor.userId,
    note: `رُفعت وثيقة: ${docType}`,
  })

  revalidatePath(`/admin/${requestId}`)
  return { ok: true }
}

/** حذف وثيقة: الصفّ أوّلاً ثمّ الملفّ */
export async function deleteRequestFileAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('file_id') ?? '').trim()
  if (!id) return

  const { data: f } = await db
    .from('request_files')
    .select('id, request_id, doc_type, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!f) return

  const { error } = await db.from('request_files').delete().eq('id', id)
  if (error) {
    console.error('request_files delete', error)
    return
  }

  const { error: rmErr } = await db.storage.from(DOCUMENT_BUCKET).remove([f.storage_path])
  if (rmErr) console.error('document remove (row already gone)', rmErr)

  await db.from('request_events').insert({
    request_id: f.request_id,
    event_type: 'note',
    actor: actor.userId,
    note: `حُذفت وثيقة: ${f.doc_type}`,
  })

  revalidatePath(`/admin/${f.request_id}`)
}

/**
 * رابط موقّع لفتح وثيقة — يُولَّد عند الطلب لعضو فريق مصادَق عليه،
 * ويموت بعد دقائق. لا يُخزَّن ولا يُرسَل في بريد.
 */
export async function signedDocumentUrlAction(fileId: string): Promise<string | null> {
  const actor = await staffWithPermission('requests.read')
  if (!actor) return null

  const { data: f } = await db
    .from('request_files')
    .select('storage_path, original_name')
    .eq('id', fileId)
    .maybeSingle()
  if (!f) return null

  const { data, error } = await db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(f.storage_path, SIGNED_URL_TTL_SECONDS, { download: f.original_name })

  if (error) {
    console.error('signed url', error)
    return null
  }
  return data.signedUrl
}
