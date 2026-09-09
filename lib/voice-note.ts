/**
 * التسجيل الصوتي — القواعد النقيّة المشتركة بين الخادم والواجهة.
 *
 * لماذا: خانة «حكيلنا على مشكلتك بكلامك» تفترض أنّ صاحب المطلب يكتب.
 * وفي صفاقس من يعرف حكايته لا يكتبها بالضرورة: كبير في السنّ، أو من
 * يقرأ ولا يكتب بيسر، أو من يجد الدارجة أسهل نطقاً منها كتابةً. فيترك
 * الخانة فارغة، ويصل الملفّ إلى الفريق بلا الحكاية — وهي أهمّ ما فيه.
 *
 * الصوت **يزيد** ولا يعوّض: النصّ يبقى قابلاً للبحث والفرز، والتسجيل
 * يُسمَع. من يكتب يكتب، ومن يحكي يحكي، ومن يفعل الاثنين أفضل.
 */

import { isDraftToken, newDraftToken, pathStamp } from '@/lib/draft-token'

export { isDraftToken, newDraftToken }

export const VOICE_BUCKET = 'voice-notes'

/** ثلاث دقائق: تكفي لحكاية، ولا تصير ملفّاً لا أحد يسمعه إلى آخره */
export const MAX_SECONDS = 180
/** 8 MiB — أكبر بكثير من ثلاث دقائق opus، فالحدّ الحقيقي هو الزمن */
export const MAX_BYTES = 8 * 1024 * 1024

/**
 * ما تنتجه المتصفّحات فعلاً: Chrome وFirefox يعطيان webm/opus،
 * وSafari يعطي mp4. نقبل الأربعة ونشتقّ الامتداد من النوع.
 */
const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
}

export const ALLOWED_VOICE_MIME = Object.keys(EXT_BY_MIME)

/**
 * MediaRecorder يعيد النوع بمعاملاته: `audio/webm;codecs=opus`.
 * المخزن يقارن النوع حرفياً، فنقصّ ما بعد الفاصلة المنقوطة قبل أيّ شيء.
 */
export const baseMime = (mime: string) => mime.split(';')[0].trim().toLowerCase()

export type VoiceRejection = 'empty' | 'type' | 'size' | 'tooLong'

/** لماذا يُرفض التسجيل — أو null إن كان مقبولاً */
export function voiceRejection(
  mime: string,
  bytes: number,
  seconds?: number
): VoiceRejection | null {
  if (!bytes || bytes <= 0) return 'empty'
  if (!EXT_BY_MIME[baseMime(mime)]) return 'type'
  if (bytes > MAX_BYTES) return 'size'
  // الزمن اختياري: بعض المتصفّحات لا تعطيه إلّا بعد فكّ الترميز
  if (seconds != null && seconds > MAX_SECONDS + 2) return 'tooLong'
  return null
}

/** المكان الذي ينتمي إليه التسجيل — يحدّد المجلّد والعمود معاً */
export const VOICE_SUBJECTS = ['request', 'property', 'intervenant'] as const
export type VoiceSubject = (typeof VOICE_SUBJECTS)[number]

export const isVoiceSubject = (v: string): v is VoiceSubject =>
  (VOICE_SUBJECTS as readonly string[]).includes(v)

/** عمود المفتاح الخارجي لكلّ موضوع — القاعدة تضمن أنّ واحداً منها فقط يُملأ */
export const SUBJECT_COLUMN: Record<VoiceSubject, string> = {
  request: 'request_id',
  property: 'property_id',
  intervenant: 'intervenant_id',
}

/**
 * مسار المسوّدة: drafts/<token>/<time>-<random>.<ext>
 * وبعد إنشاء السطر يُنقل إلى <subject>s/<id>/… — المسار يقول لمن الملفّ.
 */
export function draftVoicePath(
  token: string,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8),
  now?: Date
): string {
  const ext = EXT_BY_MIME[baseMime(mime)] ?? 'bin'
  return `drafts/${token}/${pathStamp(now)}-${random}.${ext}`
}

export const finalVoicePath = (
  subject: VoiceSubject,
  id: string,
  draftPath: string
): string => `${subject}s/${id}/${draftPath.split('/').pop()}`

/** «2:07» — الثواني وحدها لا تُقرأ بسرعة، والدقائق تُقرأ */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
