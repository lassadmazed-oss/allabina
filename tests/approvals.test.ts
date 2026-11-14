import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLA_HOURS,
  ageHours,
  deltaOf,
  overdueCount,
  priorityOf,
  sortQueue,
  type QueueItem,
} from '@/lib/approvals'

/**
 * صندوق الموافقات.
 *
 * الشرط الذي يحرسه هذا الملفّ قبل كلّ شيء: «لا اعتماد بالصمت أو
 * بانقضاء الوقت» (القسم 08). مرور المهلة يبدّل شارة ويرفع سطراً،
 * ولا يقرّر. ولا توجد في الوحدة دالّة تحوّل التأخير إلى اعتماد — وهذا
 * ما يختبره آخر وصف هنا.
 */
const now = new Date('2026-11-14T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  id: 'x',
  refCode: 'DEV-2026-000001',
  kind: 'dev',
  version: 1,
  status: 'in_review',
  requestId: 'r',
  requestRef: 'LB-2026-000001',
  clientName: 'فلان',
  submittedAt: hoursAgo(1),
  submittedBy: null,
  totalHt: 100000,
  previousTotalHt: null,
  validUntil: null,
  staleApproval: false,
  ...over,
})

describe('عمر الطلب', () => {
  it('يُحسب بالساعات من وقت التقديم', () => {
    expect(ageHours(hoursAgo(5), now)).toBeCloseTo(5, 5)
  })

  it('بلا تاريخ تقديم: صفر لا NaN', () => {
    expect(ageHours(null, now)).toBe(0)
  })

  it('تاريخ في المستقبل لا يعطي عمراً سالباً', () => {
    expect(ageHours(new Date(now.getTime() + 3_600_000), now)).toBe(0)
  })
})

describe('درجة الاستعجال', () => {
  it('ثلاث درجات لا اثنتان — «قارب» تسبق «تجاوز»', () => {
    expect(priorityOf(1)).toBe('fresh')
    expect(priorityOf(DEFAULT_SLA_HOURS / 2)).toBe('due')
    expect(priorityOf(DEFAULT_SLA_HOURS)).toBe('overdue')
    expect(priorityOf(DEFAULT_SLA_HOURS * 3)).toBe('overdue')
  })

  it('المهلة تُبدَّل، فالتصنيف يتبعها', () => {
    expect(priorityOf(10, 8)).toBe('overdue')
    expect(priorityOf(10, 48)).toBe('fresh')
  })
})

describe('الأثر المالي — قبل/بعد', () => {
  it('النسخة الأولى بلا فرق: لا شيء قبلها', () => {
    expect(deltaOf(100000, null)).toBeNull()
  })

  it('بلا تغيير: لا شارة', () => {
    expect(deltaOf(100000, 100000)).toBeNull()
  })

  it('الزيادة والنقص يُميَّزان بالاتّجاه لا بالإشارة وحدها', () => {
    expect(deltaOf(110000, 100000)).toEqual({ amount: 10000, pct: 10, direction: 'up' })
    expect(deltaOf(90000, 100000)).toEqual({ amount: -10000, pct: -10, direction: 'down' })
  })

  it('سابق صفر: نسبة بلا معنى فتُترك فارغة ولا تُقسَم على صفر', () => {
    const d = deltaOf(5000, 0)
    expect(d?.pct).toBeNull()
    expect(d?.amount).toBe(5000)
  })
})

describe('الترتيب', () => {
  it('المتجاوز أوّلاً، ثمّ الأقدم تقديماً', () => {
    const q = sortQueue(
      [
        item({ id: 'fresh', submittedAt: hoursAgo(1) }),
        item({ id: 'old-overdue', submittedAt: hoursAgo(100) }),
        item({ id: 'due', submittedAt: hoursAgo(30) }),
        item({ id: 'overdue', submittedAt: hoursAgo(50) }),
      ],
      now
    )
    expect(q.map((i) => i.id)).toEqual(['old-overdue', 'overdue', 'due', 'fresh'])
  })

  it('صندوق يرتّب بالأحدث يدفن ما تأخّر — فالترتيب تصاعدي داخل الدرجة', () => {
    const q = sortQueue(
      [item({ id: 'b', submittedAt: hoursAgo(2) }), item({ id: 'a', submittedAt: hoursAgo(10) })],
      now
    )
    expect(q[0].id).toBe('a')
  })

  it('لا يبدّل المصفوفة الأصلية', () => {
    const src = [item({ id: '1', submittedAt: hoursAgo(1) }), item({ id: '2', submittedAt: hoursAgo(99) })]
    sortQueue(src, now)
    expect(src.map((i) => i.id)).toEqual(['1', '2'])
  })
})

describe('شارة المدخل', () => {
  it('تعدّ ما تجاوز المهلة وحده', () => {
    const list = [item({ submittedAt: hoursAgo(1) }), item({ submittedAt: hoursAgo(99) })]
    expect(overdueCount(list, DEFAULT_SLA_HOURS, now)).toBe(1)
  })
})

describe('لا اعتماد بالصمت', () => {
  it('الوحدة لا تصدّر شيئاً يقرّر: حساب وتصنيف وترتيب فقط', async () => {
    const mod = await import('@/lib/approvals')
    const deciding = Object.keys(mod).filter((k) => /approve|decide|auto|grant/i.test(k))
    expect(deciding, 'مرور المهلة يرفع سطراً ولا يعتمد').toEqual([])
  })

  it('المتجاوز يبقى «قيد المراجعة» — الدرجة للعرض لا للحالة', () => {
    const q = sortQueue([item({ submittedAt: hoursAgo(500) })], now)
    expect(q[0].status).toBe('in_review')
  })
})
