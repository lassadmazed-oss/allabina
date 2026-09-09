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

  consent: checkbox.refine((v) => v === true),
})

export type SupportRequestData = z.output<typeof supportRequestSchema>
