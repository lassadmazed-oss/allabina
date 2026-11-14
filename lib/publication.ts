/**
 * نشر المشروع — المنطق الخالص.
 *
 * القسم 09: المشروع خاصّ افتراضياً، ولا يُنشر إلّا بموافقة الحريف
 * **ومراجعة الإدارة**، ويبقى إيقاف النشر ممكناً.
 *
 * وموافقتان لا واحدة ليست تشدّداً: الحريف يملك قصّته، والشركة تملك ما
 * يُنشر باسمها. وإحداهما بلا الأخرى تنشر إمّا ما لم يأذن به صاحبه،
 * وإمّا ما لم تراجعه الإدارة.
 */

export type Consents = {
  clientAt: string | null
  directionAt: string | null
  isPublic: boolean
}

export type PublicationState =
  /** لا موافقة ولا اعتماد */
  | 'private'
  /** الحريف وافق، والإدارة لا */
  | 'needs_direction'
  /** الإدارة اعتمدت، والحريف لم يوافق */
  | 'needs_client'
  /** الموافقتان حاضرتان ولم يُنشر بعد */
  | 'ready'
  | 'published'

export function publicationState(c: Consents): PublicationState {
  if (c.isPublic) return 'published'
  const client = Boolean(c.clientAt)
  const direction = Boolean(c.directionAt)
  if (client && direction) return 'ready'
  if (client) return 'needs_direction'
  if (direction) return 'needs_client'
  return 'private'
}

/** هل يجوز النشر الآن؟ الموافقتان، لا واحدة. */
export const canPublish = (c: Consents): boolean =>
  Boolean(c.clientAt) && Boolean(c.directionAt)

/**
 * ما ينقص قبل النشر، بلغة من يقرأ.
 * تُعرض كقائمة عمل في اللوحة، وكسببٍ عند الحريف.
 */
export function missingConsents(c: Consents): ('client' | 'direction')[] {
  const out: ('client' | 'direction')[] = []
  if (!c.clientAt) out.push('client')
  if (!c.directionAt) out.push('direction')
  return out
}

/**
 * أثر سحب موافقةٍ على النشر القائم.
 *
 * سحبُ أيّ طرفٍ يُنزل المنشور فوراً: «إمكانية إيقاف النشر لاحقاً» لا
 * تعني طلباً يُدرَس، بل أثراً يقع. والقاعدة تحرسه بقيدها أيضاً.
 */
export function afterWithdraw(c: Consents, who: 'client' | 'direction'): Consents {
  const next: Consents = {
    clientAt: who === 'client' ? null : c.clientAt,
    directionAt: who === 'direction' ? null : c.directionAt,
    isPublic: c.isPublic,
  }
  if (!canPublish(next)) next.isPublic = false
  return next
}

/** ما لا يخرج للعموم مهما وافق الطرفان — القسم 09 */
export const NEVER_PUBLIC = [
  'phone',
  'email',
  'full_name',
  'land_location',
  'land_lat',
  'land_lng',
  'total_ht',
  'budget',
  'monthly_income',
  'documents',
] as const

/**
 * نصّ عمومي بلا ما لا يُنشر.
 * الفحص بالاسم لا بالثقة: من يكتب الملخّص قد يضع فيه رقم هاتف.
 */
export function looksPrivate(text: string): boolean {
  const t = text ?? ''
  // رقم هاتف تونسي بثمانية أرقام، أو بريد
  return /\b\d{8}\b/.test(t.replace(/[\s.-]/g, '')) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t)
}
