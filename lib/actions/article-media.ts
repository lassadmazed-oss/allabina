'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import {
  ARTICLE_MEDIA_BUCKET,
  MAX_ARTICLE_PHOTOS,
  articleMediaPath,
  mediaRejection,
  nextSortOrder,
} from '@/lib/article-media'

/**
 * رفع صور المقال وحذفها.
 *
 * الملفّ يمرّ بالخادم: النوع والحجم والصلاحية تُفحص هنا، والمخزن يعيد
 * الفحص بحدوده. وصورة يفشل سطرها تُمسح من المخزن حتّى لا تبقى يتيمة
 * تأكل مساحة ولا يراها أحد.
 *
 * والمصدر والإذن يُطلبان عند الرفع لا بعده: من يرفع يعرف من أين جاءت
 * الصورة، ومن يراجع بعد أسبوع لا يعرف.
 */
export type MediaState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'article' | 'server' | 'forbidden' | 'too_many' | 'rights'
}

function refresh(code: string) {
  revalidatePath(`/admin/articles/${code}`)
  revalidatePath('/admin/bordereau')
  for (const l of ['ar', 'fr']) {
    revalidatePath(`/${l}/catalogue`)
    revalidatePath(`/${l}/catalogue/${code}`)
  }
}

export async function uploadArticleMediaAction(
  _prev: MediaState,
  formData: FormData
): Promise<MediaState> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { ok: false, error: 'forbidden' }

  const code = String(formData.get('code') ?? '').trim()
  const credit = String(formData.get('credit') ?? '').trim().slice(0, 200)
  const license = String(formData.get('license') ?? '').trim().slice(0, 120)
  const altAr = String(formData.get('alt_ar') ?? '').trim().slice(0, 200) || null
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)

  if (!code) return { ok: false, error: 'article' }
  if (!files.length) return { ok: false, error: 'empty' }
  if (files.length > MAX_ARTICLE_PHOTOS) return { ok: false, error: 'too_many' }
  // الحقوق شرط الرفع لا شرط النشر وحده
  if (!credit || !license) return { ok: false, error: 'rights' }
  for (const f of files) {
    const rejection = mediaRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: article } = await db.from('articles').select('id').eq('code', code).maybeSingle()
  if (!article) return { ok: false, error: 'article' }

  const { data: orders } = await db
    .from('article_media')
    .select('sort_order')
    .eq('article_id', article.id)
  let order = nextSortOrder((orders ?? []).map((o) => Number(o.sort_order)))

  let uploaded = 0
  for (const f of files) {
    const path = articleMediaPath(String(article.id), f.type)
    const { error: upErr } = await db.storage
      .from(ARTICLE_MEDIA_BUCKET)
      .upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type, upsert: false })
    if (upErr) {
      console.error('article media upload', upErr.message)
      continue
    }

    const { error: rowErr } = await db.from('article_media').insert({
      article_id: article.id,
      storage_path: path,
      alt_ar: altAr,
      credit,
      license,
      sort_order: order++,
      created_by: actor.userId,
    })
    if (rowErr) {
      // السطر فشل: الملفّ يُمسح حتّى لا يبقى في المخزن بلا أثر
      await db.storage.from(ARTICLE_MEDIA_BUCKET).remove([path])
      console.error('article media row', rowErr.message)
      continue
    }
    uploaded++
  }

  refresh(code)
  return uploaded ? { ok: true, uploaded } : { ok: false, error: 'server' }
}

export async function deleteArticleMediaAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const id = Number(formData.get('media_id'))
  const code = String(formData.get('code') ?? '').trim()
  if (!Number.isFinite(id)) return

  const { data: row } = await db
    .from('article_media')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!row) return

  const { error } = await db.storage
    .from(ARTICLE_MEDIA_BUCKET)
    .remove([String(row.storage_path)])
  if (error) console.warn('article media remove', error.message)

  await db.from('article_media').delete().eq('id', id)
  refresh(code)
}
