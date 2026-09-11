/**
 * صور أعمال المتدخّلين ومنتوجات المزوّدين — القواعد النقيّة المشتركة بين الخادم والواجهة.
 *
 * الشبكة أداة داخلية: المخزن خاصّ، والعرض برابط موقَّع يولّده الخادم للفريق.
 * الرفع نفسه في lib/actions/network-photos.ts.
 */

export const NETWORK_PHOTO_BUCKET = 'network-photos'

export const NETWORK_PHOTO_KINDS = ['work', 'product'] as const
export type NetworkPhotoKind = (typeof NETWORK_PHOTO_KINDS)[number]

export const NETWORK_PHOTO_KIND_AR: Record<NetworkPhotoKind, string> = {
  work: 'أعمال',
  product: 'منتوجات',
}

export const NETWORK_PHOTO_KIND_HINT: Record<NetworkPhotoKind, string> = {
  work: 'ما أنجزه في حضائر سابقة',
  product: 'ما يصنعه أو يبيعه',
}

export const isNetworkPhotoKind = (v: unknown): v is NetworkPhotoKind =>
  typeof v === 'string' && (NETWORK_PHOTO_KINDS as readonly string[]).includes(v)

/** المزوّد يُعرف بما يبيع، والحرفي والفنّي والشركة بما أنجزوا */
export const defaultPhotoKind = (familyCode: string | null | undefined): NetworkPhotoKind =>
  familyCode === 'supplier' ? 'product' : 'work'

/** دفعة واحدة تبقى تحت حدّ جسم الطلب (16 ميغا في next.config) */
export const MAX_NETWORK_PHOTOS_PER_UPLOAD = 6

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/**
 * مسار الملفّ في المخزن: <المتدخّل>/<النوع>/<الوقت>-<عشوائي>.<الامتداد>
 * العشوائي يمنع التصادم عند رفع ستّ صور في نفس الثانية.
 */
export function networkPhotoPath(
  intervenantId: string,
  kind: NetworkPhotoKind,
  mime: string,
  random: string = Math.random().toString(36).slice(2, 8),
  now: Date = new Date()
) {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${intervenantId}/${kind}/${stamp}-${random}.${EXT[mime] ?? 'bin'}`
}

export type NetworkPhoto = {
  id: string
  intervenant_id: string
  kind: NetworkPhotoKind
  storage_path: string
  caption_ar: string | null
  sort_order: number
  created_at: string
}

type Sortable = Pick<NetworkPhoto, 'sort_order' | 'created_at'>

/** ترتيب الفريق أوّلاً (الغلاف أصغر رقم)، ثمّ الأقدم رفعاً */
export function sortNetworkPhotos<T extends Sortable>(photos: T[]): T[] {
  return photos.slice().sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
}

/** صورة جديدة تلحق بآخر الترتيب */
export const nextSortOrder = (orders: number[]) => (orders.length ? Math.max(...orders) + 1 : 0)

/** الغلاف: رقم أصغر من كلّ صور المتدخّل */
export const coverSortOrder = (orders: number[]) => (orders.length ? Math.min(...orders) : 0) - 1

/**
 * ما تعرضه بطاقة المتدخّل في القائمة: الغلاف، ثمّ مصغّرات، ثمّ «+N».
 * الغلاف لا يتكرّر في المصغّرات.
 */
export function photoStrip<T extends Sortable & Pick<NetworkPhoto, 'kind'>>(photos: T[], thumbs = 3) {
  const [cover = null, ...rest] = sortNetworkPhotos(photos)
  return {
    cover,
    thumbs: rest.slice(0, thumbs),
    more: Math.max(0, rest.length - thumbs),
    works: photos.filter((p) => p.kind === 'work').length,
    products: photos.filter((p) => p.kind === 'product').length,
  }
}

/** تجميع حسب النوع في الملفّ الكامل — نوع العائلة أوّلاً، والنوع الفارغ يُحذف */
export function groupByKind<T extends Sortable & Pick<NetworkPhoto, 'kind'>>(
  photos: T[],
  familyCode?: string | null
): { kind: NetworkPhotoKind; photos: T[] }[] {
  const order: NetworkPhotoKind[] = defaultPhotoKind(familyCode) === 'product' ? ['product', 'work'] : ['work', 'product']
  const sorted = sortNetworkPhotos(photos)
  return order
    .map((kind) => ({ kind, photos: sorted.filter((p) => p.kind === kind) }))
    .filter((g) => g.photos.length > 0)
}
