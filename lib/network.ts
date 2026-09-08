/**
 * شبكة المتدخلين والمزوّدين — كراس الشروط، القسم 17.
 *
 * الأنواع والعناوين ومسار الاعتماد. التصنيفات والمهارات والوثائق ليست هنا
 * عمداً: هي في قاعدة البيانات لتُدار من الـBack-office بلا مطوّر (القسم 25).
 */

export const INTERVENANT_STATUSES = [
  'new',
  'to_verify',
  'docs_missing',
  'verified',
  'validated',
  'suspended',
  'rejected',
  'archived',
] as const
export type IntervenantStatus = (typeof INTERVENANT_STATUSES)[number]

export const LEGAL_STATUSES = [
  'independent',
  'worker',
  'patente',
  'company',
  'sole_prop',
  'supplier',
  'design_office',
  'engineer',
  'other',
] as const
export type LegalStatus = (typeof LEGAL_STATUSES)[number]

export const AVAILABILITIES = ['available', 'busy', 'available_from', 'unavailable'] as const
export type Availability = (typeof AVAILABILITIES)[number]

export const STATUS_LABELS: Record<IntervenantStatus, string> = {
  new: 'جديد',
  to_verify: 'في انتظار التحقّق',
  docs_missing: 'وثائق ناقصة',
  verified: 'تمّ التحقّق',
  validated: 'معتمَد',
  suspended: 'معلَّق',
  rejected: 'مرفوض',
  archived: 'مؤرشَف',
}

export const LEGAL_LABELS: Record<LegalStatus, string> = {
  independent: 'حرفي مستقلّ',
  worker: 'عامل',
  patente: 'صاحب Patente',
  company: 'شركة',
  sole_prop: 'مؤسّسة فردية',
  supplier: 'مزوّد',
  design_office: 'مكتب دراسات',
  engineer: 'مهندس / خبير',
  other: 'وضعية أخرى',
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'متوفّر',
  busy: 'مشغول',
  available_from: 'متوفّر ابتداءً من',
  unavailable: 'غير متوفّر',
}

/** المعتمَد وحده يظهر في المطابقة. البقيّة ملفّات قيد المعالجة. */
export const isActiveInNetwork = (s: IntervenantStatus) => s === 'validated'

/**
 * مسار الاعتماد. ليس رسماً حرّاً: كلّ انتقال مسموح مذكور صراحةً حتى لا
 * يقفز ملفّ من «جديد» إلى «معتمَد» بلا تحقّق ولا أثر.
 */
const TRANSITIONS: Record<IntervenantStatus, IntervenantStatus[]> = {
  new: ['to_verify', 'rejected', 'archived'],
  to_verify: ['docs_missing', 'verified', 'rejected', 'archived'],
  docs_missing: ['to_verify', 'verified', 'rejected', 'archived'],
  verified: ['validated', 'docs_missing', 'rejected', 'archived'],
  validated: ['suspended', 'archived'],
  suspended: ['validated', 'rejected', 'archived'],
  rejected: ['to_verify', 'archived'],
  archived: ['to_verify'],
}

export const nextStatuses = (from: IntervenantStatus): IntervenantStatus[] =>
  TRANSITIONS[from] ?? []

export const canTransition = (from: IntervenantStatus, to: IntervenantStatus): boolean =>
  nextStatuses(from).includes(to)

export const isStatus = (v: unknown): v is IntervenantStatus =>
  typeof v === 'string' && (INTERVENANT_STATUSES as readonly string[]).includes(v)

export const isAvailability = (v: unknown): v is Availability =>
  typeof v === 'string' && (AVAILABILITIES as readonly string[]).includes(v)

export type CategoryRow = {
  id: number
  code: string
  family_code: string
  name_ar: string
  name_fr: string | null
}

export type SkillRow = {
  id: number
  category_id: number
  name_ar: string
  name_fr: string | null
}

export type FamilyRow = {
  code: string
  name_ar: string
  name_fr: string | null
}
