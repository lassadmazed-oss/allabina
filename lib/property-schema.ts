import { z } from 'zod'

export const PROPERTY_KINDS = ['land', 'house', 'apartment', 'building', 'other'] as const
export const LEGAL_STATUSES = ['titled', 'in_progress', 'undivided', 'unregistered', 'other'] as const
export const CONDITIONS = ['new', 'good', 'to_refresh', 'to_renovate'] as const

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

/**
 * عدد عشري للإحداثيات: «34.783508» أو «34,783508». هنا النقطة فاصلة عشرية
 * لا فاصل آلاف — عكس الأثمان. خلطُ الاثنين هو ما حوّل 34.78 إلى 34 مليوناً.
 */
export function parseLooseDecimal(input: unknown): number | null | undefined {
  if (input === undefined) return undefined
  const raw = String(input).trim()
  if (raw === '') return null
  const latin = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(latin)) return NaN
  return Number(latin)
}

const nullableDecimal = (min: number, max: number) =>
  z
    .unknown()
    .optional()
    .transform((v, ctx) => {
      const n = parseLooseDecimal(v)
      if (n === undefined || n === null) return null
      if (Number.isNaN(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `expected decimal in [${min}, ${max}]` })
        return z.NEVER
      }
      return n
    })

/**
 * خانة اختيار ثلاثية الدلالة: مُعلَّمة → true، غير مُعلَّمة → null.
 * «ما علّمش جراج» لا يعني «ما فيه جراج» — قد لا يكون انتبه. الجزم بـfalse
 * يُضلّل المطابقة، وnull يقول الحقيقة: لم يُذكر.
 */
const optionalTri = z
  .union([z.literal('on'), z.literal(''), z.boolean()])
  .optional()
  .transform((v) => (v === 'on' || v === true ? true : null))

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
  lat: nullableDecimal(-90, 90),
  lng: nullableDecimal(-180, 180),
  areaM2: nullableNum(10, 1_000_000),
  builtAreaM2: nullableNum(10, 100_000),
  rooms: nullableNum(1, 20),
  priceTnd: nullableNum(1000, 100_000_000),
  negotiable: z
    .union([z.boolean(), z.literal('on'), z.literal('')])
    .optional()
    .transform((v) => v === true || v === 'on'),
  legalStatus: nullableEnum(LEGAL_STATUSES),

  // تفاصيل المسكن — كلّها اختيارية
  bedrooms: nullableNum(0, 30),
  livingRooms: nullableNum(0, 10),
  bathrooms: nullableNum(0, 20),
  floors: nullableNum(1, 30),
  floorNumber: nullableNum(0, 60),
  yearBuilt: nullableNum(1800, 2100),
  condition: nullableEnum(CONDITIONS),
  garage: optionalTri,
  garden: optionalTri,
  terrace: optionalTri,
  elevator: optionalTri,
  furnished: optionalTri,
  waterConnected: optionalTri,
  powerConnected: optionalTri,

  // تفاصيل الأرض
  roadAccess: optionalTri,
  frontageM: nullableDecimal(0.5, 1000),
  buildable: optionalTri,
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
