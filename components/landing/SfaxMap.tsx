/**
 * خريطة حقيقية بدل الرسم: Google Maps مضمّنة، مركزها وسط تونس ومؤشّرها
 * صفاقس، فتُرى البلاد كلّها ومكان المرحلة التجريبية فيها.
 *
 * الرابط هو صيغة التضمين الرسمية (/maps/embed?pb=…) نفسها التي يولّدها
 * زرّ «تضمين خريطة» في Google Maps، ولا تحتاج مفتاح API. الإطار يُحمَّل
 * كسولاً لأنّه تحت الطيّة، فلا يثقل فتح الصفحة. لغة التسميات تتبع لغة الموقع.
 */

const SFAX_QUERY = 'Sfax, Tunisia'
/** مركز الإطار: وسط البلاد لا صفاقس، حتّى لا يُقطع الغرب */
const CENTER = { lat: 34.2, lng: 9.7 }
const ZOOM = 6

/** رابط الفتح في تطبيق الخرائط — للهاتف خاصّة */
export const SFAX_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SFAX_QUERY)}`

/** مقاطع pb كما يولّدها Google: المسافة والمركز والمقاس والاستعلام والتكبير واللغة */
function embedUrl(hl: 'ar' | 'fr'): string {
  const pb = [
    '!1m13!1m8!1m3!1d6758197.51568524',
    `!2d${CENTER.lng}!3d${CENTER.lat}`,
    '!3m2!1i1024!2i768!4f13.1',
    `!2m1!1s${encodeURIComponent(SFAX_QUERY).replace(/%20/g, '+')}`,
    `!5e0!6i${ZOOM}`,
    `!3m1!1s${hl}!5m1!1s${hl}`,
  ].join('')
  return `https://www.google.com/maps/embed?origin=mfe&pb=${pb}`
}

export default function SfaxMap({ locale, title }: { locale: string; title: string }) {
  return (
    <div className="map__frame">
      <iframe
        src={embedUrl(locale === 'fr' ? 'fr' : 'ar')}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  )
}
