import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_HIDDEN,
  TRACKS,
  TRACK_SEGMENTS,
  isHidden,
  parseHidden,
  visibleLinks,
} from '@/lib/site-tracks'

/**
 * مسارات الموقع العمومي.
 *
 * 15/11/2026: مسارات المساندة والعقارات والشبكة والمحاكي حُذفت من
 * الشفرة — لم تَعُد تُخبّى. وبقي ما يُخبّى اثنان.
 * والتخبئة إمّا تامّة أو ليست تخبئة: رابطٌ يُحذف من القائمة ويبقى
 * يفتح بالعنوان مخفيٌّ عمّن لا يعرف، لا مخبّأ.
 */
describe('قراءة الإعداد', () => {
  it('المصفوفة تُقرأ، والتكرار يُطوى', () => {
    expect(parseHidden(['standing', 'standing', 'systemes'])).toEqual(['standing', 'systemes'])
  })

  it('قيمة غريبة تُهمَل وحدها ولا تُسقط البقيّة', () => {
    expect(parseHidden(['standing', 'admin', 'كل شي'])).toEqual(['standing'])
  })

  it('وما ليس مصفوفةً يرجع للافتراضي — لا نفتح كلّ شيء لأنّ قيمةً تلفت', () => {
    expect(parseHidden(null)).toEqual(DEFAULT_HIDDEN)
    expect(parseHidden('standing')).toEqual(DEFAULT_HIDDEN)
    expect(parseHidden(undefined)).toEqual(DEFAULT_HIDDEN)
    expect(parseHidden({})).toEqual(DEFAULT_HIDDEN)
  })

  it('ومصفوفة فارغة تعني «ما فمّاش مخبّأ» لا الافتراضي', () => {
    expect(parseHidden([])).toEqual([])
  })
})

describe('من يُخبّأ', () => {
  const hidden = parseHidden(['standing', 'systemes'])

  it('المقطع والمسار الكامل سواء', () => {
    expect(isHidden('standing', hidden)).toBe(true)
    expect(isHidden('/standing', hidden)).toBe(true)
    expect(isHidden('/ar/standing', hidden)).toBe(true)
  })

  it('والصفحة الفرعية تتبع أصلها', () => {
    expect(isHidden('/ar/systemes/TRAD', hidden)).toBe(true)
    expect(isHidden('/fr/systemes/12', hidden)).toBe(true)
  })

  it('وما ليس مخبّأً يبقى', () => {
    expect(isHidden('/ar/catalogue', hidden)).toBe(false)
    expect(isHidden('/ar/demande', hidden)).toBe(false)
    expect(isHidden('/', hidden)).toBe(false)
    expect(isHidden('', hidden)).toBe(false)
  })

  it('ترشيح الروابط يمسّ المخبّأ وحده', () => {
    const links = [
      { href: '/ar/demande' },
      { href: '/ar/standing' },
      { href: '/ar/systemes' },
      { href: '/ar/catalogue' },
    ]
    expect(visibleLinks(links, hidden).map((l) => l.href)).toEqual([
      '/ar/demande',
      '/ar/catalogue',
    ])
  })
})

describe('ما يجوز تخبئته', () => {
  it('الكاتالوج والمطلب والمتابعة والحساب ليست منه — بدونها لا موقع', () => {
    for (const s of ['catalogue', 'demande', 'suivi', 'compte', 'mentions-legales', 'a-propos']) {
      expect(TRACK_SEGMENTS).not.toContain(s)
    }
  })

  it('وكلّ مسار قابل للتخبئة له اسم وسبب يُقرأ قبل القرار', () => {
    for (const t of TRACKS) {
      expect(t.labelAr.length).toBeGreaterThan(2)
      expect(t.noteAr.length).toBeGreaterThan(10)
    }
  })

  /*
   * الاختبار يحرس **القرار** لا القائمة: قائمةٌ حرفية تُحدَّث مع كلّ
   * تبديل بلا أن يُسأل أحد «واش هذا يخصّ المقاولات؟».
   */
  it('والمخبّأ افتراضياً ما لا يخصّ مرحلة المقاولات', () => {
    // التصنيف «اقتصادي/راقٍ» يخصّ المواطن لا المقاولة
    expect(DEFAULT_HIDDEN).toContain('standing')
  })

  it('وطرق البناء تبقى ظاهرة: بها يختار الحريف كيفاش يبني', () => {
    expect(DEFAULT_HIDDEN).not.toContain('systemes')
  })
})

/**
 * التخبئة تامّة: القائمة والعنوان المباشر وخريطة الموقع.
 * كلّ صفحة قابلة للتخبئة تحمل حارسها، وإلّا بقيت تفتح لمن يعرف.
 */
describe('الحارس على كلّ صفحة', () => {
  const pages: [string, string][] = [
    ['standing', 'standing'],
    ['systemes', 'systemes'],
  ]

  for (const [page, segment] of pages) {
    it(`/${page} تردّ 404 وهي مخبّأة`, () => {
      const src = readFileSync(`app/(site)/[locale]/${page}/page.tsx`, 'utf8')
      expect(src).toContain(`guardTrack('${segment}')`)
    })
  }

  it('وخريطة الموقع لا تَعِد بما خُبّئ', () => {
    const src = readFileSync('app/sitemap.ts', 'utf8')
    expect(src).toContain('getHiddenPaths')
    expect(src).toMatch(/PAGES\.filter\(\(page\) => !isHidden\(page, hidden\)\)/)
  })

  it('والكاتالوج في القائمة — نُشر مرّة بلا رابط فما وصل إليه أحد', () => {
    const src = readFileSync('app/(site)/[locale]/layout.tsx', 'utf8')
    expect(src).toContain("p('/catalogue')")
    expect(src).toContain('visibleLinks')
  })
})
