import { z } from 'zod'
import { parseLooseInt } from '@/lib/property-schema'

/**
 * استمارة «نحتاج مساندة».
 *
 * أقصر ما يمكن عمداً: اللي يعمّرها في ضائقة، وكل خانة زايدة هي سبب إضافي
 * باش يوقّف في النصّ. ما نسألوش على الدخل بالدينار ولا على وثائق — هذا
 * يجي في المكالمة مع الفريق. هنا نسألو على الحاجة والوضعية برك.
 */

export const HOUSING_CONDITIONS = [
  'unsafe',
  'overcrowded',
  'rented_unstable',
  'with_family',
  'homeless',
  'other',
] as const

export const INCOME_STABILITY = ['none', 'irregular', 'low_stable', 'other'] as const

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
