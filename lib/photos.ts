/**
 * صور الحالات المنجزة — القواعد النقيّة المشتركة بين الخادم والواجهة.
 *
 * ما يقرّر هنا: أيّ ملفّ يُقبل، أين يُخزَّن، وبأيّ ترتيب تُحكى القصّة.
 * الرفع نفسه في lib/actions/photos.ts.
 */

export const PHOTO_BUCKET = 'case-photos'

/** المراحل بترتيب الحكاية: قبل ← أثناء ← بعد */
export const PHOTO_STAGES = ['before', 'progress', 'after'] as const
export type PhotoStage = (typeof PHOTO_STAGES)[number]

/** 8 MiB — نفس حدّ المخزن في الهجرة 0019 حتى لا يقول الخادم نعم والمخزن لا */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const ALLOWED_PHOTO_MIME = Object.keys(EXT_BY_MIME)

export type PhotoRejection = 'type' | 'size' | 'empty'

/** لماذا يُرفض الملفّ — أو null إن كان مقبولاً */
export function photoRejection(mime: string, bytes: number): PhotoRejection | null {
  if (!bytes || bytes <= 0) return 'empty'
  if (!(mime in EXT_BY_MIME)) return 'type'
  if (bytes > MAX_PHOTO_BYTES) return 'size'
  return null
}

export const isPhotoStage = (s: string): s is PhotoStage =>
  (PHOTO_STAGES as readonly string[]).includes(s)

/**
 * مسار الملفّ في المخزن: <case>/<stage>/<time>-<random>.<ext>
 * التاريخ في الاسم يرتّب الملفّات عند التصفّح المباشر للمخزن،
 * والعشوائي يمنع التصادم عند رفع صورتين في نفس الثانية.
 */
export function storagePathFor(
  caseId: string,
  stage: PhotoStage,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8)
) {
  const ext = EXT_BY_MIME[mime] ?? 'bin'
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${caseId}/${stage}/${stamp}-${random}.${ext}`
}

/** الرابط العمومي يُشتقّ لا يُخزَّن: تغيير المشروع ما يكسّرش الصور */
export const photoPublicUrl = (baseUrl: string, storagePath: string) =>
  `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`

export type CasePhoto = {
  id: string
  case_id: string
  storage_path: string
  stage: PhotoStage
  caption_ar: string | null
  caption_fr: string | null
  taken_at: string | null
  sort_order: number
}

const STAGE_RANK: Record<PhotoStage, number> = { before: 0, progress: 1, after: 2 }

/**
 * ترتيب الحكاية: المرحلة أوّلاً، ثمّ ترتيب الإدارة اليدوي، ثمّ تاريخ اللقطة.
 * الصورة بلا تاريخ تجي آخر مرحلتها لا أوّلها.
 */
export function sortPhotos<T extends Pick<CasePhoto, 'stage' | 'sort_order' | 'taken_at'>>(
  photos: T[]
): T[] {
  return photos.slice().sort((a, b) => {
    const s = STAGE_RANK[a.stage] - STAGE_RANK[b.stage]
    if (s !== 0) return s
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    if (!a.taken_at && !b.taken_at) return 0
    if (!a.taken_at) return 1
    if (!b.taken_at) return -1
    return a.taken_at.localeCompare(b.taken_at)
  })
}

/** تجميع حسب المرحلة للعرض — المراحل الفارغة تُحذف */
export function groupByStage<T extends Pick<CasePhoto, 'stage' | 'sort_order' | 'taken_at'>>(
  photos: T[]
): { stage: PhotoStage; photos: T[] }[] {
  const sorted = sortPhotos(photos)
  return PHOTO_STAGES.map((stage) => ({
    stage,
    photos: sorted.filter((p) => p.stage === stage),
  })).filter((g) => g.photos.length > 0)
}
