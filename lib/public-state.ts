/**
 * الحالة كما يراها الحريف في صفحة المتابعة.
 * ثلاث حالات فقط، مشتقّة من الحالة الداخلية — والحالات الداخلية الدقيقة
 * (مؤهّل، موعد، عقد…) تبقى في الـBack-office.
 */
export const PUBLIC_STATES = ['resolved', 'in_progress', 'waiting', 'closed'] as const
export type PublicState = (typeof PUBLIC_STATES)[number]

/** الحالات الثلاث المعروضة في العدّادات — 'closed' يُعرض للحريف المعني فقط */
export const COUNTED_STATES = ['resolved', 'in_progress', 'waiting'] as const

export function publicStateOf(status: string): PublicState {
  switch (status) {
    case 'matched':
    case 'contract':
      return 'resolved'
    case 'on_hold':
      return 'waiting'
    case 'rejected':
      return 'closed'
    default:
      // new · contacted · qualified · appointment
      return 'in_progress'
  }
}

export type PublicStats = {
  received: number
  resolved: number
  in_progress: number
  waiting: number
  closed: number
}

export const emptyStats: PublicStats = {
  received: 0,
  resolved: 0,
  in_progress: 0,
  waiting: 0,
  closed: 0,
}

/** أرقام فقط — لتوحيد صيغ الهاتف (+216, فراغات, شرطات) */
export const digitsOnly = (v: string) => v.replace(/\D/g, '')

/**
 * مطابقة رقم الهاتف بآخر ثماني خانات: تتسامح مع المفتاح الدولي
 * (+216 20123456 = 20123456) ومع الفراغات والشرطات.
 */
export function phoneMatches(stored: string, given: string): boolean {
  const a = digitsOnly(stored)
  const b = digitsOnly(given)
  if (a.length < 8 || b.length < 8) return false
  return a.slice(-8) === b.slice(-8)
}
