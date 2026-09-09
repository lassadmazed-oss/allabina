/**
 * تحويل المطلب المخزَّن إلى القيم التي تفهمها الاستمارة، والعكس:
 * مقارنة ما كان بما صار.
 *
 * بلا server-only عمداً: منطق خالص بلا قاعدة ولا كوكيز، فيُختبَر وحده.
 */

export type RequestRow = {
  full_name: string
  phone: string
  email: string | null
  gov_code: string
  delegation_id: number | null
  imada_id: number | null
  land_location: string | null
  request_type: string
  desired_area_m2: number | null
  desired_land_m2: number | null
  bedrooms: number | null
  horizon: string | null
  standing: string | null
  urgency: string | null
  urgency_note: string | null
  flexibility: string[] | null
  problem_note: string | null
  foprolos_interest: boolean | null
  is_first_home: boolean | null
  has_social_housing: boolean | null
  cnss_affiliated: boolean | null
  cnss_number_years: number | null
  problem_type: string | null
  financing_state: string | null
  cash_ready: boolean | null
  // الخريطة حسب المسار
  apartment_state?: string | null
  floor_pref?: string | null
  elevator_needed?: boolean | null
  parking_needed?: boolean | null
  renovation_works?: string[] | null
  current_area_m2?: number | null
  extension_area_m2?: number | null
}

export type FinanceRow = {
  monthly_income_tnd: number | null
  spouse_income_tnd: number | null
  other_income_tnd: number | null
  existing_loans_tnd: number | null
  down_payment_tnd: number | null
  max_monthly_tnd: number | null
  employment: string | null
  seniority_months: number | null
  is_expat: boolean | null
  expat_country: string | null
}

export type ConfigRow = {
  levels: number | null
  bathrooms: number | null
  living_rooms: number | null
  kitchens: number | null
  garage: boolean | null
  terrasse: boolean | null
  jardin: boolean | null
  cloture: boolean | null
  majel: boolean | null
  piscine: boolean | null
  annexe: boolean | null
  solar: boolean | null
  ascenseur: boolean | null
}

export type SocialRow = {
  household_size: number | null
  dependents: number | null
  has_disability: boolean | null
  housing_condition: string | null
  housing_problems: string[] | null
  income_stability: string | null
  is_renting: boolean | null
  rent_tnd: number | null
}

export type LandRow = {
  area_m2: number | null
  title_status: string | null
  has_water: boolean | null
  has_power: boolean | null
  has_road: boolean | null
  has_permit: boolean | null
  in_urban_plan?: string | null
  existing_building?: string | null
  has_plans?: string | null
}

/** الدار الحالية — لمن يرمّم */
export type HomeRow = {
  ownership: string | null
  building_age_years: number | null
  title_status: string | null
  has_permit: boolean | null
}

export type FormValues = Record<string, string | boolean>

/** رقم غائب يصير خانة فارغة لا صفراً: الصفر معطى، والفراغ غياب معطى. */
const s = (v: number | string | null | undefined) =>
  v === null || v === undefined ? '' : String(v)

const b = (v: boolean | null | undefined) => v === true

/**
 * الأشهر ترجع سنين بكسر واحد.
 * 18 شهراً = 1.5 سنة، و‍17 = 1.4 — التقريب لا يخسر أكثر من شهر.
 */
export function monthsToYears(months: number | null | undefined): string {
  if (months === null || months === undefined) return ''
  return String(Math.round((months / 12) * 10) / 10)
}

export function toFormValues(
  r: RequestRow,
  f: FinanceRow | null,
  land: LandRow | null,
  cfg: ConfigRow | null = null,
  social: SocialRow | null = null,
  declaredDocs: readonly string[] = [],
  home: HomeRow | null = null
): FormValues {
  return {
    requestType: r.request_type,
    govCode: r.gov_code,
    delegationId: s(r.delegation_id),
    imadaId: s(r.imada_id),
    landLocation: r.land_location ?? '',
    desiredAreaM2: s(r.desired_area_m2),
    desiredLandM2: s(r.desired_land_m2),
    bedrooms: s(r.bedrooms),
    horizon: r.horizon ?? '',
    standing: r.standing ?? '',
    urgency: r.urgency ?? '',
    urgencyNote: r.urgency_note ?? '',
    flexibility: (r.flexibility ?? []).join(','),
    problemNote: r.problem_note ?? '',
    apartmentState: r.apartment_state ?? '',
    floorPref: r.floor_pref ?? '',
    elevatorNeeded: b(r.elevator_needed),
    parkingNeeded: b(r.parking_needed),
    works: (r.renovation_works ?? []).join(','),
    currentAreaM2: s(r.current_area_m2),
    extensionAreaM2: s(r.extension_area_m2),

    foprolosInterest: b(r.foprolos_interest),
    isFirstHome: b(r.is_first_home),
    hasSocialHousing: b(r.has_social_housing),
    cnssAffiliated: b(r.cnss_affiliated),
    cnssYears: s(r.cnss_number_years),

    levels: s(cfg?.levels ?? null),
    bathrooms: s(cfg?.bathrooms ?? null),
    livingRooms: s(cfg?.living_rooms ?? null),
    kitchens: s(cfg?.kitchens ?? null),
    garage: b(cfg?.garage),
    terrasse: b(cfg?.terrasse),
    jardin: b(cfg?.jardin),
    cloture: b(cfg?.cloture),
    majel: b(cfg?.majel),
    piscine: b(cfg?.piscine),
    annexe: b(cfg?.annexe),
    solar: b(cfg?.solar),
    ascenseur: b(cfg?.ascenseur),

    householdSize: s(social?.household_size ?? null),
    dependents: s(social?.dependents ?? null),
    hasDisability: b(social?.has_disability),
    housingCondition: social?.housing_condition ?? '',
    incomeStability: social?.income_stability ?? '',
    // «كاري» تُقرأ من الحيازة: عمود is_renting مشتقّ لا مصدر
    rentTnd: s(social?.rent_tnd ?? null),
    problemType: r.problem_type ?? '',
    financingState: r.financing_state ?? '',
    cashReady: b(r.cash_ready),

    // نفس شكل المرونة: نصّ بفواصل تفهمه الاستمارة
    documents: [...declaredDocs].sort().join(','),

    landAreaM2: s(land?.area_m2 ?? null),
    titleStatus: land?.title_status ?? '',
    hasWater: b(land?.has_water),
    hasPower: b(land?.has_power),
    hasRoad: b(land?.has_road),
    hasPermit: b(land?.has_permit),
    inUrbanPlan: land?.in_urban_plan ?? '',
    existingBuilding: land?.existing_building ?? '',
    hasPlans: land?.has_plans ?? '',
    ownership: home?.ownership ?? '',
    buildingAge: s(home?.building_age_years ?? null),
    homeTitleStatus: home?.title_status ?? '',
    homePermit: b(home?.has_permit),

    monthlyIncome: s(f?.monthly_income_tnd ?? null),
    spouseIncome: s(f?.spouse_income_tnd ?? null),
    otherIncome: s(f?.other_income_tnd ?? null),
    existingLoans: s(f?.existing_loans_tnd ?? null),
    downPayment: s(f?.down_payment_tnd ?? null),
    maxMonthly: s(f?.max_monthly_tnd ?? null),
    employment: f?.employment ?? '',
    seniorityYears: monthsToYears(f?.seniority_months),
    isExpat: b(f?.is_expat),
    expatCountry: f?.expat_country ?? '',

    fullName: r.full_name,
    phone: r.phone,
    email: r.email ?? '',

    // الموافقة مُعطاة أصلاً وقت الإرسال الأوّل؛ نبقيها مؤشَّرة حتى لا
    // تُطلَب مرّة ثانية على تعديل بسيط.
    consent: true,
  }
}

export type Change = { from: unknown; to: unknown }

/**
 * حقول رقمية اختيارية يحوّل فيها المخطّط الفراغ إلى صفر.
 *
 * الخانة تُترك فارغة، والقاعدة تسجّل null، ويرجع المخطّط 0 — فيقرأ
 * المقارِن «تبدّل من فراغ إلى صفر» في كلّ حفظ. سجلّ تدقيق يمتلئ بتبديل
 * لم يقع يفقد قيمته، ويجرّ معه إعادة حساب تنقيط بلا سبب.
 */
const EMPTY_IS_ZERO = new Set([
  'spouseIncome',
  'otherIncome',
  'existingLoans',
  'downPayment',
  'maxMonthly',
  'seniorityYears',
])

/** ما تبدّل فعلاً بين قيمتين، بمفاتيح الاستمارة كما يقرأها الإنسان. */
export function diffValues(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): Record<string, Change> {
  const out: Record<string, Change> = {}
  for (const k of fields) {
    const zeroish = EMPTY_IS_ZERO.has(k)
    const a = normalize(before[k], zeroish)
    const z = normalize(after[k], zeroish)
    if (a !== z) out[k] = { from: before[k] ?? null, to: after[k] ?? null }
  }
  return out
}

/**
 * «1500» و1500 نفس الشيء، و''‏ وnull وundefined كلّها «ما عطاش قيمة».
 * بلا هذا يظهر كلّ حقل كأنّه تبدّل لمجرّد أنّه عاد من الاستمارة نصّاً.
 */
function normalize(v: unknown, emptyIsZero = false): string {
  if (v === null || v === undefined) return emptyIsZero ? '0' : ''
  // القوائم مجموعات لا تسلسلات: ترتيب التأشير ليس معطى يتبدّل
  if (Array.isArray(v)) return [...v].map(String).sort().join(',')
  if (typeof v === 'boolean') return v ? '1' : ''
  const str = String(v).trim()
  if (emptyIsZero && (str === '' || str === '0')) return '0'
  return str
}

/** الحقول التي يملك صاحب المطلب حقّ تبديلها. */
export const OWNER_FIELDS = [
  'requestType',
  'delegationId',
  'imadaId',
  'landLocation',
  'desiredAreaM2',
  'desiredLandM2',
  'bedrooms',
  'horizon',
  'standing',
  'urgency',
  'urgencyNote',
  'flexibility',
  'problemNote',
  'foprolosInterest',
  'isFirstHome',
  'hasSocialHousing',
  'cnssAffiliated',
  'cnssYears',
  'levels',
  'bathrooms',
  'livingRooms',
  'kitchens',
  'garage',
  'terrasse',
  'jardin',
  'cloture',
  'majel',
  'piscine',
  'annexe',
  'solar',
  'ascenseur',
  'apartmentState',
  'floorPref',
  'elevatorNeeded',
  'parkingNeeded',
  'works',
  'currentAreaM2',
  'extensionAreaM2',
  'inUrbanPlan',
  'existingBuilding',
  'hasPlans',
  'ownership',
  'buildingAge',
  'homeTitleStatus',
  'homePermit',
  'householdSize',
  'dependents',
  'hasDisability',
  'housingCondition',
  'incomeStability',
  'rentTnd',
  'problemType',
  'financingState',
  'cashReady',
  'documents',
  'landAreaM2',
  'titleStatus',
  'hasWater',
  'hasPower',
  'hasRoad',
  'hasPermit',
  'monthlyIncome',
  'spouseIncome',
  'otherIncome',
  'existingLoans',
  'downPayment',
  'maxMonthly',
  'employment',
  'seniorityYears',
  'isExpat',
  'expatCountry',
  'fullName',
  'phone',
  'email',
] as const

/**
 * الحقول التي تدخل في التنقيط. تبدّل واحد منها يعني أنّ الصنف المحسوب
 * قبل التعديل ما عادش يمثّل الملفّ، فيُعاد الحساب.
 */
export const SCORING_FIELDS = [
  'requestType',
  'desiredAreaM2',
  'standing',
  'horizon',
  'landAreaM2',
  'titleStatus',
  'monthlyIncome',
  'spouseIncome',
  'otherIncome',
  'existingLoans',
  'downPayment',
  'maxMonthly',
  'employment',
  'seniorityYears',
  'delegationId',
  'bedrooms',
  'email',
] as const

export function touchesScore(changes: Record<string, Change>): boolean {
  return SCORING_FIELDS.some((f) => f in changes)
}

/**
 * أسماء الحقول بالعربية لخطّ زمن الملفّ في اللوحة.
 *
 * الفريق يقرأ «عدد الغرف» لا `bedrooms`: سجلّ التدقيق يُقرأ من إنسان،
 * فاسم المتغيّر في الكود ليس اسماً في الواجهة.
 */
export const FIELD_LABELS_AR: Record<string, string> = {
  requestType: 'نوع المطلب',
  delegationId: 'المعتمدية',
  imadaId: 'العمادة',
  landLocation: 'موقع الأرض',
  desiredAreaM2: 'المساحة المطلوبة',
  desiredLandM2: 'مساحة الأرض المطلوبة',
  bedrooms: 'عدد الغرف',
  horizon: 'الأجل',
  standing: 'مستوى التشطيب',
  urgency: 'درجة الاستعجال',
  urgencyNote: 'تفصيل الاستعجال',
  flexibility: 'المرونة',
  problemNote: 'وصف المشكل',
  foprolosInterest: 'الاهتمام بفوبرولوس',
  isFirstHome: 'أوّل سكن',
  hasSocialHousing: 'استفاد من سكن اجتماعي',
  cnssAffiliated: 'منخرط في الضمان',
  cnssYears: 'سنوات الضمان',
  levels: 'عدد الطوابق',
  bathrooms: 'عدد الحمّامات',
  livingRooms: 'عدد الصالونات',
  kitchens: 'عدد المطابخ',
  garage: 'جراج',
  terrasse: 'تراس',
  jardin: 'حديقة',


  cloture: 'سور الأرض',

  majel: 'ماجل',

  piscine: 'مسبح',

  annexe: 'بيت خارجي / ملحق',

  solar: 'ألواح شمسية',

  ascenseur: 'مصعد',
  apartmentState: 'حالة الشقّة',
  floorPref: 'الطابق',
  elevatorNeeded: 'مصعد ضروري',
  parkingNeeded: 'موقف سيارة ضروري',
  works: 'نوع الأشغال',
  currentAreaM2: 'المساحة الحالية',
  extensionAreaM2: 'المساحة المضافة',
  inUrbanPlan: 'داخل مثال التهيئة',
  existingBuilding: 'بناء قائم',
  hasPlans: 'رسم معماري',
  ownership: 'ملكية الدار',
  buildingAge: 'عمر البناء',
  homeTitleStatus: 'وضعية ملكية الدار',
  homePermit: 'رخصة التوسعة',
  householdSize: 'عدد أفراد العائلة',
  dependents: 'عدد المُعالين',
  hasDisability: 'إعاقة أو مرض مزمن',
  housingCondition: 'وضعية السكن الحالية',
  incomeStability: 'استقرار الدخل',
  rentTnd: 'الكراء الشهري',
  problemType: 'أكبر عائق',
  financingState: 'وضع التمويل',
  cashReady: 'التمويل حاضر',
  documents: 'الوثائق المصرَّح بها',
  landAreaM2: 'مساحة الأرض',
  titleStatus: 'وضعية الرسم',
  hasWater: 'الماء',
  hasPower: 'الكهرباء',
  hasRoad: 'الطريق',
  hasPermit: 'رخصة البناء',
  monthlyIncome: 'الدخل الشهري',
  spouseIncome: 'دخل القرين',
  otherIncome: 'مداخيل أخرى',
  existingLoans: 'الأقساط الجارية',
  downPayment: 'المساهمة الذاتية',
  maxMonthly: 'أقصى قسط',
  employment: 'نوع الشغل',
  seniorityYears: 'الأقدمية',
  isExpat: 'مقيم بالخارج',
  expatCountry: 'بلد الإقامة',
  fullName: 'الاسم',
  phone: 'الهاتف',
  email: 'البريد',
}

/** «عدد الغرف، الدخل الشهري» — ما يُكتب في خطّ زمن الملفّ */
export const changedLabels = (changes: Record<string, Change>): string =>
  Object.keys(changes)
    .map((k) => FIELD_LABELS_AR[k] ?? k)
    .join('، ')
