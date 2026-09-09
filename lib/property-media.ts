/**
 * وسائط العقار — القواعد النقيّة المشتركة بين الخادم والواجهة.
 *
 * لماذا يختلف الرفع هنا عن وثائق المطلب وصور الحالات؟
 * هناك يمرّ الملفّ من المتصفّح إلى الخادم ثمّ إلى المخزن. هنا لا:
 * الفيديو من هاتف قد يبلغ عشرات الميغابايتات، وحدّ جسم الطلب في
 * الاستضافة (4.5 MB على Vercel) يقطع الطريق قبل أن يصل الخادم.
 * فالخادم يوقّع رابط رفع لمسار يحدّده هو، والمتصفّح يرفع إلى ذلك
 * المسار وحده. المتصفّح لا يختار أين يكتب، ولا يبقى الرابط صالحاً.
 */

import { pathStamp } from '@/lib/draft-token'

export const PROPERTY_MEDIA_BUCKET = 'property-media'

export const MEDIA_KINDS = ['photo', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/** 8 MiB للصورة · 50 MiB للفيديو — نفس حدود المخزن في الهجرة 0026 */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/** ما يقبله المالك في استمارة واحدة */
export const MAX_PHOTOS = 10
export const MAX_VIDEOS = 2

const EXT_BY_MIME: Record<string, { ext: string; kind: MediaKind }> = {
  'image/jpeg': { ext: 'jpg', kind: 'photo' },
  'image/png': { ext: 'png', kind: 'photo' },
  'image/webp': { ext: 'webp', kind: 'photo' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
}

export const ALLOWED_MEDIA_MIME = Object.keys(EXT_BY_MIME)

export const kindOfMime = (mime: string): MediaKind | null =>
  EXT_BY_MIME[mime]?.kind ?? null

export const maxBytesFor = (kind: MediaKind) =>
  kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES

export type MediaRejection = 'empty' | 'type' | 'size'

/** لماذا يُرفض الملفّ — أو null إن كان مقبولاً */
export function mediaRejection(mime: string, bytes: number): MediaRejection | null {
  if (!bytes || bytes <= 0) return 'empty'
  const entry = EXT_BY_MIME[mime]
  if (!entry) return 'type'
  if (bytes > maxBytesFor(entry.kind)) return 'size'
  return null
}

// رمز المسوّدة مشترك مع التسجيلات الصوتية — قاعدة واحدة لا نسختان
export { isDraftToken, newDraftToken } from '@/lib/draft-token'

/**
 * مسار الملفّ قبل إنشاء العقار: drafts/<token>/<time>-<random>.<ext>
 * وبعد الإنشاء يُنقل إلى properties/<id>/… — المسار يقول لمن الملفّ.
 */
export function draftPathFor(
  token: string,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8)
): string {
  const ext = EXT_BY_MIME[mime]?.ext ?? 'bin'
  const stamp = pathStamp()
  return `drafts/${token}/${stamp}-${random}.${ext}`
}

export const finalPathFor = (propertyId: string, draftPath: string): string =>
  `properties/${propertyId}/${draftPath.split('/').pop()}`

/** حجم مقروء للإنسان — «4.2 م.ب» لا «4404019 بايت» */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
}
