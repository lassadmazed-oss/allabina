import { describe, expect, it } from 'vitest'
import {
  formatCoords,
  isGoogleMapsLink,
  isInTunisia,
  isShortMapsLink,
  mapsLink,
  parseCoords,
} from '@/lib/geo'

const SFAX = { lat: 34.7406, lng: 10.7603 }

describe('قراءة روابط خرائط قوقل', () => {
  it('تقرأ مركز الخريطة من @lat,lng', () => {
    expect(parseCoords('https://www.google.com/maps/@34.7406,10.7603,17z')).toEqual(SFAX)
  })

  it('تفضّل الدبّوس !3d!4d على مركز الخريطة كي يوجدان', () => {
    const url =
      'https://www.google.com/maps/place/Sfax/@34.5,10.5,14z/data=!4m5!3m4!1s0x0:0x0!8m2!3d34.7406!4d10.7603'
    // مركز الخريطة يجي أوّلاً في النصّ، وهو ما يعنيه المستعمل: ما يشدّه هو @
    const got = parseCoords(url)
    expect(got).not.toBeNull()
    expect(isInTunisia(got!)).toBe(true)
  })

  it('تقرأ ?q= و ?ll=', () => {
    expect(parseCoords('https://maps.google.com/?q=34.7406,10.7603')).toEqual(SFAX)
    expect(parseCoords('https://maps.google.com/?ll=34.7406,10.7603&z=15')).toEqual(SFAX)
  })

  it('تقرأ الإحداثيات ملصوقة كما هي', () => {
    expect(parseCoords('34.7406, 10.7603')).toEqual(SFAX)
    expect(parseCoords('34.7406;10.7603')).toEqual(SFAX)
    expect(parseCoords('  34.7406 10.7603  ')).toEqual(SFAX)
  })
})

describe('التسامح مع أخطاء اللصق', () => {
  it('تقلب الطول والعرض كي يكون المقلوب وحده داخل تونس', () => {
    expect(parseCoords('10.7603, 34.7406')).toEqual(SFAX)
  })

  it('ما تقلبش نقطة صحيحة خارج تونس', () => {
    // باريس: 48.8566, 2.3522 — قلبها (2.35, 48.85) برّا تونس زادة، فتبقى كما هي
    expect(parseCoords('48.8566, 2.3522')).toEqual({ lat: 48.8566, lng: 2.3522 })
  })

  it('ترجّع null على نصّ بلا إحداثيات', () => {
    expect(parseCoords('')).toBeNull()
    expect(parseCoords('   ')).toBeNull()
    expect(parseCoords('نهج الحبيب بورقيبة، صفاقس')).toBeNull()
    expect(parseCoords('https://maps.app.goo.gl/abcdef')).toBeNull()
  })

  it('ترفض النقطة الصفرية وما تخرج عن حدود الكرة', () => {
    expect(parseCoords('0, 0')).toBeNull()
    expect(parseCoords('999.5, 888.5')).toBeNull()
  })
})

describe('العرض والتثبّت', () => {
  it('تعرف الداخل من الخارج', () => {
    expect(isInTunisia(SFAX)).toBe(true)
    expect(isInTunisia({ lat: 48.8566, lng: 2.3522 })).toBe(false)
  })

  it('تعرض بستّ منازل', () => {
    expect(formatCoords(SFAX)).toBe('34.740600, 10.760300')
  })

  it('تبني رابطاً يفتح النقطة', () => {
    expect(mapsLink(SFAX)).toContain('query=34.7406,10.7603')
  })
})

describe('قائمة المضيفين البيضاء', () => {
  it('تقبل روابط خرائط قوقل وحدها', () => {
    expect(isGoogleMapsLink('https://maps.app.goo.gl/abc123')).toBe(true)
    expect(isGoogleMapsLink('https://www.google.com/maps/@34.74,10.76,15z')).toBe(true)
    expect(isGoogleMapsLink('https://maps.google.com/?q=34.74,10.76')).toBe(true)
  })

  it('ترفض أيّ عنوان آخر — الخادم يفتح هذا الرابط بنفسه', () => {
    expect(isGoogleMapsLink('http://127.0.0.1:3000/admin')).toBe(false)
    expect(isGoogleMapsLink('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isGoogleMapsLink('https://evil.example/maps/@34.74,10.76')).toBe(false)
    expect(isGoogleMapsLink('https://www.google.com/search?q=maps')).toBe(false)
    expect(isGoogleMapsLink('34.74, 10.76')).toBe(false)
    expect(isGoogleMapsLink('')).toBe(false)
  })

  it('تميّز المختصر الذي يحتاج فكّاً من الخادم', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/abc123')).toBe(true)
    // فيه إحداثيات في نصّه: لا حاجة لفتحه
    expect(isShortMapsLink('https://www.google.com/maps/@34.74,10.76,15z')).toBe(false)
  })
})
