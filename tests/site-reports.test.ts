import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  NEEDS_NOTE,
  REPORT_GAP_DAYS,
  canSubmit,
  canTransition,
  lateDays,
  lineProgress,
  progressByLot,
  progressOf,
  reportGap,
  submitRefusals,
  sumDone,
  type ContractLine,
  type ReportDraft,
} from '@/lib/site-reports'

/**
 * التقرير اليومي ونسبة التقدّم.
 *
 * الخطأ هنا لا يُحدث عطباً: يُحدث رقماً يراه الحريف ويبني عليه ثقته.
 * «أنجزنا 60%» وهي 35% تكسر العلاقة مرّة واحدة.
 */
const line = (over: Partial<ContractLine> = {}): ContractLine => ({
  id: 'l1',
  lotCode: 4,
  lotNameAr: 'الخرسانة المسلّحة والهيكل',
  designationAr: 'أعمدة وجسور',
  unit: 'm3',
  quantity: 30,
  totalHt: 15600,
  ...over,
})

describe('النسبة تُحسب من الكمّيات لا تُكتب', () => {
  it('سطر واحد: 18 من 30 تعني 60% بقيمتها', () => {
    const lines = [line()]
    const p = progressOf(lines, [{ devisLineId: 'l1', qtyDone: 18 }])
    expect(p.pct).toBe(60)
    expect(p.doneValue).toBeCloseTo(9360, 3)
    expect(p.totalValue).toBe(15600)
  })

  it('والكمّيات تتجمّع من تقارير عدّة', () => {
    const entries = [
      { devisLineId: 'l1', qtyDone: 6 },
      { devisLineId: 'l1', qtyDone: 6 },
      { devisLineId: 'l1', qtyDone: 6 },
    ]
    expect(sumDone(entries).get('l1')).toBe(18)
    expect(progressOf([line()], entries).pct).toBe(60)
  })

  it('الوزن بالقيمة لا بعدد الأسطر — مئة متر دهن ليست مئة متر خرسانة', () => {
    const lines = [
      line({ id: 'beton', quantity: 30, totalHt: 15600 }),
      line({ id: 'peinture', lotCode: 14, quantity: 300, totalHt: 4200 }),
    ]
    // الدهن كامل والخرسانة صفر: النسبة قيمة الدهن من المجموع، لا 50%
    const p = progressOf(lines, [{ devisLineId: 'peinture', qtyDone: 300 }])
    expect(p.pct).toBeCloseTo(21.2, 1)
  })

  it('سطرٌ أُنجز بزيادة لا يعوّض سطراً لم يبدأ', () => {
    const lines = [
      line({ id: 'a', quantity: 10, totalHt: 1000 }),
      line({ id: 'b', quantity: 10, totalHt: 1000 }),
    ]
    // 20 من 10 في الأوّل، وصفر في الثاني: 50% لا 100%
    expect(progressOf(lines, [{ devisLineId: 'a', qtyDone: 20 }]).pct).toBe(50)
  })

  it('بلا عقد لا نسبة — null لا صفر', () => {
    expect(progressOf([], []).pct).toBeNull()
    expect(progressOf([line({ totalHt: 0 })], []).pct).toBeNull()
  })

  it('والكمّية السالبة أو غير العدد تُهمَل', () => {
    const done = sumDone([
      { devisLineId: 'l1', qtyDone: -5 },
      { devisLineId: 'l1', qtyDone: Number.NaN },
      { devisLineId: 'l1', qtyDone: 3 },
    ])
    expect(done.get('l1')).toBe(3)
  })
})

describe('الزيادة على العقد تُقال', () => {
  it('أكثر من المتعاقَد عليه يُوسَم، والنسبة تبقى مسقوفة', () => {
    const [p] = lineProgress([line({ quantity: 30 })], [{ devisLineId: 'l1', qtyDone: 34 }])
    expect(p.overrun).toBe(true)
    expect(p.pct).toBe(100)
    expect(p.qtyDone).toBe(34)
  })

  it('وما دون العقد لا يُوسَم', () => {
    const [p] = lineProgress([line()], [{ devisLineId: 'l1', qtyDone: 30 }])
    expect(p.overrun).toBe(false)
  })
})

describe('التقدّم لكلّ لوط', () => {
  it('يُجمع داخل اللوط ويُرتَّب برقمه', () => {
    const lines = [
      line({ id: 'a', lotCode: 9, lotNameAr: 'الكهرباء', quantity: 10, totalHt: 1000 }),
      line({ id: 'b', lotCode: 4, quantity: 10, totalHt: 1000 }),
    ]
    const out = progressByLot(lines, [{ devisLineId: 'a', qtyDone: 5 }])
    expect(out.map((l) => l.lotCode)).toEqual([4, 9])
    expect(out.find((l) => l.lotCode === 9)!.pct).toBe(50)
    expect(out.find((l) => l.lotCode === 4)!.pct).toBe(0)
  })
})

describe('ما يمنع تقديم التقرير', () => {
  const draft = (over: Partial<ReportDraft> = {}): ReportDraft => ({
    done: 'صببنا أعمدة الطابق الأوّل',
    blocked: null,
    blockedReason: null,
    nextPlan: 'نكمّلو الجسور',
    lines: [{ devisLineId: 'l1', qtyDone: 6 }],
    photos: 2,
    ...over,
  })

  it('التقرير الكامل يُقدَّم', () => {
    expect(canSubmit(draft())).toBe(true)
    expect(submitRefusals(draft())).toEqual([])
  })

  it('الفارغ لا يُراجَع', () => {
    expect(submitRefusals(draft({ done: null, lines: [] }))).toContain('empty')
  })

  it('«ما تعملش» بلا سبب لا يفيد', () => {
    expect(submitRefusals(draft({ blocked: 'ما صببناش', blockedReason: null }))).toContain(
      'blocked_without_reason'
    )
    expect(
      submitRefusals(draft({ blocked: 'ما صببناش', blockedReason: 'مطر من الصباح' }))
    ).toEqual([])
  })

  it('وبرنامج الغد هو اللي يخلّي التقرير أداة موش أرشيف', () => {
    expect(submitRefusals(draft({ nextPlan: '  ' }))).toContain('no_next_plan')
  })

  it('وبلا صورة ما يتقدّمش: الحريف يصدّق اللي يشوف', () => {
    expect(submitRefusals(draft({ photos: 0 }))).toContain('no_photo')
  })
})

describe('مسار الاعتماد', () => {
  it('المسوّدة تُقدَّم، والمقدَّم يُعتمد أو يُرفض', () => {
    expect(canTransition('draft', 'submitted')).toBe(true)
    expect(canTransition('submitted', 'approved')).toBe(true)
    expect(canTransition('submitted', 'rejected')).toBe(true)
  })

  it('والمسوّدة لا تُعتمد مباشرة', () => {
    expect(canTransition('draft', 'approved')).toBe(false)
  })

  it('والمرفوض يُصلَح ويُقدَّم، لا يُعتمد من مكانه', () => {
    expect(canTransition('rejected', 'submitted')).toBe(true)
    expect(canTransition('rejected', 'approved')).toBe(false)
  })

  it('والمعتمَد لا يُحرَّر صامتاً — يُفتح بالرفض وحده', () => {
    expect(canTransition('approved', 'submitted')).toBe(false)
    expect(canTransition('approved', 'rejected')).toBe(true)
  })
})

describe('التأخير والانقطاع', () => {
  const today = new Date('2026-11-14T00:00:00Z')

  it('التأخير بالأيّام على الموعد المتوقَّع', () => {
    expect(lateDays('2026-11-10', today)).toBe(4)
    expect(lateDays('2026-11-20', today)).toBe(-6)
  })

  it('وبلا موعد ما نقولوش «في وقتها» — نقولو ما فمّاش قياس', () => {
    expect(lateDays(null, today)).toBeNull()
    expect(lateDays('كلام', today)).toBeNull()
  })

  it('وانقطاع التقارير يُقاس بآخر معتمَد', () => {
    expect(reportGap('2026-11-13', today)).toBe(1)
    expect(reportGap('2026-11-09', today)).toBe(5)
    expect(reportGap(null, today)).toBeNull()
    expect(REPORT_GAP_DAYS).toBe(2)
  })
})

/**
 * ثلاث قواعد تعيش في القاعدة لا في الشاشة: شاشةٌ تُنسى، والقاعدة لا.
 */
describe('ما تحرسه القاعدة', () => {
  const sql = readFileSync('supabase/migrations/0069_chantiers.sql', 'utf8')

  it('تقرير واحد لكلّ يوم لكلّ ورشة — تقريران يحتسبان الكمّيات مرّتين', () => {
    expect(sql).toMatch(/unique \(chantier_id, report_date\)/)
  })

  it('والكمّية المنجزة موجبة', () => {
    expect(sql).toMatch(/qty_done\s+numeric\(12, 3\) not null check \(qty_done > 0\)/)
  })

  it('والكمّية تشير إلى سطر العقد نفسه لا إلى نصّ حرّ', () => {
    expect(sql).toMatch(/devis_line_id bigint not null references devis_lines \(id\)/)
  })

  it('والتوقّف والإلغاء يُعلَّلان', () => {
    expect(NEEDS_NOTE).toEqual(['paused', 'stopped'])
    expect(sql).toContain('status_note')
  })

  it('ولا شيء من الورشة يُقرأ بالمفتاح العمومي', () => {
    for (const t of ['chantiers', 'site_reports', 'site_report_lines', 'site_report_photos']) {
      expect(sql).toMatch(new RegExp(`revoke all on ${t} from anon`))
    }
  })
})

/**
 * ما لا يصل الحريف أبداً.
 *
 * خانةٌ داخلية تتسرّب لا تُحدث خطأً: تُحدث قراءةَ الحريف لنقاشٍ لم
 * يكن له. والحارس هنا على **مصدر القراءة** لا على الشاشة: شاشةٌ
 * تُصلَح، وقراءةٌ تحمل الحقل تبقى تحمله لكلّ شاشة تأتي بعدها.
 */
describe('حدود ما يراه الحريف', () => {
  const client = readFileSync('lib/client-site.ts', 'utf8')

  it('قراءة الحريف ما تطلبش الملاحظات الداخلية', () => {
    expect(client).not.toContain('internal_note')
    expect(client).not.toContain('internalNote')
  })

  it('ولا القرار المطلوب من الإدارة', () => {
    expect(client).not.toContain('decision_needed')
  })

  it('ولا الكمّيات المنجزة ولا أسعار الأسطر', () => {
    expect(client).not.toContain('site_report_lines')
    expect(client).not.toContain('qty_done')
  })

  it('وما تقرا إلّا المعتمَد', () => {
    expect(client).toMatch(/\.eq\('status', 'approved'\)/)
  })

  it('وتفحص الملكية قبل أيّ قراءة', () => {
    expect(client).toMatch(/\.eq\('user_id', userId\)/)
  })
})
