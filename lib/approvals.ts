/**
 * صندوق الموافقات — المنطق الخالص.
 *
 * كرّاس الشروط V2، القسم 08: «تظهر مهمة ومؤشر تأخير؛ **لا اعتماد
 * بالصمت أو بانقضاء الوقت**».
 *
 * هذا الملفّ يحسب التأخير ويصنّفه، ولا يقرّر شيئاً: مرور المهلة يبدّل
 * لون شارة ويرفع السطر إلى الأعلى، ولا يعتمد ولا يرفض. الصمت ليس
 * موافقة، ولا توجد هنا دالّة تجعله كذلك.
 */

export type Priority = 'overdue' | 'due' | 'fresh'

/** المهلة الافتراضية — تُبدَّل من «المعطيات المرجعية» بمفتاح approvals.sla_hours */
export const DEFAULT_SLA_HOURS = 48

export function ageHours(submittedAt: string | Date | null, now: Date = new Date()): number {
  if (!submittedAt) return 0
  const ms = now.getTime() - new Date(submittedAt).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

/**
 * ثلاث درجات لا اثنتان: «قارب» تختلف عن «تجاوز».
 * المراجع الذي يرى الأحمر وحده يكتشف التأخير بعد وقوعه.
 */
export function priorityOf(hours: number, sla: number = DEFAULT_SLA_HOURS): Priority {
  if (hours >= sla) return 'overdue'
  if (hours >= sla * 0.5) return 'due'
  return 'fresh'
}

export type Delta = { amount: number; pct: number | null; direction: 'up' | 'down' }

/**
 * «تفاصيل قبل/بعد، أثر مالي» — الفرق عن النسخة السابقة.
 * النسخة الأولى بلا فرق: لا شيء قبلها تُقارن به.
 */
export function deltaOf(total: number, previous: number | null | undefined): Delta | null {
  if (previous === null || previous === undefined) return null
  const amount = total - previous
  if (amount === 0) return null
  return {
    amount,
    pct: previous === 0 ? null : (amount / previous) * 100,
    direction: amount > 0 ? 'up' : 'down',
  }
}

export type QueueItem = {
  id: string
  refCode: string
  kind: string
  version: number
  status: string
  requestId: string
  requestRef: string
  clientName: string
  submittedAt: string | null
  submittedBy: string | null
  totalHt: number
  previousTotalHt: number | null
  validUntil: string | null
  /** الاعتماد ساقط: المحتوى تبدّل بعده */
  staleApproval: boolean
}

/**
 * الترتيب: المتجاوز أوّلاً، ثمّ الأقدم تقديماً.
 * الأحدث آخراً دائماً — صندوق يرتّب بالأحدث يدفن ما تأخّر.
 */
export function sortQueue(items: QueueItem[], now: Date = new Date()): QueueItem[] {
  const rank: Record<Priority, number> = { overdue: 0, due: 1, fresh: 2 }
  return [...items].sort((a, b) => {
    const pa = rank[priorityOf(ageHours(a.submittedAt, now))]
    const pb = rank[priorityOf(ageHours(b.submittedAt, now))]
    if (pa !== pb) return pa - pb
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
    return ta - tb
  })
}

/** عدد ما تجاوز المهلة — شارة على مدخل الصندوق */
export const overdueCount = (items: QueueItem[], sla = DEFAULT_SLA_HOURS, now: Date = new Date()) =>
  items.filter((i) => priorityOf(ageHours(i.submittedAt, now), sla) === 'overdue').length

export const KIND_LABEL: Record<string, string> = {
  est: 'تقدير آلي',
  dev: 'عرض',
  ctr: 'عقد',
  avenant: 'أشغال إضافية',
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  sent: 'مرسل',
  accepted: 'مقبول',
  changes_requested: 'تعديل مطلوب',
  expired: 'منتهي',
  obsolete: 'ملغى',
}
