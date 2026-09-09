import { photoPublicUrl, sortPhotos, type CasePhoto } from '@/lib/photos'

/**
 * صورة الغلاف لبطاقة الحالة.
 *
 * الترتيب مقصود: «بعد» أوّلاً لأنّها النتيجة التي تستحقّ أن تُرى في الشبكة،
 * ثمّ «أثناء» ثمّ «قبل». وإن لم يكن للحالة ألبوم بعد، نرجع للرابطين القديمين
 * (photo_after ثمّ photo_before) حتّى لا تفقد الحالات القديمة صورتها.
 */
export function coverFor(
  photos: CasePhoto[],
  fallback: { photo_after?: string | null; photo_before?: string | null },
  baseUrl: string
): { url: string; count: number } | null {
  const sorted = sortPhotos(photos)
  const pick =
    sorted.find((p) => p.stage === 'after') ??
    sorted.find((p) => p.stage === 'progress') ??
    sorted[0]

  if (pick) return { url: photoPublicUrl(baseUrl, pick.storage_path), count: sorted.length }

  const legacy = fallback.photo_after || fallback.photo_before
  return legacy ? { url: legacy, count: 0 } : null
}

/** سطر المعطيات تحت العنوان: سنة · مساحة · مدّة — بلا فراغات ميّتة */
export function metaLine(
  parts: { completedAt?: string | null; areaM2?: number | null; months?: number | null },
  labels: { m2: string; months: string }
): string {
  return [
    parts.completedAt ? parts.completedAt.slice(0, 4) : null,
    parts.areaM2 ? `${Math.round(Number(parts.areaM2))} ${labels.m2}` : null,
    parts.months ? `${parts.months} ${labels.months}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
