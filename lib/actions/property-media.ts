'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/supabase/server'
import {
  PROPERTY_MEDIA_BUCKET,
  draftPathFor,
  finalPathFor,
  isDraftToken,
  kindOfMime,
  mediaRejection,
  newDraftToken,
  type MediaRejection,
} from '@/lib/property-media'

export type UploadSlot = {
  ok: true
  token: string
  path: string
  url: string
}

export type UploadSlotError = {
  ok: false
  error: MediaRejection | 'token' | 'rateLimited' | 'server'
}

const recent = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 40 // عشر صور وفيديوهان لعرضين أو ثلاثة

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > MAX_PER_WINDOW
}

/**
 * يوقّع رابط رفع لملفّ واحد.
 *
 * الخادم هو من يقرّر المسار والنوع والحجم؛ المتصفّح يرفع إلى ذلك المسار
 * وحده وبرابط ينتهي. لو أرسل المتصفّح مساراً من عنده، لا قيمة له: عند
 * إرسال الاستمارة نقرأ محتوى مجلّد المسوّدة من المخزن نفسه لا من النموذج.
 */
export async function createUploadSlot(input: {
  token?: string
  mime: string
  bytes: number
}): Promise<UploadSlot | UploadSlotError> {
  const rejection = mediaRejection(input.mime, input.bytes)
  if (rejection) return { ok: false, error: rejection }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip)) return { ok: false, error: 'rateLimited' }

  const token = input.token && isDraftToken(input.token) ? input.token : newDraftToken()
  const path = draftPathFor(token, input.mime)

  const { data, error } = await db.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('signed upload url', error)
    return { ok: false, error: 'server' }
  }

  return { ok: true, token, path, url: data.signedUrl }
}

/** حذف ملفّ من المسوّدة — المالك غيّر رأيه قبل الإرسال */
export async function discardDraftFile(token: string, path: string): Promise<boolean> {
  if (!isDraftToken(token)) return false
  if (!path.startsWith(`drafts/${token}/`)) return false

  const { error } = await db.storage.from(PROPERTY_MEDIA_BUCKET).remove([path])
  if (error) console.error('discard draft file', error)
  return !error
}

/**
 * ينقل ملفّات المسوّدة إلى العقار بعد إنشائه ويسجّلها.
 *
 * المصدر الوحيد للحقيقة هو المخزن: نسرد ما تحت drafts/<token>/ فعلاً،
 * ولا نثق بقائمة يرسلها المتصفّح. لا يرمي أبداً — عقار محفوظ بلا صور
 * أهون من استمارة تسقط بعد أن عمّرها صاحبها.
 */
/** اسم كما سمّاه صاحبه — للعرض فقط، فننظّفه ونقصّه ولا نبني عليه شيئاً */
function safeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const clean = raw
    .split('')
    .filter((ch) => ch >= ' ' && ch !== '/' && ch.charCodeAt(0) !== 92)
    .join('')
    .trim()
    .slice(0, 120)
  return clean || null
}

export async function attachDraftMedia(
  propertyId: string,
  token: string,
  /** مسار المسوّدة ← اسم الملفّ عند صاحبه. المحتوى يبقى من المخزن لا من هنا. */
  originalNames: Record<string, string> = {}
): Promise<number> {
  if (!isDraftToken(token)) return 0

  const storage = db.storage.from(PROPERTY_MEDIA_BUCKET)
  const { data: files, error } = await storage.list(`drafts/${token}`, { limit: 100 })
  if (error || !files?.length) {
    if (error) console.error('list draft media', error)
    return 0
  }

  let attached = 0
  let order = 0

  for (const f of files) {
    const from = `drafts/${token}/${f.name}`
    const mime = String(f.metadata?.mimetype ?? '')
    const bytes = Number(f.metadata?.size ?? 0)
    const kind = kindOfMime(mime)

    // المخزن يحرس نوعه وحجمه، ونحرسهما هنا ثانيةً: طبقتان لا واحدة
    if (!kind || mediaRejection(mime, bytes)) {
      await storage.remove([from])
      continue
    }

    const to = finalPathFor(propertyId, from)
    const { error: moveErr } = await storage.move(from, to)
    if (moveErr) {
      console.error('move property media', moveErr)
      continue
    }

    const { error: rowErr } = await db.from('property_media').insert({
      property_id: propertyId,
      kind,
      storage_path: to,
      original_name: safeName(originalNames[from]),
      mime,
      bytes,
      sort_order: order++,
    })
    if (rowErr) console.error('insert property_media', rowErr)
    else attached++
  }

  return attached
}

/** رابط موقّت لعرض ملفّ في الـBack-office — المخزن خاصّ، لا رابط عمومي */
export async function signedMediaUrl(storagePath: string, seconds = 3600): Promise<string | null> {
  const { data, error } = await db.storage
    .from(PROPERTY_MEDIA_BUCKET)
    .createSignedUrl(storagePath, seconds)
  if (error) {
    console.error('signed media url', error)
    return null
  }
  return data?.signedUrl ?? null
}
