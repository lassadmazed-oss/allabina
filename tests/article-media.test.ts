import { describe, expect, it } from 'vitest'
import {
  MAX_ARTICLE_PHOTO_BYTES,
  articleMediaPath,
  isPublishable,
  mediaRejection,
  nextSortOrder,
  publishableOnly,
  sortMedia,
} from '@/lib/article-media'
import { formatSpecs, parseSpecs } from '@/lib/catalog'

/**
 * صور المقالات وحقوقها.
 *
 * «صور وحقوقها» في نصّ الكرّاس. والشرط هنا ليس تهذيباً: صورة بيت إنسان
 * آخر معروضة على أنّها إنجازنا كذبة، وصورة بلا ترخيص مسؤولية قانونية.
 * فالقاعدة تُفحص عند القراءة العمومية لا تُترك لانضباط من يرفع.
 */
describe('الحقوق شرط العرض', () => {
  it('صورة بمصدر وترخيص تُعرض', () => {
    expect(isPublishable({ credit: 'فريق اللَّبنة', license: 'ملك اللَّبنة' })).toBe(true)
  })

  it('ناقص واحد منهما: لا تُعرض', () => {
    expect(isPublishable({ credit: 'فريق اللَّبنة', license: null })).toBe(false)
    expect(isPublishable({ credit: null, license: 'ملك اللَّبنة' })).toBe(false)
    expect(isPublishable({ credit: null, license: null })).toBe(false)
  })

  it('فراغات بيضاء ليست إذناً', () => {
    expect(isPublishable({ credit: '   ', license: 'x' })).toBe(false)
  })

  it('الترشيح يُسقط ما لا إذن له ويبقي الباقي', () => {
    const list = [
      { id: 1, credit: 'أ', license: 'ب' },
      { id: 2, credit: null, license: 'ب' },
      { id: 3, credit: 'أ', license: 'ب' },
    ]
    expect(publishableOnly(list).map((m) => m.id)).toEqual([1, 3])
  })
})

describe('قبول الملفّ', () => {
  it('الأنواع الثلاثة تمرّ', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(mediaRejection(t, 1024), t).toBeNull()
    }
  })

  it('نوع آخر أو ملفّ فارغ أو كبير يُرفض بسبب مختلف', () => {
    expect(mediaRejection('application/pdf', 1024)).toBe('type')
    expect(mediaRejection('image/png', 0)).toBe('empty')
    expect(mediaRejection('image/png', MAX_ARTICLE_PHOTO_BYTES + 1)).toBe('size')
  })
})

describe('مسار الصورة', () => {
  it('يبدأ بمعرّف المقال وينتهي بامتداد النوع', () => {
    const p = articleMediaPath('abc-123', 'image/webp', 'xyz', new Date('2026-11-14T10:00:00Z'))
    expect(p).toBe('abc-123/20261114100000-xyz.webp')
  })

  it('نوع غريب لا يُنتج مساراً بلا امتداد', () => {
    expect(articleMediaPath('a', 'image/gif', 'r', new Date('2026-01-01T00:00:00Z'))).toMatch(/\.bin$/)
  })
})

describe('الترتيب', () => {
  it('حسب sort_order ثمّ المعرّف', () => {
    const list = [
      { id: 5, sortOrder: 1 },
      { id: 2, sortOrder: 0 },
      { id: 9, sortOrder: 1 },
    ]
    expect(sortMedia(list).map((m) => m.id)).toEqual([2, 5, 9])
  })

  it('الصورة الجديدة تأتي بعد الأخيرة لا مكانها', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([0, 1, 7])).toBe(8)
  })
})

describe('المواصفات سطراً سطراً', () => {
  it('«المفتاح: القيمة» يصير كائناً', () => {
    expect(parseSpecs('المقاس: 20×20×40 صم\nاللون: رمادي')).toEqual({
      'المقاس': '20×20×40 صم',
      'اللون': 'رمادي',
    })
  })

  it('سطر بلا نقطتين أو بقيمة فارغة يُتخطّى بلا رمي', () => {
    expect(parseSpecs('سطر بلا شيء\nالمقاس: 20\n: بلا مفتاح\nاللون:')).toEqual({ 'المقاس': '20' })
  })

  it('لا مواصفات = null لا كائن فارغ — فلا تظهر بطاقة بقسم فارغ', () => {
    expect(parseSpecs('')).toBeNull()
    expect(parseSpecs('بلا نقطتين')).toBeNull()
  })

  it('القيمة قد تحمل نقطتين — نقسم على الأولى وحدها', () => {
    expect(parseSpecs('التوقيت: 8:00')).toEqual({ 'التوقيت': '8:00' })
  })

  it('يعود كما كان بعد العرض والتحرير', () => {
    const specs = { 'المقاس': '20', 'اللون': 'رمادي' }
    expect(parseSpecs(formatSpecs(specs))).toEqual(specs)
  })
})
