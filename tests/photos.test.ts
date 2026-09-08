import { describe, expect, it } from 'vitest'
import {
  ALLOWED_PHOTO_MIME,
  MAX_PHOTO_BYTES,
  groupByStage,
  isPhotoStage,
  photoPublicUrl,
  photoRejection,
  sortPhotos,
  storagePathFor,
} from '@/lib/photos'

describe('قبول الملفّ', () => {
  it('يقبل الصور الثلاث في حدود الحجم', () => {
    for (const mime of ALLOWED_PHOTO_MIME) {
      expect(photoRejection(mime, 1024)).toBeNull()
      expect(photoRejection(mime, MAX_PHOTO_BYTES)).toBeNull()
    }
  })

  it('يرفض النوع الغريب قبل الحجم — الرسالة الأدقّ أوّلاً', () => {
    expect(photoRejection('application/pdf', 1024)).toBe('type')
    expect(photoRejection('image/gif', 1024)).toBe('type')
    expect(photoRejection('text/html', MAX_PHOTO_BYTES + 1)).toBe('type')
  })

  it('يرفض ما يفوق 8 MiB وما هو فارغ', () => {
    expect(photoRejection('image/jpeg', MAX_PHOTO_BYTES + 1)).toBe('size')
    expect(photoRejection('image/jpeg', 0)).toBe('empty')
  })
})

describe('المسار والرابط', () => {
  it('المسار يحمل الحالة والمرحلة والامتداد الصحيح', () => {
    const p = storagePathFor('11111111-2222-3333-4444-555555555555', 'progress', 'image/webp', 'abc123')
    expect(p).toMatch(/^11111111-2222-3333-4444-555555555555\/progress\/\d{14}-abc123\.webp$/)
  })

  it('نوع غير معروف يأخذ امتداداً محايداً بدل رمي خطأ', () => {
    expect(storagePathFor('c', 'before', 'image/tiff', 'x')).toMatch(/\.bin$/)
  })

  it('الرابط العمومي يُشتقّ ويتحمّل شرطة مائلة زائدة', () => {
    expect(photoPublicUrl('https://x.supabase.co/', 'c/after/1.jpg')).toBe(
      'https://x.supabase.co/storage/v1/object/public/case-photos/c/after/1.jpg'
    )
  })

  it('يميّز المرحلة الصالحة', () => {
    expect(isPhotoStage('before')).toBe(true)
    expect(isPhotoStage('during')).toBe(false)
    expect(isPhotoStage('')).toBe(false)
  })
})

describe('ترتيب الحكاية', () => {
  const photos = [
    { id: '1', stage: 'after' as const, sort_order: 0, taken_at: '2026-03-01' },
    { id: '2', stage: 'before' as const, sort_order: 0, taken_at: '2025-09-10' },
    { id: '3', stage: 'progress' as const, sort_order: 0, taken_at: '2026-01-15' },
    { id: '4', stage: 'progress' as const, sort_order: 0, taken_at: null },
    { id: '5', stage: 'progress' as const, sort_order: 0, taken_at: '2025-11-20' },
    { id: '6', stage: 'progress' as const, sort_order: -1, taken_at: '2026-02-01' },
  ]

  it('قبل ← أثناء ← بعد، وداخل المرحلة الترتيب اليدوي ثمّ التاريخ، وبلا تاريخ آخراً', () => {
    expect(sortPhotos(photos).map((p) => p.id)).toEqual(['2', '6', '5', '3', '4', '1'])
  })

  it('لا يعدّل المصفوفة الأصلية', () => {
    const copy = photos.slice()
    sortPhotos(photos)
    expect(photos).toEqual(copy)
  })

  it('التجميع يحذف المراحل الفارغة ويحافظ على الترتيب', () => {
    const groups = groupByStage(photos.filter((p) => p.stage !== 'after'))
    expect(groups.map((g) => g.stage)).toEqual(['before', 'progress'])
    expect(groups[1].photos.map((p) => p.id)).toEqual(['6', '5', '3', '4'])
  })
})
