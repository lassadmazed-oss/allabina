import { z } from 'zod'

export const REQUEST_TYPES = [
  'build_on_land',
  'land_and_house',
  'apartment',
  'economic',
  'rent_to_own',
] as const

export const EMPLOYMENT_TYPES = [
  'public',
  'private',
  'self_employed',
  'informal',
  'retired',
  'expat',
  'other',
] as const

export const HORIZONS = ['now', '6m', '12m', '24m'] as const
export const TITLE_STATUSES = ['titled', 'in_progress', 'undivided', 'other'] as const
export const STANDINGS = ['standard', 'mid', 'premium'] as const

const num = (min: number, max: number) => z.coerce.number().min(min).max(max)

/** حقل رقمي اختياري: غائب أو فارغ → 0 */
const optionalNum = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? 0 : Number(v)))

/** حقل رقمي اختياري: غائب أو فارغ → null (الخطوات المخفية ما تُرسلش حقولها) */
const nullableNum = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v)))

/** قائمة اختيارية: غائبة أو فارغة → null */
const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.literal(''), z.enum(values)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v))

const optionalFlag = z
  .union([z.boolean(), z.literal('on'), z.literal('')])
  .optional()
  .transform((v) => v === true || v === 'on')

export const requestSchema = z.object({
  // 1 — نوع المطلب
  requestType: z.enum(REQUEST_TYPES),

  // 2 — المكان والمساحة
  govCode: z.string().min(2).max(8),
  delegationId: nullableNum(1, 100000),
  desiredAreaM2: nullableNum(40, 400),
  bedrooms: nullableNum(1, 6),
  horizon: z.enum(HORIZONS),
  standing: nullableEnum(STANDINGS),
  imadaId: nullableNum(1, 1000000),
  landLocation: z.string().max(200).optional().transform((v) => v ?? ''),

  // 3 — الأرض (مسار البناء)
  landAreaM2: nullableNum(50, 5000),
  titleStatus: nullableEnum(TITLE_STATUSES),
  hasWater: optionalFlag,
  hasPower: optionalFlag,
  hasRoad: optionalFlag,
  hasPermit: optionalFlag,

  // 4 — القدرة المالية
  monthlyIncome: num(0, 100000),
  spouseIncome: optionalNum(0, 100000),
  otherIncome: optionalNum(0, 100000),
  existingLoans: optionalNum(0, 100000),
  downPayment: optionalNum(0, 5000000),
  maxMonthly: optionalNum(0, 100000),
  employment: z.enum(EMPLOYMENT_TYPES),
  /** تُدخَل بالسنين وتُخزَّن بالأشهر — انظر lib/actions/request.ts */
  seniorityYears: optionalNum(0, 50),
  isExpat: optionalFlag,
  expatCountry: z.string().max(60).optional().transform((v) => v ?? ''),

  // 5 — الاتصال والموافقة
  fullName: z.string().trim().min(3, 'الاسم الكامل مطلوب').max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^\+?\d{8,15}$/.test(v), 'رقم هاتف غير صحيح'),
  email: z
    .union([z.literal(''), z.string().email('بريد غير صحيح')])
    .optional()
    .transform((v) => v ?? ''),
  consent: z
    .union([z.boolean(), z.literal('on'), z.literal('')])
    .optional()
    .transform((v) => v === true || v === 'on')
    .refine((v) => v === true, 'الموافقة على معالجة المعطيات مطلوبة'),
})

export type RequestInput = z.input<typeof requestSchema>
export type RequestData = z.output<typeof requestSchema>

export const LABELS = {
  requestType: {
    build_on_land: 'نحبّ نبني فوق أرضي',
    land_and_house: 'نحبّ أرض ودار',
    apartment: 'نحبّ شقة',
    economic: 'سكن اقتصادي',
    rent_to_own: 'كراء مملّك',
  } as Record<string, string>,
  employment: {
    public: 'وظيفة عمومية',
    private: 'قطاع خاص',
    self_employed: 'عمل مستقلّ (حرفي، تاجر، مهنة حرّة)',
    informal: 'دخل غير قارّ',
    retired: 'متقاعد',
    expat: 'تونسي مقيم بالخارج',
    other: 'أخرى',
  } as Record<string, string>,
  horizon: {
    now: 'فوراً',
    '6m': 'في حدود 6 أشهر',
    '12m': 'في حدود سنة',
    '24m': 'في حدود سنتين',
  } as Record<string, string>,
  standing: {
    standard: 'عادي',
    mid: 'متوسّط ومحسّن',
    premium: 'Haut Standing',
  } as Record<string, string>,
  titleStatus: {
    titled: 'رسم عقاري (مسجّلة)',
    in_progress: 'في طور التسوية',
    undivided: 'على الشياع',
    other: 'أخرى',
  } as Record<string, string>,
  status: {
    new: 'جديد',
    contacted: 'تمّ الاتصال',
    qualified: 'مؤهّل',
    matched: 'مطابَق بعرض',
    appointment: 'موعد محدّد',
    contract: 'عقد',
    on_hold: 'في الانتظار',
    rejected: 'مرفوض',
  } as Record<string, string>,
}
