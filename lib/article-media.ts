/**
 * صور المقالات — المنطق الخالص.
 *
 * كرّاس الشروط V2، القسم 03، في وصف بطاقة المقال: «صور **وحقوقها**».
 * فالحقوق ليست حقلاً اختيارياً يُملأ لاحقاً: صورة بلا مصدر وإذن لا
 * تخرج إلى الصفحة العمومية. القاعدة مكتوبة هنا وتُفحص عند القراءة
 * العمومية، لا تُترك لانضباط من يرفع.
 */

export const ARTICLE_MEDIA_BUCKET = 'article-media'

/** ستّ صور تكفي لمقال بناء: وجه، تفصيل، تركيب، نتيجة */
export const MAX_ARTICLE_PHOTOS = 6

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const ALLOWED_ARTICLE_MIME = Object.keys(EXT)
export const MAX_ARTICLE_PHOTO_BYTES = 5 * 1024 * 1024

export type MediaRejection = 'type' | 'size' | 'empty'

export function mediaRejection(mime: string, bytes: number): MediaRejection | null {
  if (!bytes) return 'empty'
  if (!ALLOWED_ARTICLE_MIME.includes(mime)) return 'type'
  if (bytes > MAX_ARTICLE_PHOTO_BYTES) return 'size'
  return null
}

export function articleMediaPath(
  articleId: string,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8),
  now: Date = new Date()
): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${articleId}/${stamp}-${random}.${EXT[mime] ?? 'bin'}`
}

export type ArticleMedia = {
  id: number
  storagePath: string
  altAr: string | null
  altFr: string | null
  credit: string | null
  license: string | null
  sortOrder: number
}

/**
 * هل تُعرض هذه الصورة للزائر؟
 * المصدر والإذن شرطان لا تفضيل: صورة بيت إنسان آخر معروضة على أنّها
 * إنجازنا كذبة، وصورة بلا ترخيص مسؤولية قانونية.
 */
export const isPublishable = (m: Pick<ArticleMedia, 'credit' | 'license'>): boolean =>
  Boolean(m.credit?.trim()) && Boolean(m.license?.trim())

export const publishableOnly = <T extends Pick<ArticleMedia, 'credit' | 'license'>>(list: T[]): T[] =>
  list.filter(isPublishable)

export function sortMedia<T extends Pick<ArticleMedia, 'sortOrder' | 'id'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

export const nextSortOrder = (existing: number[]): number =>
  existing.length ? Math.max(...existing) + 1 : 0
