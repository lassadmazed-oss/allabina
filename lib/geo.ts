/**
 * استخراج الإحداثيات من أيّ شيء يلصقه المواطن.
 *
 * صاحب الأرض ما يعرفش «خط العرض» و«خط الطول»، أمّا يعرف يفتح خرائط قوقل
 * ويلصق الرابط. هذي الدالّة تقرأ الرابط أو الإحداثيات مكتوبة كيفما جات،
 * وترجّع نقطة وحدة أو null. لا رمي أخطاء: الحقل اختياري.
 */

export type Coords = { lat: number; lng: number }

/** حدود تونس تقريباً — نقطة برّاها أغلب الظنّ مقلوبة أو غالطة */
const TUNISIA = { latMin: 30.2, latMax: 37.6, lngMin: 7.5, lngMax: 11.7 }

const inTunisia = (c: Coords) =>
  c.lat >= TUNISIA.latMin &&
  c.lat <= TUNISIA.latMax &&
  c.lng >= TUNISIA.lngMin &&
  c.lng <= TUNISIA.lngMax

const valid = (c: Coords) =>
  Number.isFinite(c.lat) &&
  Number.isFinite(c.lng) &&
  Math.abs(c.lat) <= 90 &&
  Math.abs(c.lng) <= 180 &&
  !(c.lat === 0 && c.lng === 0)

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** الأنماط التي تحمل الإحداثيات في روابط خرائط قوقل، بالأولوية */
const PATTERNS: RegExp[] = [
  // .../@36.8065,10.1815,17z — مركز الخريطة
  /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  // ...!3d36.8065!4d10.1815 — الدبّوس نفسه
  /!3d(-?\d+(?:\.\d+)?)[^\d-]+!4d(-?\d+(?:\.\d+)?)/,
  // ?q=36.8065,10.1815 · ?ll=… · ?daddr=… · ?destination=…
  /(?:^|[?&])(?:q|ll|sll|daddr|saddr|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
  // «36.8065, 10.1815» ملصوقة كما هي
  /(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/,
]

/**
 * يقرأ نصّاً ويرجّع نقطة، أو null إن لم يجد.
 * إذا جات النقطة برّا تونس وقلْبها يقع داخلها، نقلبها: خطأ شائع
 * كي يلصق الحريف الطول قبل العرض.
 */
export function parseCoords(input: string): Coords | null {
  const text = (input ?? '').trim()
  if (!text) return null

  for (const re of PATTERNS) {
    const m = text.match(re)
    if (!m) continue

    const first = Number(m[1])
    const second = Number(m[2])
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue

    const asIs: Coords = { lat: round6(first), lng: round6(second) }
    if (!valid(asIs)) continue

    const swapped: Coords = { lat: asIs.lng, lng: asIs.lat }
    if (!inTunisia(asIs) && inTunisia(swapped)) return swapped
    return asIs
  }

  return null
}

/** هل النقطة داخل تونس؟ الواجهة تنبّه ولا تمنع — قد يكون العقار على الحدود */
export const isInTunisia = (c: Coords) => inTunisia(c)

/** «36.806500, 10.181500» — بستّ منازل، دقّة نحو 10 صم */
export const formatCoords = (c: Coords) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`

/** رابط يفتح النقطة في خرائط قوقل للتثبّت منها */
export const mapsLink = (c: Coords) =>
  `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`

/**
 * هل الرابط من خرائط قوقل؟ قائمة بيضاء مغلقة، لأنّ الخادم يفتح هذا الرابط
 * بنفسه لفكّ الاختصار — فلا يُفتح إلّا ما نعرفه.
 */
const MAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
])

export function isGoogleMapsLink(input: string): boolean {
  const text = (input ?? '').trim()
  if (!/^https?:\/\//i.test(text)) return false
  try {
    const u = new URL(text)
    if (!MAPS_HOSTS.has(u.hostname.toLowerCase())) return false
    // النطاقات العامّة تُقبل فقط على مسار الخرائط
    if (u.hostname.toLowerCase().endsWith('google.com') && !/^\/maps(\/|$)/.test(u.pathname)) {
      return u.pathname === '/' && u.searchParams.has('q')
    }
    return true
  } catch {
    return false
  }
}

/** رابط مختصر لا يحمل إحداثيات في نصّه — يلزمه فكّ من الخادم */
export const isShortMapsLink = (input: string) =>
  isGoogleMapsLink(input) && parseCoords(input) === null
