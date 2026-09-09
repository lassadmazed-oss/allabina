import { describe, expect, it } from 'vitest'
import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  draftPathFor,
  finalPathFor,
  humanBytes,
  isDraftToken,
  kindOfMime,
  maxBytesFor,
  mediaRejection,
  newDraftToken,
} from '@/lib/property-media'

describe('ما يُقبل من الملفّات', () => {
  it('يميّز الصورة من الفيديو', () => {
    expect(kindOfMime('image/jpeg')).toBe('photo')
    expect(kindOfMime('video/mp4')).toBe('video')
    expect(kindOfMime('application/pdf')).toBeNull()
  })

  it('يرفض النوع غير المسموح مهما كان حجمه', () => {
    expect(mediaRejection('application/pdf', 1000)).toBe('type')
    expect(mediaRejection('text/html', 10)).toBe('type')
  })

  it('يرفض الفارغ', () => {
    expect(mediaRejection('image/png', 0)).toBe('empty')
  })

  it('حدّ الفيديو أوسع من حدّ الصورة — فيديو الهاتف أثقل', () => {
    expect(maxBytesFor('video')).toBeGreaterThan(maxBytesFor('photo'))
    expect(mediaRejection('image/png', MAX_PHOTO_BYTES + 1)).toBe('size')
    expect(mediaRejection('video/mp4', MAX_PHOTO_BYTES + 1)).toBeNull()
    expect(mediaRejection('video/mp4', MAX_VIDEO_BYTES + 1)).toBe('size')
  })

  it('يقبل ما هو على الحدّ تماماً', () => {
    expect(mediaRejection('image/png', MAX_PHOTO_BYTES)).toBeNull()
    expect(mediaRejection('video/mp4', MAX_VIDEO_BYTES)).toBeNull()
  })
})

describe('رمز المسوّدة والمسارات', () => {
  it('الرمز 24 حرفاً من حروف وأرقام صغيرة', () => {
    for (let i = 0; i < 20; i++) expect(isDraftToken(newDraftToken())).toBe(true)
  })

  it('يرفض رمزاً مشبوهاً — لا مسارات من عند المتصفّح', () => {
    expect(isDraftToken('../../etc')).toBe(false)
    expect(isDraftToken('short')).toBe(false)
    expect(isDraftToken('A'.repeat(24))).toBe(false)
  })

  it('مسار المسوّدة تحت مجلّد رمزه وحده', () => {
    const token = newDraftToken()
    const p = draftPathFor(token, 'image/jpeg', 'abc123')
    expect(p.startsWith(`drafts/${token}/`)).toBe(true)
    expect(p.endsWith('.jpg')).toBe(true)
  })

  it('لكلّ نوع امتداده', () => {
    const t = newDraftToken()
    expect(draftPathFor(t, 'video/quicktime', 'x')).toMatch(/\.mov$/)
    expect(draftPathFor(t, 'image/webp', 'x')).toMatch(/\.webp$/)
  })

  it('النقل يضع الملفّ تحت العقار ويحتفظ باسمه', () => {
    const draft = 'drafts/abcdefghij0123456789klmn/20260908120000-xyz.jpg'
    expect(finalPathFor('prop-1', draft)).toBe('properties/prop-1/20260908120000-xyz.jpg')
  })
})

describe('الحجم كما يقرؤه إنسان', () => {
  it('بايت وكيلوبايت وميغابايت', () => {
    expect(humanBytes(512)).toContain('بايت')
    expect(humanBytes(2048)).toContain('ك.ب')
    expect(humanBytes(5 * 1024 * 1024)).toContain('م.ب')
  })
})
