/**
 * خريطة تونس — من إحداثيات جغرافية حقيقية، لا من رسم باليد.
 *
 * كان المخطّط السابق مرسوماً بالتقدير فخرجت تونس بلا رأس الطيب ولا
 * انحناءة الساحل ولا خليج قابس، وصفاقس على نتوء لا وجود له. هنا نقاط
 * الساحل والحدود بخطوط الطول والعرض، والإسقاط يُحسب في الشفرة —
 * فصفاقس تقع حيث تقع فعلاً (10.76°E · 34.74°N).
 *
 * الإسقاط: متساوي المسافات مع تصحيح عرض خطّ 34° حتى لا تبدو البلاد
 * أعرض ممّا هي.
 */

type LonLat = readonly [number, number]

/** الساحل من طبرقة شرقاً ثمّ جنوباً، فالحدود الليبية، فالحدود الجزائرية شمالاً */
const MAINLAND: readonly LonLat[] = [
  [8.76, 36.95], // طبرقة
  [9.22, 37.22], // رأس سرّاط
  [9.85, 37.33], // رأس الأبيض — أقصى الشمال
  [10.3, 37.17], // رأس سيدي علي المكّي
  [10.3, 36.82], // تونس — خليج تونس
  [10.6, 36.85], // قربص
  [11.04, 37.06], // رأس الطيب
  [11.12, 36.85], // قليبية
  [10.74, 36.45], // نابل
  [10.6, 36.4], // الحمّامات
  [10.51, 36.03], // هرقلة
  [10.64, 35.83], // سوسة
  [10.84, 35.77], // المنستير
  [11.06, 35.5], // المهدية
  [11.16, 35.23], // الشابّة — رأس قبودية
  [10.92, 34.95], // اللوزة
  [10.76, 34.74], // صفاقس
  [10.5, 34.53], // المحرس
  [10.07, 34.3], // الصخيرة
  [10.1, 33.88], // قابس
  [10.28, 33.63], // مارث
  [10.55, 33.55], // بوغرارة
  [10.95, 33.62], // جرجيس شمالاً
  [11.11, 33.5], // جرجيس
  [11.56, 33.13], // رأس جدير — الحدود الليبية
  [11.35, 32.7],
  [10.71, 32.02], // الذهيبة
  [10.3, 31.72],
  [9.95, 31.05],
  [9.55, 30.24], // برج الخضراء — أقصى الجنوب
  [9.3, 30.95],
  [9.05, 31.55],
  [8.35, 32.3],
  [7.8, 33.2],
  [7.52, 33.65], // حزوة — أقصى الغرب
  [7.7, 34.1],
  [8.1, 34.55],
  [8.28, 35.1], // بوشبكة
  [8.4, 35.7],
  [8.3, 36.2], // ساقية سيدي يوسف
  [8.44, 36.45], // غار الدماء
  [8.6, 36.7],
]

const KERKENNAH: readonly LonLat[] = [
  [11.12, 34.72],
  [11.3, 34.78],
  [11.36, 34.86],
  [11.28, 34.88],
  [11.1, 34.78],
]

const DJERBA: readonly LonLat[] = [
  [10.75, 33.9],
  [11.05, 33.88],
  [11.08, 33.7],
  [10.86, 33.65],
  [10.72, 33.75],
]

const SFAX: LonLat = [10.76, 34.74]

// الإسقاط
const LON0 = 7.4
const LAT0 = 37.4
const SCALE = 46
const KX = Math.cos((34 * Math.PI) / 180)
const PAD = 8

const px = (lon: number) => PAD + (lon - LON0) * KX * SCALE
const py = (lat: number) => PAD + (LAT0 - lat) * SCALE

const toPath = (pts: readonly LonLat[]) =>
  pts.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(' ') + ' Z'

const MAINLAND_D = toPath(MAINLAND)
const KERKENNAH_D = toPath(KERKENNAH)
const DJERBA_D = toPath(DJERBA)

const W = Math.round(PAD * 2 + (11.7 - LON0) * KX * SCALE)
const H = Math.round(PAD * 2 + (LAT0 - 30.1) * SCALE)

export default function TunisiaMap() {
  const sx = px(SFAX[0])
  const sy = py(SFAX[1])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id="lp-map" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5EBD9" />
          <stop offset="1" stopColor="#E6D0A8" />
        </linearGradient>
      </defs>
      <path d={MAINLAND_D} fill="url(#lp-map)" stroke="#D4A15E" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={KERKENNAH_D} fill="url(#lp-map)" stroke="#D4A15E" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={DJERBA_D} fill="url(#lp-map)" stroke="#D4A15E" strokeWidth="1.2" strokeLinejoin="round" />
      <circle className="map__ring" cx={sx} cy={sy} r="7" fill="none" stroke="#D4A15E" strokeWidth="2" />
      <circle cx={sx} cy={sy} r="4.5" fill="#0E3A5B" stroke="#fff" strokeWidth="2" />
      <text
        x={sx - 11}
        y={sy - 7}
        fontFamily="Cairo, sans-serif"
        fontSize="12"
        fontWeight="700"
        fill="#0E3A5B"
        textAnchor="end"
      >
        صفاقس
      </text>
    </svg>
  )
}
