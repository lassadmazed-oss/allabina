/**
 * وثائق المطلب — القواعد النقيّة.
 *
 * وثائق شخصية: بطاقة تعريف، رسم عقاري، شهادة عمل. القاعدة الأولى هنا
 * ليست «ماذا يُقبل» بل «من يرى»: لا رابط عمومي، والوصول برابط موقّع
 * قصير العمر يولّده الخادم لعضو فريق فقط. الرفع في lib/actions/documents.ts.
 */

export const DOCUMENT_BUCKET = 'request-documents'

/** 15 MiB — نفس حدّ المخزن في 0020؛ رسم عقاري ممسوح ضوئياً يقارب هذا */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

/** عمر الرابط الموقّع بالثواني: يكفي لفتح الملفّ، ولا يعيش في تاريخ متصفّح */
export const SIGNED_URL_TTL_SECONDS = 10 * 60

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const ALLOWED_DOCUMENT_MIME = Object.keys(EXT_BY_MIME)

export type DocumentRejection = 'type' | 'size' | 'empty'

export function documentRejection(mime: string, bytes: number): DocumentRejection | null {
  if (!bytes || bytes <= 0) return 'empty'
  if (!(mime in EXT_BY_MIME)) return 'type'
  if (bytes > MAX_DOCUMENT_BYTES) return 'size'
  return null
}

/**
 * اسم آمن للتخزين: نحتفظ بالاسم الأصلي في القاعدة للعرض، أمّا المسار
 * فلا يحمل منه شيئاً — الاسم قد يحوي اسم صاحبه أو محارف تكسر الروابط.
 */
export function storagePathFor(
  requestId: string,
  docType: string,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8)
) {
  const ext = EXT_BY_MIME[mime] ?? 'bin'
  const slug = slugifyDocType(docType)
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${requestId}/${slug}/${stamp}-${random}.${ext}`
}

/**
 * وثائق ملفّ المطلب — مصدر واحد.
 *
 * `label` هو ما يُخزَّن في request_documents.doc_type (وهكذا كان منذ
 * البداية)، و`code` هو ما يمرّ في الاستمارة وفي مسار المخزن: لاتيني
 * قصير ثابت لا يتبدّل إن صحّحنا صياغة عربية.
 *
 * `askClient` = سؤال نطرحه على صاحب المطلب في الاستمارة. «أمثلة
 * ودراسات» ليست منها: يجيبها المهندس لا المواطن.
 */
export const REQUEST_DOC_TYPES = [
  { code: 'id-card', label: 'بطاقة تعريف', labelFr: "Carte d'identité", askClient: true },
  { code: 'work-certificate', label: 'شهادة في العمل', labelFr: 'Certificat de travail', askClient: true },
  { code: 'bank-statement', label: 'كشف حساب بنكي', labelFr: 'Relevé bancaire', askClient: true },
  { code: 'land-title', label: 'رسم عقاري / عقد ملكية', labelFr: 'Titre foncier / acte', askClient: true },
  { code: 'building-permit', label: 'رخصة بناء', labelFr: 'Permis de bâtir', askClient: true },
  { code: 'plans', label: 'أمثلة ودراسات', labelFr: 'Plans et études', askClient: false },
] as const

export type RequestDocCode = (typeof REQUEST_DOC_TYPES)[number]['code']

/** ما نسأل عليه المواطن في الاستمارة */
export const CLIENT_DOC_CODES = REQUEST_DOC_TYPES.filter((d) => d.askClient).map((d) => d.code)

/** الأسماء العربية بالترتيب — ما تنتظره اللوحة وما يُخزَّن في القاعدة */
export const DOC_TYPE_LABELS = REQUEST_DOC_TYPES.map((d) => d.label)

/** رمز ← الاسم المخزَّن، وبالعكس */
export const docLabelOf = (code: string): string | null =>
  REQUEST_DOC_TYPES.find((d) => d.code === code)?.label ?? null
export const docCodeOf = (label: string): string | null =>
  REQUEST_DOC_TYPES.find((d) => d.label === label)?.code ?? null

const DOC_SLUGS: Record<string, string> = Object.fromEntries(
  REQUEST_DOC_TYPES.map((d) => [d.label, d.code])
)

export function slugifyDocType(docType: string): string {
  if (DOC_SLUGS[docType]) return DOC_SLUGS[docType]
  const ascii = docType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'other'
}

/** «2.4 ميغا» / «318 كيلو» — للعرض في القائمة */
export function humanSize(bytes: number, locale: 'ar' | 'fr' = 'ar'): string {
  const units = locale === 'fr' ? ['o', 'Ko', 'Mo'] : ['بايت', 'كيلو', 'ميغا']
  if (bytes < 1024) return `${bytes} ${units[0]}`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${units[1]}`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} ${units[2]}`
}

export const isPdf = (mime: string) => mime === 'application/pdf'

export type RequestFile = {
  id: string
  request_id: string
  doc_type: string
  storage_path: string
  original_name: string
  mime: string
  bytes: number
  note: string | null
  created_at: string
}

/** تجميع الملفّات تحت تسميات قائمة التحقّق، بترتيب القائمة، والغريب آخراً */
export function groupByDocType<T extends Pick<RequestFile, 'doc_type'>>(
  files: T[],
  order: readonly string[]
): { docType: string; files: T[] }[] {
  const known = order.map((docType) => ({
    docType,
    files: files.filter((f) => f.doc_type === docType),
  }))
  const extra = [...new Set(files.map((f) => f.doc_type))]
    .filter((d) => !order.includes(d))
    .sort()
    .map((docType) => ({ docType, files: files.filter((f) => f.doc_type === docType) }))
  return [...known, ...extra]
}
