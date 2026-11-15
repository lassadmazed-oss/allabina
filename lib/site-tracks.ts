/**
 * مسارات الموقع العمومي — ما يُعرض وما يُخبّى.
 *
 * قرار 14 نوفمبر 2026: المرحلة الأولى بناء ومقاولات وحدها. وما بُني
 * للسكن والتمويل والعقارات لا يُحذف — يُخبّى ويرجع في مرحلة متقدّمة.
 *
 * والتخبئة إعدادٌ لا شفرة: تُقلب من اللوحة بلا نشر، لأنّ قرار «شنوّة
 * يشوف الزائر» قرار صاحب الشركة لا قرار مطوّر.
 *
 * ومخبّأ يعني مخبّأ فعلاً: لا في القائمة، ولا في خريطة الموقع، ولا
 * بالعنوان المباشر. رابطٌ يُخفى من القائمة ويبقى يفتح ليس مخبّأً، بل
 * مخفيٌّ عمّن لا يعرف.
 */

export type TrackSegment =
  | 'proprietaire'
  | 'reseau'
  | 'standing'
  | 'soutien'
  | 'simulateur'
  | 'systemes'

export type Track = {
  segment: TrackSegment
  labelAr: string
  labelFr: string
  /** لماذا قد يُخبّى — يُعرض في اللوحة ليُقرَّر عن علم */
  noteAr: string
}

/**
 * ما يجوز تخبئته. الكاتالوج والمطلب والمتابعة والحساب والقانوني
 * والصفحة الأولى ليست هنا: بدونها لا موقع.
 */
export const TRACKS: Track[] = [
  {
    segment: 'proprietaire',
    labelAr: 'صاحب عقار',
    labelFr: 'Propriétaire',
    noteAr: 'عرض عقار على اللَّبنة. مسار عقاري، موش مقاولات.',
  },
  {
    segment: 'reseau',
    labelAr: 'شبكة المتدخّلين',
    labelFr: 'Réseau',
    noteAr: 'تسجيل الحرفاء والمقاولين. في نموذج المقاولة هاذوما مناولون — شأن داخلي.',
  },
  {
    segment: 'standing',
    labelAr: 'مستويات التشطيب',
    labelFr: 'Niveaux de finition',
    noteAr: 'الصفحة اللي تصنّف الحريف «اقتصادي/راقٍ». شلناها من الكاتالوج، وهاذي آخر بلاصة فيها.',
  },
  {
    segment: 'soutien',
    labelAr: 'المساندة',
    labelFr: 'Soutien',
    noteAr: 'مساندة العائلات. موش مقاولات، آمّا موجّهة للمواطن.',
  },
  {
    segment: 'simulateur',
    labelAr: 'محاكي الكلفة',
    labelFr: 'Simulateur',
    noteAr: 'يحسب بسعر المتر حسب المستوى. يتعوّض بالتقدير المبنيّ على الاختيارات.',
  },
  {
    segment: 'systemes',
    labelAr: 'طرق البناء',
    labelFr: 'Systèmes',
    noteAr: 'مقارنة طرق البناء. تخصّ المقاولات مباشرة.',
  },
]

export const TRACK_SEGMENTS = TRACKS.map((t) => t.segment)

/**
 * المخبّأ افتراضياً: ما لا يخصّ مرحلة المقاولات الأولى.
 *
 * 15/11/2026: انضمّت المساندة والمحاكي. المساندة مسارٌ للمواطن لا
 * للمقاولة، والمحاكي يحسب بسعر المتر حسب المستوى — وقد عوّضه التقدير
 * المبنيّ على اختيارات الحريف في المكوّن.
 *
 * و«طرق البناء» (systemes) ليست هنا: الحريف يختار بها كيفاش يبني،
 * وهي من صميم المقاولات.
 */
export const DEFAULT_HIDDEN: TrackSegment[] = [
  'proprietaire',
  'reseau',
  'standing',
  'soutien',
  'simulateur',
]

const isTrack = (v: unknown): v is TrackSegment =>
  typeof v === 'string' && (TRACK_SEGMENTS as string[]).includes(v)

/**
 * يقرأ الإعداد من القاعدة.
 *
 * ليس مصفوفةً؟ نرجع للافتراضي — لا نفتح كلّ شيء لأنّ قيمةً تلفت.
 * وقيمة غريبة داخل المصفوفة تُهمَل وحدها، فلا تُسقط البقيّة.
 */
export function parseHidden(value: unknown): TrackSegment[] {
  if (!Array.isArray(value)) return DEFAULT_HIDDEN
  const out = value.filter(isTrack)
  return [...new Set(out)]
}

/**
 * هل هذا المسار مخبّأ؟ يقبل المقطع («soutien») أو المسار الكامل
 * («/ar/soutien/demande»)، فالصفحات الفرعية تتبع أصلها.
 */
export function isHidden(pathOrSegment: string, hidden: TrackSegment[]): boolean {
  const raw = pathOrSegment.replace(/^\/+/, '')
  const parts = raw.split('/').filter(Boolean)
  // «ar/soutien/demande» ← نتجاوز رمز اللغة إن وُجد
  const head = parts[0] && parts[0].length === 2 ? parts[1] : parts[0]
  return head ? hidden.includes(head as TrackSegment) : false
}

/** يرشّح روابط القائمة والذيل — مصدر واحد للترشيح */
export function visibleLinks<T extends { href: string }>(
  links: T[],
  hidden: TrackSegment[]
): T[] {
  return links.filter((l) => !isHidden(l.href, hidden))
}
