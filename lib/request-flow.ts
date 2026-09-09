/**
 * خريطة الاستمارة: نوع المطلب → ما يظهر.
 *
 * القاعدة الواحدة: **السؤال يظهر فقط إذا كان جوابه يبدّل شيئاً في الملفّ**
 * — التنقيط أو المطابقة أو العرض التقديري أو عمل المستشار. سؤال لا يبدّل
 * شيئاً يكلّف مواطناً يترك الاستمارة.
 *
 * كانت الشروط مبعثرة في الاستمارة (isBuild · needsStanding · needsSpecs ·
 * wantsLand) فتُقرأ الشفرة لا القاعدة. هنا مكان واحد، بلا React ولا
 * قاعدة بيانات، مع اختبار لكلّ خليّة في مصفوفة الخطّة.
 */

export const FLOW_TYPES = [
  'build_on_land',
  'land_and_house',
  'apartment',
  'renovation',
  'other',
] as const
export type FlowType = (typeof FLOW_TYPES)[number]

/** ما يمكن أن يُعمل في دار قائمة — اختيار متعدّد */
export const RENOVATION_WORKS = [
  'repair',
  'extension',
  'add_floor',
  'interior',
  'facade',
  'roof',
  'networks',
] as const
export type RenovationWork = (typeof RENOVATION_WORKS)[number]

export const APARTMENT_STATES = ['ready', 'off_plan'] as const
export const FLOOR_PREFS = ['ground', 'upper', 'any'] as const
export const OWNERSHIPS = ['owner', 'heirs', 'tenant'] as const
export const URBAN_PLAN_STATES = ['yes', 'no', 'unknown'] as const
export const EXISTING_BUILDING = ['none', 'demolish', 'keep'] as const
export const PLAN_STATES = ['none', 'draft', 'approved'] as const

export type FlowInput = {
  requestType: string
  apartmentState?: string
  works?: readonly string[]
  levels?: number
  ownership?: string
  hasDisability?: boolean
}

export type Field =
  | 'builtArea'
  | 'currentArea'
  | 'extensionArea'
  | 'landArea'
  | 'bedrooms'
  | 'horizon'
  | 'apartmentState'
  | 'floorPref'
  | 'elevatorNeeded'
  | 'parkingNeeded'
  | 'works'
  | 'constructionSystem'
  | 'standing'
  | 'levels'
  | 'bathrooms'
  | 'livingRooms'
  | 'kitchens'
  | 'extras'
  | 'urgency'
  | 'flexibility'
  | 'problemNote'
  | 'problemType'
  | 'landStep'
  | 'homeStep'

/** صياغة سؤال المكان — نفس الحقل، أربع حقائق */
export type LocationWording = 'own_land' | 'wish' | 'existing_home' | 'current'

export const ALL_FLEXIBILITY = [
  'area',
  'zone',
  'standing',
  'timing',
  'type',
  'budget',
  'levels',
  'phased',
  'title',
  'lot',
] as const
export type FlexKey = (typeof ALL_FLEXIBILITY)[number]

export const ALL_EXTRAS = [
  'garage',
  'terrasse',
  'jardin',
  'cloture',
  'majel',
  'piscine',
  'annexe',
  'solar',
  'ascenseur',
] as const
export type ExtraKey = (typeof ALL_EXTRAS)[number]

/**
 * المساران المخفيّان (اقتصادي · كراء مملّك) يبقيان في القاعدة لستّة ملفّات.
 * في التعديل يُعامَلان كشقّة: أقرب شكل لهما، ولا نسأل صاحبهما عن طوابق.
 */
export function normalizeType(t: string): FlowType {
  if ((FLOW_TYPES as readonly string[]).includes(t)) return t as FlowType
  if (t === 'economic' || t === 'rent_to_own') return 'apartment'
  return 'other'
}

const has = (works: readonly string[] | undefined, w: RenovationWork) =>
  Boolean(works?.includes(w))

export type Flow = {
  type: FlowType
  fields: ReadonlySet<Field>
  has: (f: Field) => boolean
  flexibility: readonly FlexKey[]
  extras: readonly ExtraKey[]
  location: LocationWording
  /** موقع الأرض حقيقة ثابتة لمن يملكها — بلا موقع لا مطابقة ولا مقاول */
  locationRequired: boolean
  /** الخطوة المالية تبقى لكنّها تُطوى: من لا يريد لا يُستجوَب */
  financeOptional: boolean
  /** ترتيب الخطوات الفعلي لهذا المسار — الشريط العلوي يقرأه */
  steps: readonly number[]
  /** المستأجر لا يرمّم ما لا يملكه — يُقال له بلطف ويُوجَّه */
  blocked: 'tenant' | null
  /** الإعاقة في الخطوة 4 تقترح شيئاً في الخطوة 2 */
  disabilityHint: 'ground_or_elevator' | 'elevator' | null
  /** الترميم فيه بناء؟ — يفتح طريقة البناء والطوابق */
  structural: boolean
}

export function requestFlow(input: FlowInput): Flow {
  const type = normalizeType(input.requestType)
  const works = input.works ?? []
  const extension = has(works, 'extension')
  const addFloor = has(works, 'add_floor')
  const structural = type === 'renovation' && (extension || addFloor)
  const offPlan = type === 'apartment' && input.apartmentState === 'off_plan'

  const fields = new Set<Field>()
  const add = (...fs: Field[]) => fs.forEach((f) => fields.add(f))

  // المشترك بين الكلّ
  add('horizon', 'urgency', 'problemNote')

  switch (type) {
    case 'build_on_land':
      add(
        'builtArea', 'bedrooms', 'constructionSystem', 'standing',
        'levels', 'bathrooms', 'livingRooms', 'kitchens', 'extras',
        'flexibility', 'landStep'
      )
      break
    case 'land_and_house':
      add(
        'builtArea', 'landArea', 'bedrooms', 'constructionSystem', 'standing',
        'levels', 'bathrooms', 'livingRooms', 'kitchens', 'extras', 'flexibility'
      )
      break
    case 'apartment':
      add(
        'builtArea', 'bedrooms', 'apartmentState', 'floorPref',
        'elevatorNeeded', 'parkingNeeded', 'bathrooms', 'flexibility'
      )
      if (offPlan) add('standing')
      break
    case 'renovation':
      add('works', 'currentArea', 'standing', 'extras', 'flexibility', 'homeStep')
      if (extension) add('extensionArea', 'bedrooms', 'bathrooms', 'livingRooms', 'kitchens')
      if (structural) add('constructionSystem')
      if (addFloor) add('levels')
      break
    case 'other':
      // الحكاية والاستعجال والعائق — لا «مطلوب» ليُتنازَل عنه
      add('problemType')
      break
  }

  const flexibility: FlexKey[] = (() => {
    switch (type) {
      case 'build_on_land':
        return ['area', 'standing', 'timing', 'budget', 'levels', 'phased']
      case 'land_and_house':
        return ['area', 'zone', 'standing', 'timing', 'type', 'budget', 'levels', 'phased', 'title', 'lot']
      case 'apartment':
        return offPlan
          ? ['area', 'zone', 'standing', 'timing', 'type', 'budget']
          : ['area', 'zone', 'timing', 'type', 'budget']
      case 'renovation':
        return addFloor
          ? ['area', 'standing', 'timing', 'budget', 'levels', 'phased']
          : ['area', 'standing', 'timing', 'budget', 'phased']
      case 'other':
        return []
    }
  })()

  const extras: ExtraKey[] = (() => {
    switch (type) {
      case 'build_on_land':
      case 'land_and_house':
        return [...ALL_EXTRAS]
      case 'renovation':
        // ما يُضاف إلى دار قائمة فعلاً
        return ['cloture', 'majel', 'solar', 'ascenseur']
      default:
        return []
    }
  })()

  const location: LocationWording =
    type === 'build_on_land'
      ? 'own_land'
      : type === 'renovation'
        ? 'existing_home'
        : type === 'other'
          ? 'current'
          : 'wish'

  const steps = [1, 2, ...(fields.has('landStep') || fields.has('homeStep') ? [3] : []), 4, 5, 6]

  const blocked = type === 'renovation' && input.ownership === 'tenant' ? 'tenant' : null

  const disabilityHint = !input.hasDisability
    ? null
    : type === 'apartment'
      ? 'ground_or_elevator'
      : type === 'build_on_land' || type === 'land_and_house'
        ? 'elevator'
        : null

  return {
    type,
    fields,
    has: (f) => fields.has(f),
    flexibility,
    extras,
    location,
    locationRequired: type === 'build_on_land',
    financeOptional: type === 'other',
    steps,
    blocked,
    disabilityHint,
    structural,
  }
}

/** المصعد لا يُعرض تحت طابقين: لا معنى له في أرضي ولا في R+1 */
export const elevatorMakesSense = (levels: number | undefined) => (levels ?? 1) >= 3
