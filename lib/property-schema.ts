import { z } from 'zod'

export const PROPERTY_KINDS = ['land', 'house', 'apartment', 'building', 'other'] as const
export const LEGAL_STATUSES = ['titled', 'in_progress', 'undivided', 'unregistered', 'other'] as const

const nullableNum = (min: number, max: number) =>
  z
    .union([z.literal(''), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v)))

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
