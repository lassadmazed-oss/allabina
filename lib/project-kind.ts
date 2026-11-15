/**
 * فرد أم محترف — ومن يُسأل عن ماذا.
 *
 * الماكيتة F02 تضع التوغّل فوق أنواع المشروع. والفرق ليس في الشكل:
 * **من يبني داراً يُسأل عن غرفه، ومن يبني مستودعاً لا غرف عنده.**
 * رسمُ صالونٍ وغرفتَي نومٍ لمستودعٍ ليس تقريباً، بل جواب عن سؤالٍ لم
 * يُطرح.
 *
 * فالتوغّل يبدّل ثلاثة: أيّ أنواع تُعرض، وأيّ أسئلة تُطرح، وهل يُرسم
 * توزيع الغرف أصلاً.
 */

export const CLIENT_KINDS = ['particulier', 'pro'] as const
export type ClientKind = (typeof CLIENT_KINDS)[number]

export const DEFAULT_KIND: ClientKind = 'particulier'

export const PROJECT_TYPES = [
  'maison',
  'immobilier',
  'usine',
  'commerce',
  'renovation',
  'autre',
] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

/**
 * ما يُعرض لكلّ صنف.
 *
 * «مشروع آخر» في الاثنين: قائمةٌ مغلقة تطرد من لا يجد نفسه فيها،
 * ومن يبني شيئاً لم نتوقّعه زبونٌ مثل غيره.
 *
 * و«ترميم ولّا توسعة» في الاثنين كذلك: الفرد يوسّع داره، والمحترف
 * يرمّم عمارةً — نفس الشغل بحجمين.
 */
const BY_KIND: Record<ClientKind, readonly ProjectType[]> = {
  particulier: ['maison', 'renovation', 'commerce', 'autre'],
  pro: ['immobilier', 'usine', 'commerce', 'renovation', 'autre'],
}

export const typesFor = (kind: ClientKind): readonly ProjectType[] => BY_KIND[kind]

/** صنفٌ غريب في العنوان يرجع للفرد: الأغلب، ولا ينفتح شيء بالغلط */
export const parseKind = (v: unknown): ClientKind =>
  (CLIENT_KINDS as readonly string[]).includes(String(v)) ? (String(v) as ClientKind) : DEFAULT_KIND

/**
 * الصنف الذي يَظهر فيه هذا النوع — لرابطٍ جاء من الخارج يحمل النوع
 * وحده. «محلّ» في الاثنين، فيُنسب للفرد ما لم يُقَل غير ذلك.
 */
export function kindOfType(type: string): ClientKind {
  if (BY_KIND.particulier.includes(type as ProjectType)) return 'particulier'
  if (BY_KIND.pro.includes(type as ProjectType)) return 'pro'
  return DEFAULT_KIND
}

/**
 * هل هذا المشروع غرفٌ تُسكن؟
 *
 * الدار والترميم نعم. والمستودع والمحلّ والعمارة لا: العمارة تُسأل عن
 * طوابقها وشققها لا عن «كم غرفة نوم» — وحدةٌ واحدة من عشرين.
 */
export const asksRooms = (type: string): boolean => type === 'maison' || type === 'renovation'

/** هل يُسأل عن عدد الوحدات — شقق أو محلّات؟ */
export const asksUnits = (type: string): boolean =>
  type === 'immobilier' || type === 'commerce'

/** هل يُسأل عن الارتفاع والبحر — مستودعٌ أو ورشة؟ */
export const asksSpan = (type: string): boolean => type === 'usine'

/** يُرسم توزيع المساحات حين تكون غرفاً، لا غير */
export const drawsSketch = asksRooms
