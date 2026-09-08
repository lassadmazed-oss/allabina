import { z } from 'zod'
import { AVAILABILITIES, LEGAL_STATUSES } from '@/lib/network'
import { parseLooseInt } from '@/lib/property-schema'

/** رقم اختياري ضمن مجال — نفس تسامح استمارة العقار مع طريقة كتابة الأرقام */
const nullableNum = (min: number, max: number) =>
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

/** قائمة معرّفات وصلت من خانات اختيار متعدّدة: "3,7,12" أو مكرّرة في FormData */
const idList = (max = 60) =>
  z
    .unknown()
    .optional()
    .transform((v) => {
      const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
      const ids = raw
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
      return [...new Set(ids)].slice(0, max)
    })

export const intervenantSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  companyName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => v ?? ''),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^\+?\d{8,15}$/.test(v)),
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ?? '').replace(/[\s-]/g, '')),
  email: z
    .union([z.literal(''), z.string().email()])
    .optional()
    .transform((v) => v ?? ''),

  categoryId: z.coerce.number().int().positive(),
  extraCategoryIds: idList(10),
  skillIds: idList(40),
  legalStatus: z.enum(LEGAL_STATUSES),
  yearsExperience: nullableNum(0, 70),
  bio: z
    .string()
    .max(1500)
    .optional()
    .transform((v) => v ?? ''),

  govCode: z.string().min(2).max(8),
  delegationId: nullableNum(1, 1_000_000),
  zoneId: nullableNum(1, 1_000_000),
  address: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v ?? ''),
  zoneDelegationIds: idList(40),
  radiusKm: nullableNum(0, 500),

  availability: z.enum(AVAILABILITIES).optional().default('available'),
  availableFrom: z
    .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .transform((v) => (v ? v : null)),

  consent: z
    .union([z.boolean(), z.literal('on'), z.literal('')])
    .optional()
    .transform((v) => v === true || v === 'on')
    .refine((v) => v === true),
})

export type IntervenantData = z.output<typeof intervenantSchema>
