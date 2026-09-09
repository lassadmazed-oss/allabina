'use server'

import { headers } from 'next/headers'
import { db } from '@/lib/supabase/server'
import {
  MAX_SECONDS,
  SUBJECT_COLUMN,
  VOICE_BUCKET,
  baseMime,
  draftVoicePath,
  finalVoicePath,
  isDraftToken,
  newDraftToken,
  voiceRejection,
  type VoiceRejection,
  type VoiceSubject,
} from '@/lib/voice-note'

export type VoiceSlot = { ok: true; token: string; path: string; url: string }
export type VoiceSlotError = {
  ok: false
  error: VoiceRejection | 'rateLimited' | 'server'
}

const recent = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
/** تسجيل لكلّ خانة، وإعادة المحاولة مرّات — لا أكثر */
const MAX_PER_WINDOW = 15

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > MAX_PER_WINDOW
}

/**
 * يوقّع رابط رفع لتسجيل واحد.
 *
 * نفس مبدأ وسائط العقار: الخادم يقرّر المسار، والمتصفّح يرفع إلى ذلك
 * المسار وحده وبرابط ينتهي. وعند الإرسال نقرأ محتوى مجلّد المسوّدة من
 * المخزن نفسه، لا من قائمة يرسلها المتصفّح.
 */
export async function createVoiceSlot(input: {
  token?: string
  mime: string
  bytes: number
  seconds?: number
}): Promise<VoiceSlot | VoiceSlotError> {
  const rejection = voiceRejection(input.mime, input.bytes, input.seconds)
  if (rejection) return { ok: false, error: rejection }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip)) return { ok: false, error: 'rateLimited' }

  const token = input.token && isDraftToken(input.token) ? input.token : newDraftToken()
  const path = draftVoicePath(token, input.mime)

  const { data, error } = await db.storage.from(VOICE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('signed voice upload url', error)
    return { ok: false, error: 'server' }
  }

  return { ok: true, token, path, url: data.signedUrl }
}

/** حذف تسجيل من المسوّدة — أعاد التسجيل أو غيّر رأيه قبل الإرسال */
export async function discardVoiceDraft(token: string, path: string): Promise<boolean> {
  if (!isDraftToken(token)) return false
  if (!path.startsWith(`drafts/${token}/`)) return false

  const { error } = await db.storage.from(VOICE_BUCKET).remove([path])
  if (error) console.error('discard voice draft', error)
  return !error
}

/**
 * ينقل تسجيلات المسوّدة إلى السطر بعد إنشائه ويسجّلها.
 *
 * المصدر الوحيد للحقيقة هو المخزن: نسرد ما تحت drafts/<token>/ فعلاً.
 * ولا يرمي أبداً — مطلب محفوظ بلا تسجيل أهون من استمارة تسقط بعد أن
 * حكى صاحبها حكايته.
 */
export async function attachVoiceNotes(
  subject: VoiceSubject,
  subjectId: string,
  token: string,
  field: string,
  /** الأزمنة التي قاسها المتصفّح: مسار المسوّدة ← ثوانٍ. للعرض فقط. */
  durations: Record<string, number> = {}
): Promise<number> {
  if (!isDraftToken(token) || !subjectId) return 0

  const storage = db.storage.from(VOICE_BUCKET)
  const { data: files, error } = await storage.list(`drafts/${token}`, { limit: 20 })
  if (error || !files?.length) {
    if (error) console.error('list voice drafts', error)
    return 0
  }

  const column = SUBJECT_COLUMN[subject]
  let attached = 0

  for (const f of files) {
    const from = `drafts/${token}/${f.name}`
    const mime = baseMime(String(f.metadata?.mimetype ?? ''))
    const bytes = Number(f.metadata?.size ?? 0)

    // المخزن يحرس النوع والحجم، ونحرسهما هنا ثانيةً: طبقتان لا واحدة
    if (voiceRejection(mime, bytes)) {
      await storage.remove([from])
      continue
    }

    const to = finalVoicePath(subject, subjectId, from)
    const { error: moveErr } = await storage.move(from, to)
    if (moveErr) {
      console.error('move voice note', moveErr)
      continue
    }

    const seconds = Number(durations[from])
    const { error: rowErr } = await db.from('voice_notes').insert({
      [column]: subjectId,
      field,
      storage_path: to,
      mime,
      bytes,
      duration_s:
        Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, MAX_SECONDS) : null,
    })
    if (rowErr) console.error('insert voice_notes', rowErr)
    else attached++
  }

  return attached
}

/** رابط موقّت للاستماع في الـBack-office — المخزن خاصّ، لا رابط عمومي */
export async function signedVoiceUrl(
  storagePath: string,
  seconds = 3600
): Promise<string | null> {
  const { data, error } = await db.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(storagePath, seconds)
  if (error) {
    console.error('signed voice url', error)
    return null
  }
  return data?.signedUrl ?? null
}
