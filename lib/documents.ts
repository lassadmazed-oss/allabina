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
 * تسمية الوثيقة عربية («رسم عقاري / عقد ملكية»)؛ مسار المخزن يحتاج
 * لاتينياً قصيراً ثابتاً. جدول صريح أوضح من تحويل صوتي عامّ.
 */
const DOC_SLUGS: Record<string, string> = {
  'بطاقة تعريف': 'id-card',
  'شهادة في العمل': 'work-certificate',
  'كشف حساب بنكي': 'bank-statement',
  'رسم عقاري / عقد ملكية': 'land-title',
  'رخصة بناء': 'building-permit',
  'أمثلة ودراسات': 'plans',
}

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
