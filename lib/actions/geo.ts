'use server'

import { isGoogleMapsLink, parseCoords, type Coords } from '@/lib/geo'

/**
 * فكّ رابط خرائط قوقل المختصر.
 *
 * زرّ «مشاركة» في تطبيق الخرائط يعطي https://maps.app.goo.gl/… وما فيه
 * إحداثيات. نتبّعو التحويل ونقرا العنوان النهائي. الرابط ما يُفتحش إلّا
 * إذا كان من قائمة مضيفي قوقل، حتى ما يصيرش الخادم أداة طلب لأيّ عنوان.
 */
export async function resolveMapsLinkAction(url: string): Promise<Coords | null> {
  if (!isGoogleMapsLink(url)) return null

  const direct = parseCoords(url)
  if (direct) return direct

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // بلا هذا يرجّع قوقل صفحة موبايل بلا إحداثيات في العنوان
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept-language': 'ar,fr;q=0.8,en;q=0.6',
      },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })

    const fromUrl = parseCoords(res.url)
    if (fromUrl) return fromUrl

    // بعض الردود تحمل الإحداثيات في الصفحة لا في العنوان
    const body = (await res.text()).slice(0, 200_000)
    return parseCoords(body)
  } catch {
    return null
  }
}
