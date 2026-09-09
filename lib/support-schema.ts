import { z } from 'zod'
import { parseLooseInt } from '@/lib/property-schema'

/**
 * استمارة «نحتاج مساندة».
 *
 * أقصر ما يمكن عمداً: اللي يعمّرها في ضائقة، وكل خانة زايدة هي سبب إضافي
 * باش يوقّف في النصّ. ما نسألوش على الدخل بالدينار ولا على وثائق — هذا
 * يجي في المكالمة مع الفريق. هنا نسألو على الحاجة والوضعية برك.
 */

/**
 * صفة الحيازة — «وين تسكن توّة؟». واحدة ومتنافية.
 *
 * كانت القائمة تخلطها بحالة المسكن، فمن يسكن مع أهله في مسكن ضيّق
 * يجد جوابين صحيحين ويختار واحداً فنخسر النصف. الحالة صارت قائمة
 * مستقلّة (HOUSING_PROBLEMS) تُختار منها أكثر من واحدة.
 */
export const HOUSING_CONDITIONS = [
  'owner',
  'renting',
  'with_family',
  'employer',
  'temporary',
  'homeless',
  'other',
] as const

/**
 * ما يُعرض في الاستمارة العمومية.
 *
 * «بلا مسكن» بقي مقبولاً في المخطّط ولم يعد معروضاً: مطالبة إنسان
 * بأن يؤشّر على «بلا مسكن» في استمارة عمومية قسوة بلا مقابل — ومن
 * لا مأوى له يجد نفسه في «سكن مؤقّت» أو يشرح في خانة الحكاية.
 *
 * يبقى في المخطّط لأنّ ملفّات قديمة تحمله: حذفه من التحقّق كان
 * يمحوه بصمت من كلّ ملفّ يفتحه صاحبه للتعديل.
 */
export const HOUSING_TENURE_OFFERED = HOUSING_CONDITIONS.filter(
  (c) => c !== 'homeless'
)

/**
 * ما يضايقه في مسكنه الحالي — متعدّد ومجتمع كما هو في الواقع:
 * المسكن يكون ضيّقاً وغالياً وبعيداً في آن واحد.
 */
export const HOUSING_PROBLEMS = [
  'overcrowded',
  'unsafe',
  'no_utilities',
  'expensive',
  'unstable',
  'far',
  'not_accessible',
] as const

/**
 * كيف يصل الدخل — لا كم يبلغ.
 *
 * القائمة القديمة كانت: بلا دخل · غير قارّ · قارّ لكن **ضعيف** · أخرى.
 * ما فيهاش خانة لأجر قارّ عادي، فصاحب الأجر المحترم يختار «أخرى»؛
 * و«ضعيف» حكم على الناس والمقدار يُسأل في خطوة الدخل أصلاً. الانتظام
 * والمقدار بُعدان يقرؤهما البنك مستقلّين، فنسأل عن الانتظام وحده.
 */
export const INCOME_STABILITY = [
  'monthly_fixed',
  'monthly_variable',
  'seasonal',
  'irregular',
  'none',
] as const

export const URGENCY_LEVELS = ['planning', 'within_year', 'urgent', 'critical'] as const

// ============================================================
// تفاصيل الدراسة — مرتّبة على معايير التقييم الستّة (0025)
// ============================================================

export const FOR_WHOM = ['self', 'relative', 'neighbor'] as const

/** شنوّة يلزم بالضبط — الفريق يعطي عيناً لا مالاً، فالحاجة تُسمّى بجنسها */
export const NEED_KINDS = ['roof', 'room', 'materials', 'labor', 'study', 'admin', 'relocation', 'utilities', 'other'] as const

/** شنوّة صار — الاستعجال بسببه لا بدرجته وحدها */
export const TRIGGERS = ['eviction', 'collapse', 'flood', 'illness', 'loss', 'job_loss', 'disaster', 'none'] as const

export const UTILITIES = ['water', 'power', 'sewage'] as const
export const BUILDING_STATES = ['sound', 'cracks', 'danger', 'no_roof', 'unfinished'] as const
export const HEAD_STATUSES = ['couple', 'single_mother', 'single_father', 'widowed', 'divorced', 'single'] as const

/** شرائح لا أرقام: يكفي للترتيب، ولا يجعل الاستمارة استجواباً */
export const INCOME_RANGES = ['lt300', '300_600', '600_1000', 'gt1000'] as const
export const SAVINGS_RANGES = ['none', 'lt1000', '1000_3000', 'gt3000'] as const
export const SOCIAL_COVERAGE = ['cnss', 'cnrps', 'amg1', 'amg2', 'none'] as const
export const YES_NO_UNKNOWN = ['yes', 'no', 'unknown'] as const
export const LAND_STATUSES = ['titled', 'certificate', 'heirs', 'none'] as const
export const STEPS_TAKEN = ['municipality', 'governorate', 'association', 'bank', 'none'] as const
export const BEST_TIMES = ['morning', 'afternoon', 'evening'] as const


const smallCount = (min: number, max: number) =>
  z
    .unknown()
    .optional()
    .transform((v, ctx) => {
      const n = parseLooseInt(v)
      if (n === undefined || n === null) return null
      if (Number.isNaN(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `expected integer in [${min}, ${max}]` })
        return z.NEVER
      }
      return n
    })

/** قائمة اختيارية: غائبة أو فارغة → null */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.literal(''), z.enum(values)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v))

/** اختيار متعدّد: القيم المعروفة فقط، والباقي يُهمَل بصمت */
const multiEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const list = v === undefined ? [] : Array.isArray(v) ? v : [v]
      return list.filter((x): x is T[number] => (values as readonly string[]).includes(x))
    })

const shortText = z.string().trim().max(200).optional().transform((v) => v ?? '')

const checkbox = z
  .union([z.boolean(), z.literal('on'), z.literal('')])
  .optional()
  .transform((v) => v === true || v === 'on')

export const supportRequestSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^\+?\d{8,15}$/.test(v)),
  email: z
    .union([z.literal(''), z.string().email()])
    .optional()
    .transform((v) => v ?? ''),

  govCode: z.string().min(2).max(8),
  delegationId: smallCount(1, 1_000_000),

  // الحاجة نفسها — أهمّ حقل في الاستمارة
  needText: z.string().trim().min(15).max(2000),
  urgency: z.enum(URGENCY_LEVELS),

  housingCondition: z.enum(HOUSING_CONDITIONS),
  householdSize: smallCount(1, 30),
  dependents: smallCount(0, 25),
  hasDisability: checkbox,
  incomeStability: z.enum(INCOME_STABILITY),

  ownsLand: checkbox,

  // ---- تفاصيل الدراسة — كلّها اختيارية: من في ضائقة لا يُوقَف على خانة ----
  forWhom: optionalEnum(FOR_WHOM),
  beneficiaryName: shortText,
  needKinds: multiEnum(NEED_KINDS),
  triggers: multiEnum(TRIGGERS),
  housingProblems: multiEnum(HOUSING_PROBLEMS),
  roomsCount: smallCount(0, 20),
  yearsThere: smallCount(0, 80),
  rentTnd: smallCount(0, 20000),
  utilities: multiEnum(UTILITIES),
  buildingState: optionalEnum(BUILDING_STATES),
  childrenCount: smallCount(0, 20),
  elderlyCount: smallCount(0, 10),
  disabilityNote: shortText,
  headStatus: optionalEnum(HEAD_STATUSES),
  incomeRange: optionalEnum(INCOME_RANGES),
  mainEarnerJob: shortText,
  socialCoverage: multiEnum(SOCIAL_COVERAGE),
  existingAid: optionalEnum(YES_NO_UNKNOWN),
  landStatus: optionalEnum(LAND_STATUSES),
  hasMaterials: checkbox,
  savingsRange: optionalEnum(SAVINGS_RANGES),
  familyHelp: checkbox,
  canWork: checkbox,
  stepsTaken: multiEnum(STEPS_TAKEN),
  canVisit: checkbox,
  referenceNote: shortText,
  bestTime: optionalEnum(BEST_TIMES),
  altPhone: shortText,
  addressNote: shortText,

  consent: checkbox.refine((v) => v === true),
})

export type SupportRequestData = z.output<typeof supportRequestSchema>
