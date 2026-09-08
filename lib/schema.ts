import { z } from 'zod'
import { CLIENT_DOC_CODES } from '@/lib/documents'
import { HOUSING_CONDITIONS, INCOME_STABILITY } from '@/lib/support-schema'

export const REQUEST_TYPES = [
  'build_on_land',
  'land_and_house',
  'apartment',
  'economic',
  'rent_to_own',
  'renovation',
  'other',
] as const

/** درجة الاستعجال — ترتّب عمل المستشار، فالحرج يطلع فوق مهما كان تاريخه */
export const URGENCIES = ['planning', 'within_year', 'urgent', 'critical'] as const

/** على شنوّة الحريف مستعدّ يتنازل — هذا اللي يفتح الحلول البديلة */
export const FLEXIBILITIES = ['area', 'zone', 'standing', 'timing', 'type', 'budget'] as const

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

/**
 * أكبر عائق كما يراه صاحب المطلب.
 *
 * نفس قيم problem_kind في القاعدة. كان المستشار يصنّفه بعد مكالمة —
 * وصاحب المطلب يعرفه قبلها: هو الذي يعيشه.
 */
export const PROBLEM_KINDS = [
  'financing',
  'land',
  'documents',
  'budget_gap',
  'no_offer',
  'other',
] as const

/** وين وصل مع البنك — نفس قيم financing_state */
export const FINANCING_STATES = [
  'not_started',
  'studying',
  'bank_submitted',
  'approved',
  'refused',
  'self_funded',
] as const

/** المستويات: RDC · R+1 · R+2 · R+3 — نفس حدّ project_configs.levels */
export const LEVELS = [1, 2, 3, 4] as const
export const TITLE_STATUSES = ['titled', 'in_progress', 'undivided', 'other'] as const
/**
 * رمز مستوى التشطيب. لا قائمة مغلقة هنا: المستويات سطور في
 * standing_levels تزيدها الإدارة، والمفتاح الخارجي في القاعدة هو
 * الذي يرفض رمزاً غير موجود. هنا نتحقّق من الشكل فقط.
 */
export const STANDING_CODE = /^[A-Za-z0-9_-]{1,20}$/

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

/** خانات متعدّدة الاختيار: القيم المرسلة فقط، والباقي مهمَل */
const multiEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const list = v === undefined ? [] : Array.isArray(v) ? v : [v]
      return list.filter((x): x is T[number] => (values as readonly string[]).includes(x))
    })

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
  // ملاحظة Zod v4: المفتاح الغائب يحتاج optional() — union مع undefined لا يكفي
  standing: z
    .union([z.string().regex(STANDING_CODE), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  imadaId: nullableNum(1, 1000000),
  landLocation: z.string().max(200).optional().transform((v) => v ?? ''),
  urgency: nullableEnum(URGENCIES),
  urgencyNote: z.string().max(300).optional().transform((v) => v ?? ''),
  flexibility: multiEnum(FLEXIBILITIES),
  problemNote: z.string().max(1000).optional().transform((v) => v ?? ''),

  // 2-bis — مواصفات البناء: مدخل العرض التقديري، وكان يعمّرها المستشار
  levels: nullableNum(1, 4),
  bathrooms: nullableNum(1, 6),
  livingRooms: nullableNum(1, 4),
  kitchens: nullableNum(1, 3),
  garage: optionalFlag,
  terrasse: optionalFlag,
  jardin: optionalFlag,

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

  // 4-bis — السكن الاجتماعي: نجمّعو المعطيات، والأهلية تتقرّر مع الجهة المعنية
  foprolosInterest: optionalFlag,
  isFirstHome: optionalFlag,
  hasSocialHousing: optionalFlag,
  cnssAffiliated: optionalFlag,
  cnssYears: nullableNum(0, 60),

  // 4-ter — العائلة والوضع الحالي: كان المستشار يسألها في المكالمة
  // ويكتبها في «المسار الاجتماعي». صاحبها يعرفها أحسن منه.
  householdSize: nullableNum(1, 30),
  dependents: nullableNum(0, 25),
  hasDisability: optionalFlag,
  housingCondition: nullableEnum(HOUSING_CONDITIONS),
  incomeStability: nullableEnum(INCOME_STABILITY),
  problemType: nullableEnum(PROBLEM_KINDS),
  financingState: nullableEnum(FINANCING_STATES),

  /** الوثائق التي يقول صاحب المطلب إنّها عنده — تصريح لا تثبّت */
  documents: multiEnum(CLIENT_DOC_CODES as unknown as readonly [string, ...string[]]),

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
    renovation: 'ترميم ولا توسعة',
    other: 'مشكل سكني آخر',
  } as Record<string, string>,
  urgency: {
    planning: 'نخطّط، ما فمّاش أجل',
    within_year: 'خلال سنة',
    urgent: 'مستعجل — أقلّ من ستّة أشهر',
    critical: 'وضعية حرجة',
  } as Record<string, string>,
  flexibility: {
    area: 'مساحة أصغر',
    zone: 'منطقة أخرى',
    standing: 'تشطيب أبسط',
    timing: 'أجل أطول',
    type: 'نوع سكن آخر',
    budget: 'ميزانية أكبر شويّة',
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
