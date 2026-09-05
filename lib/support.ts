/**
 * قواعد وحدة المساندة — ثوابت مشتركة بين الخادم والواجهة.
 * ملفّ منفصل عن `lib/actions/support.ts` لأنّ وحدة 'use server'
 * لا تُصدِّر إلّا دوالّ غير متزامنة.
 */

/** أحداث دفتر الشفافية بالترتيب الطبيعي للحياة: طُلب ← تُعهّد ← تأكّد ← وصل */
export const LEDGER_EVENTS = ['needed', 'pledged', 'confirmed', 'delivered', 'cancelled'] as const
export type LedgerEvent = (typeof LEDGER_EVENTS)[number]

/** كلّ أنواع المساهمة كما في القاعدة */
export const CONTRIBUTION_KINDS = [
  'land',
  'funding',
  'materials',
  'labour',
  'study',
  'admin_support',
  'other',
] as const

/**
 * أنواع المساهمة المفتوحة للعموم — بلا 'funding'.
 * المنصة لا تجمع أموالاً؛ القيد مضاعف: هنا وفي قيد على الجدول.
 */
export const PUBLIC_PLEDGE_KINDS = CONTRIBUTION_KINDS.filter((k) => k !== 'funding')

export const isPublicPledgeKind = (k: string) =>
  (PUBLIC_PLEDGE_KINDS as readonly string[]).includes(k)

/** حالات متابعة التعهّد في الـBack-office */
export const PLEDGE_STATUSES = ['new', 'contacted', 'accepted', 'declined'] as const

/**
 * تقدّم الحالة بالأعداد لا بالدنانير: «قُضيت 3 حاجيات من 5».
 * لا نعرض مجموعاً مالياً أبداً في الواجهة العمومية.
 */
export function needsProgress(needs: number, covered: number) {
  const total = Math.max(0, needs)
  const done = Math.min(Math.max(0, covered), total)
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}
