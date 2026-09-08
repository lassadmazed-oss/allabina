import { z } from 'zod'

export const PROPERTY_KINDS = ['land', 'house', 'apartment', 'building', 'other'] as const
export const LEGAL_STATUSES = ['titled', 'in_progress', 'undivided', 'unregistered', 'other'] as const

/**
 * «150 000» و«150.000» و«150,000» كلّها 150000. الناس يكتبون الثمن كما
 * يقرؤونه، والاستمارة كانت ترفض «الثمن لازم يكون رقماً صحيحاً» على مسافة.
 * فاصل الآلاف بالفرنسية مسافة أو نقطة؛ لا نخمّن كسوراً في أثمان بالدينار.
 */
export function parseLooseInt(input: unknown): number | null | undefined {
  if (input === undefined) return undefined
  const raw = String(input).trim()
  if (raw === '') return null
  // أرقام عربية-هندية → لاتينية
  const latin = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  // فواصل الآلاف: مسافة عادية أو رفيعة أو ثابتة، نقطة، فاصلة، فاصلة عليا
  const digits = latin.replace(/[\s  .,'’]/g, '')
  if (!/^-?\d+$/.test(digits)) return NaN
  return Number(digits)
}

// ملاحظة Zod v4: المفتاح الغائب يحتاج optional() صراحةً حتى مع unknown()
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

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.literal(''), z.enum(values)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v))

export const propertySchema = z.object({
  kind: z.enum(PROPERTY_KINDS),
  govCode: z.string().min(2).max(8),
  delegationId: nullableNum(1, 1_000_000),
  imadaId: nullableNum(1, 1_000_000),
  address: z.string().max(200).optional().transform((v) => v ?? ''),
  lat: nullableNum(-90, 90),
  lng: nullableNum(-180, 180),
  areaM2: nullableNum(10, 1_000_000),
  builtAreaM2: nullableNum(10, 100_000),
  rooms: nullableNum(1, 20),
  priceTnd: nullableNum(1000, 100_000_000),
  negotiable: z
    .union([z.boolean(), z.literal('on'), z.literal('')])
    .optional()
    .transform((v) => v === true || v === 'on'),
  legalStatus: nullableEnum(LEGAL_STATUSES),
  description: z.string().max(2000).optional().transform((v) => v ?? ''),

  ownerName: z.string().trim().min(3).max(120),
  ownerPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^\+?\d{8,15}$/.test(v)),
  ownerEmail: z
    .union([z.literal(''), z.string().email()])
    .optional()
    .transform((v) => v ?? ''),
  ownerNote: z.string().max(1000).optional().transform((v) => v ?? ''),

  consent: z
    .union([z.boolean(), z.literal('on'), z.literal('')])
    .optional()
    .transform((v) => v === true || v === 'on')
    .refine((v) => v === true),
})

export type PropertyData = z.output<typeof propertySchema>
