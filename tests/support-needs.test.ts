import { describe, expect, it } from 'vitest'
import { CONTRIBUTION_KIND_INFO, CONTRIBUTION_KINDS, needTimeline, suggestedKinds, type LedgerLike } from '@/lib/support'

const row = (id: number, event: string, label: string, occurred_at: string, extra: Partial<LedgerLike> = {}): LedgerLike => ({
  id,
  event,
  label,
  need_id: null,
  occurred_at,
  partner_public: null,
  ...extra,
})

const cement = row(1, 'needed', '120 كيس إسمنت', '2026-07-13')
const labour = row(2, 'needed', 'يد عاملة لصبّ السقف', '2026-07-31')

describe('needTimeline', () => {
  it('حاجة بلا قيود: مطلوبة', () => {
    expect(needTimeline(cement, [cement, labour]).stage).toBe('needed')
  })

  it('تعهّد بلا معرّف يُنسب للحاجة بنصّه، ولو اختلف التشكيل والمدّ', () => {
    const pledge = row(3, 'pledged', 'تعهّد بـ120 كيس اسمنت', '2026-08-19', { partner_public: 'مخزن مواد البناء بقرمدة' })
    const pledgeAr = row(4, 'pledged', 'تعهّد بـ120 كيس إسمنت', '2026-08-19', { partner_public: 'مخزن مواد البناء بقرمدة' })
    expect(needTimeline(cement, [cement, labour, pledge]).stage).toBe('needed') // «اسمنت» بلا همزة نصّ آخر
    const t = needTimeline(cement, [cement, labour, pledgeAr])
    expect(t.stage).toBe('pledged')
    expect(t.partner).toBe('مخزن مواد البناء بقرمدة')
  })

  it('الوصول بمعرّف الحاجة يغلب كلّ شيء، حتى إلغاءً بعده', () => {
    const delivered = row(5, 'delivered', 'وصلت', '2026-08-30', { need_id: 1 })
    const cancelled = row(6, 'cancelled', 'إلغاء', '2026-09-01', { need_id: 1 })
    expect(needTimeline(cement, [cement, delivered, cancelled]).stage).toBe('delivered')
  })

  it('إلغاء أخير بلا وصول: ملغاة', () => {
    const pledged = row(7, 'pledged', 'تعهّد', '2026-08-01', { need_id: 1 })
    const cancelled = row(8, 'cancelled', 'اعتذر المتعهّد', '2026-08-05', { need_id: 1 })
    expect(needTimeline(cement, [cement, pledged, cancelled]).stage).toBe('cancelled')
  })

  it('قيد حاجة أخرى لا يُنسب إليها', () => {
    const iron = row(9, 'delivered', 'حديد تسليح للسقف — وصلت', '2026-08-31')
    expect(needTimeline(labour, [labour, iron]).stage).toBe('needed')
  })
})

describe('خيارات التدخّل', () => {
  it('لكلّ نوع مساهمة شرح ومثال', () => {
    for (const k of CONTRIBUTION_KINDS) {
      expect(CONTRIBUTION_KIND_INFO[k].ar.length).toBeGreaterThan(1)
      expect(CONTRIBUTION_KIND_INFO[k].example.length).toBeGreaterThan(1)
    }
  })

  it('يقترح أنواع التدخّل من تصريح صاحب الطلب بلا تكرار', () => {
    expect(suggestedKinds(['roof', 'labor', 'study'])).toEqual(['materials', 'labour', 'study'])
    expect(suggestedKinds(null)).toEqual([])
  })
})
