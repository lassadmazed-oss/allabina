import { describe, expect, it } from 'vitest'
import { COUNTED_STATES, PUBLIC_STATES, publicStateOf } from '@/lib/public-state'

/** الحالات الداخلية كما في نوع request_status */
const INTERNAL = [
  'new',
  'contacted',
  'qualified',
  'matched',
  'appointment',
  'contract',
  'on_hold',
  'rejected',
] as const

describe('اشتقاق الحالة المعروضة للحريف', () => {
  it('كلّ حالة داخلية تُشتقّ إلى حالة معروضة معروفة', () => {
    for (const s of INTERNAL) {
      expect(PUBLIC_STATES).toContain(publicStateOf(s))
    }
  })

  it('الحلّ يعني عرضاً مطابقاً أو عقداً — لا مجرّد اتصال', () => {
    expect(publicStateOf('matched')).toBe('resolved')
    expect(publicStateOf('contract')).toBe('resolved')
    expect(publicStateOf('contacted')).not.toBe('resolved')
    expect(publicStateOf('qualified')).not.toBe('resolved')
    expect(publicStateOf('appointment')).not.toBe('resolved')
  })

  it('الانتظار للملفّات الموقوفة على معطيات', () => {
    expect(publicStateOf('on_hold')).toBe('waiting')
  })

  it('الملفّ المرفوض لا يُعدّ محلولاً ولا في المعالجة', () => {
    const state = publicStateOf('rejected')
    expect(state).toBe('closed')
    expect(COUNTED_STATES).not.toContain(state)
  })

  it('الحالات الأولى كلّها «بصدد المعالجة»', () => {
    for (const s of ['new', 'contacted', 'qualified', 'appointment'] as const) {
      expect(publicStateOf(s)).toBe('in_progress')
    }
  })

  it('حالة غير معروفة تُعامَل كبصدد المعالجة لا كمحلولة', () => {
    expect(publicStateOf('something_else')).toBe('in_progress')
  })

  it('العدّادات العمومية ثلاثة فقط', () => {
    expect(COUNTED_STATES).toHaveLength(3)
    expect([...COUNTED_STATES]).toEqual(['resolved', 'in_progress', 'waiting'])
  })
})

import { phoneMatches } from '@/lib/public-state'

describe('مطابقة رقم الهاتف في صفحة المتابعة', () => {
  it('تتسامح مع المفتاح الدولي والفراغات والشرطات', () => {
    expect(phoneMatches('+21620123456', '20123456')).toBe(true)
    expect(phoneMatches('20123456', '+216 20 123 456')).toBe(true)
    expect(phoneMatches('20123456', '20-123-456')).toBe(true)
  })

  it('ترفض رقماً مختلفاً', () => {
    expect(phoneMatches('20123456', '20123457')).toBe(false)
    expect(phoneMatches('+21620123456', '29888777')).toBe(false)
  })

  it('ترفض المدخلات القصيرة — لا مطابقة بجزء من الرقم', () => {
    expect(phoneMatches('20123456', '3456')).toBe(false)
    expect(phoneMatches('20123456', '')).toBe(false)
    expect(phoneMatches('', '20123456')).toBe(false)
  })

  it('تطابق أرقام الجالية بالخارج بآخر ثماني خانات', () => {
    expect(phoneMatches('+33612345678', '0612345678')).toBe(true)
  })
})
