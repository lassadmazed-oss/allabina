/**
 * خريطة تونس — من إحداثيات جغرافية حقيقية، لا من رسم باليد.
 *
 * النقاط بخطوط الطول والعرض على الساحل والحدود، والإسقاط يُحسب في الشفرة
 * فصفاقس تقع حيث تقع فعلاً (10.76°E · 34.74°N). الساحل يُرسم منحنى
 * ناعماً (Catmull–Rom → Bézier) لأنّ الساحل منحنٍ، والحدود البرّية خطوط
 * شبه مستقيمة تبقى كذلك لأنّ نقاطها قليلة ومتباعدة.
 *
 * الإسقاط متساوي المسافات مع تصحيح عرض خطّ 34° حتى لا تبدو البلاد أعرض
 * ممّا هي.
 */

type LonLat = readonly [number, number]

/** الساحل من طبرقة شرقاً ثمّ جنوباً، فالحدود الليبية، فالحدود الجزائرية شمالاً */
const MAINLAND: readonly LonLat[] = [
  // الساحل الشمالي
  [8.76, 36.95], // طبرقة
  [9.05, 37.1], // رأس النقرو
  [9.23, 37.22], // رأس سرّاط
  [9.6, 37.3],
  [9.83, 37.34], // رأس الأبيض — أقصى الشمال
  [10.05, 37.26],
  [10.27, 37.18], // رأس سيدي علي المكّي
  // خليج تونس
  [10.15, 37.08],
  [10.2, 36.95],
  [10.32, 36.87], // المرسى
  [10.24, 36.8], // تونس
  [10.34, 36.73], // حمّام الأنف
  [10.49, 36.7], // سليمان
  [10.57, 36.83], // قربص
  [10.9, 37.02], // سيدي داود
  [11.04, 37.06], // رأس الطيب
  // شرق الوطن القبلي
  [11.09, 36.85], // قليبية
  [10.98, 36.78], // منزل تميم
  [10.86, 36.58], // قربة
  [10.73, 36.45], // نابل
  [10.6, 36.4], // الحمّامات
  // خليج الحمّامات
  [10.45, 36.3], // بوفيشة
  [10.38, 36.13], // النفيضة
  [10.51, 36.03], // هرقلة
  [10.64, 35.83], // سوسة
  [10.83, 35.77], // المنستير
  [10.96, 35.66], // طبلبة
  [11.06, 35.5], // المهدية
  [11.15, 35.3],
  [11.16, 35.23], // رأس قبودية
  // نزولاً إلى صفاقس
  [10.98, 35.03], // اللوزة
  [10.76, 34.74], // صفاقس
  [10.7, 34.65], // طينة
  [10.5, 34.53], // المحرس
  [10.3, 34.42],
  [10.07, 34.3], // الصخيرة
  // خليج قابس
  [10.02, 34.1],
  [10.1, 33.88], // قابس
  [10.3, 33.63], // مارث
  [10.55, 33.6],
  [10.75, 33.63], // جرف — فم بوغرارة
  [10.95, 33.55],
  [11.11, 33.5], // جرجيس
  [11.35, 33.3],
  [11.56, 33.13], // رأس جدير — الحدود الليبية
  // الحدود الليبية
  [11.5, 32.75],
  [10.71, 32.02], // الذهيبة
  [10.3, 31.72],
  [9.95, 31.05],
  [9.55, 30.24], // برج الخضراء — أقصى الجنوب
  // الحدود الجزائرية
  [9.3, 30.85],
  [9.05, 31.5],
  [8.35, 32.25],
  [7.8, 33.15],
  [7.52, 33.65], // حزوة — أقصى الغرب
  [7.7, 34.1],
  [8.1, 34.55],
  [8.28, 35.05], // بوشبكة
  [8.4, 35.7],
  [8.28, 36.15], // ساقية سيدي يوسف
  [8.44, 36.45], // غار الدماء
  [8.6, 36.72],
]

const KERKENNAH: readonly LonLat[] = [
  [11.1, 34.7],
  [11.22, 34.72],
  [11.3, 34.8],
  [11.36, 34.88],
  [11.27, 34.9],
  [11.15, 34.8],
]

const DJERBA: readonly LonLat[] = [
  [10.74, 33.72], // أجيم
  [10.78, 33.87],
  [10.86, 33.88], // حومة السوق
  [11.05, 33.83], // رأس تاقرمس
  [11.03, 33.7],
  [10.93, 33.63], // القنطرة
  [10.8, 33.66],
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

/**
 * مضلّع مغلق → منحنى Catmull–Rom مقفول محوَّل إلى Bézier تكعيبي.
 * الشدّ 0.5 يمرّ بالنقاط ولا يبتكر انحناءات بين نقطتين متباعدتين.
 *
 * من `straightFrom` فصاعداً تُرسم القطع خطوطاً: الحدود البرّية مستقيمة
 * على الخريطة، والتنعيم كان يقوّس الحدّ الليبي ويعقف طرف الجنوب.
 */
function smoothClosed(pts: readonly LonLat[], straightFrom = Infinity): string {
  const P = pts.map(([lon, lat]) => [px(lon), py(lat)] as const)
  const n = P.length
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(P[0][0])} ${f(P[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n]
    const p1 = P[i]
    const p2 = P[(i + 1) % n]
    const p3 = P[(i + 2) % n]
    if (i >= straightFrom) {
      d += ` L${f(p2[0])} ${f(p2[1])}`
      continue
    }
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + ' Z'
}

const RAS_AJDIR = MAINLAND.findIndex(([lon, lat]) => lon === 11.56 && lat === 33.13)
const MAINLAND_D = smoothClosed(MAINLAND, RAS_AJDIR)
const KERKENNAH_D = smoothClosed(KERKENNAH)
const DJERBA_D = smoothClosed(DJERBA)

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
