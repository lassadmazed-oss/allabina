/**
 * صور تقدّم الأشغال في ملفّ المطلب — القواعد النقيّة المشتركة بين الخادم والواجهة.
 *
 * ما يقرّر هنا: مراحل البناء بترتيبها، مسار الملفّ في المخزن، ترتيب الألبوم،
 * وأيّ صورة تمثّل الملفّ على بطاقته. الرفع نفسه في lib/actions/request-photos.ts.
 * قبول الملفّ (النوع والحجم) هو نفسه قاعدة صور الحالات: lib/photos.ts.
 */

/** مخزن خاصّ — دار الحريف ليست صفحة عمومية (الهجرة 0048) */
export const REQUEST_PHOTO_BUCKET = 'request-photos'

/** مراحل البناء بترتيبها من الأرض إلى المفتاح */
export const PROGRESS_STAGES = ['site', 'foundations', 'structure', 'roof', 'masonry', 'finishing', 'handover'] as const
export type ProgressStage = (typeof PROGRESS_STAGES)[number]

export const PROGRESS_STAGE_AR: Record<ProgressStage, string> = {
  site: 'الأرض قبل البداية',
  foundations: 'الأساسات',
  structure: 'الهيكل',
  roof: 'السقف',
  masonry: 'البناء والشبكات',
  finishing: 'التشطيب',
  handover: 'التسليم',
}

/** دفعة واحدة تبقى تحت حدّ جسم الطلب (16 ميغا في next.config) */
export const MAX_PHOTOS_PER_UPLOAD = 6

export const isProgressStage = (s: string): s is ProgressStage =>
  (PROGRESS_STAGES as readonly string[]).includes(s)

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * مسار الملفّ: <المطلب>/<المرحلة>/<الوقت>-<عشوائي>.<الامتداد>
 * الوقت يرتّب التصفّح المباشر للمخزن، والعشوائي يمنع تصادم صورتين في نفس الثانية.
 */
export function requestPhotoPath(
  requestId: string,
  stage: ProgressStage,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8),
  now: Date = new Date()
): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${requestId}/${stage}/${stamp}-${random}.${EXT[mime] ?? 'bin'}`
}

export type RequestPhoto = {
  id: string
  request_id: string
  storage_path: string
  stage: ProgressStage
  caption: string | null
  taken_at: string | null
  show_to_client: boolean
  sort_order: number
  created_at: string
}

const RANK: Record<ProgressStage, number> = Object.fromEntries(PROGRESS_STAGES.map((s, i) => [s, i])) as Record<
  ProgressStage,
  number
>

/** تاريخ اللقطة إن وُجد، وإلّا تاريخ الرفع */
const when = (p: Pick<RequestPhoto, 'taken_at' | 'created_at'>) => p.taken_at ?? p.created_at.slice(0, 10)

/** ترتيب الحكاية: المرحلة، ثمّ الترتيب اليدوي، ثمّ التاريخ */
export function sortProgress<T extends Pick<RequestPhoto, 'stage' | 'sort_order' | 'taken_at' | 'created_at'>>(
  photos: T[]
): T[] {
  return photos.slice().sort((a, b) => {
    const s = RANK[a.stage] - RANK[b.stage]
    if (s !== 0) return s
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return when(a).localeCompare(when(b))
  })
}

export type ProgressSummary<T> = {
  count: number
  /** أبعد مرحلة وصلتها الصور — «وين وصلت الحضيرة» */
  latestStage: ProgressStage | null
  byStage: Record<ProgressStage, number>
  /** صورة البطاقة: الأحدث في أبعد مرحلة */
  cover: T | null
}

export function progressSummary<T extends Pick<RequestPhoto, 'stage' | 'taken_at' | 'created_at'>>(
  photos: T[]
): ProgressSummary<T> {
  const byStage = Object.fromEntries(PROGRESS_STAGES.map((s) => [s, 0])) as Record<ProgressStage, number>
  let cover: T | null = null
  for (const p of photos) {
    byStage[p.stage] += 1
    if (
      !cover ||
      RANK[p.stage] > RANK[cover.stage] ||
      (RANK[p.stage] === RANK[cover.stage] && when(p) > when(cover))
    ) {
      cover = p
    }
  }
  return { count: photos.length, latestStage: cover?.stage ?? null, byStage, cover }
}
