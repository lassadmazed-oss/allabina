import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  AREA_BUCKETS,
  BUDGET_BUCKETS,
  EVENTS,
  EVENT_AR,
  FUNNEL,
  MIN_SAMPLE,
  areaBucket,
  budgetBucket,
  funnelOf,
  isExploratory,
  periodStart,
  ratioReliable,
} from '@/lib/analytics'

/**
 * قياس الطلب.
 *
 * ثلاث جمل من القسم 09 تحكم هذا الملفّ، وكلّها تُختبر:
 *   «تعريف كل نسبة ومقامها وفترة القياس» — نسبة بلا مقام لا تُحسب.
 *   «فصل أشخاص فريدين عن عدد نسخ التقدير» — مئة تقدير ليست مئة شخص.
 *   «التحليلات الخارجية لا تستقبل أسماء أو أرقام أو دخل أو وثائق» —
 *   والجدول لا يملك تلك الأعمدة أصلاً.
 */
describe('الأحداث كما عرّفها الكرّاس', () => {
  it('أحد عشر حدثاً، لكلّ واحد اسم بالعربية', () => {
    expect(EVENTS).toHaveLength(11)
    for (const e of EVENTS) expect(EVENT_AR[e], e).toBeTruthy()
  })

  it('القيد في القاعدة يطابق القائمة — لا حدث يُكتب ولا يُقبل', () => {
    const sql = readFileSync('supabase/migrations/0061_analytics_events.sql', 'utf8')
    for (const e of EVENTS) expect(sql, e).toContain(`'${e}'`)
  })

  it('الاستكشاف ليس التزاماً', () => {
    expect(isExploratory('estimate')).toBe(true)
    expect(isExploratory('category_view')).toBe(true)
    expect(isExploratory('contract')).toBe(false)
    expect(isExploratory('review_requested')).toBe(false)
  })
})

describe('الفئات تحمي الهويّة', () => {
  it('المساحة تصير فئة لا قيمة', () => {
    expect(areaBucket(60)).toBe('<80')
    expect(areaBucket(120)).toBe('120-160')
    expect(areaBucket(500)).toBe('220+')
    expect(AREA_BUCKETS).toContain(areaBucket(100)!)
  })

  it('الميزانية كذلك', () => {
    expect(budgetBucket(50_000)).toBe('<80k')
    expect(budgetBucket(200_000)).toBe('150-250k')
    expect(budgetBucket(900_000)).toBe('400k+')
    expect(BUDGET_BUCKETS).toContain(budgetBucket(100_000)!)
  })

  it('الغائب والصفر والمكسور: null لا فئة أولى', () => {
    for (const v of [null, undefined, 0, -5, Number.NaN]) {
      expect(areaBucket(v as number), String(v)).toBeNull()
      expect(budgetBucket(v as number), String(v)).toBeNull()
    }
  })
})

describe('كلّ نسبة بمقامها', () => {
  const counts = { visitors: 400, trial: 120, requested: 60, verified: 48, saved: 30, review: 12 }

  it('الأولى بلا نسبة: لا شيء قبلها', () => {
    const f = funnelOf(counts)
    expect(f[0].pct).toBeNull()
    expect(f[0].ofKey).toBeNull()
  })

  it('كلّ خطوة تحمل اسم مقامها وقيمته', () => {
    const trial = funnelOf(counts).find((r) => r.step.key === 'trial')!
    expect(trial.ofKey).toBe('visitors')
    expect(trial.ofValue).toBe(400)
    expect(trial.pct).toBeCloseTo(30, 6)
    expect(trial.dropped).toBe(280)
  })

  it('مقام صفر: لا نسبة ولا صفر ولا مئة', () => {
    const f = funnelOf({ visitors: 0, trial: 0 })
    const trial = f.find((r) => r.step.key === 'trial')!
    expect(trial.pct).toBeNull()
    expect(trial.dropped).toBeNull()
  })

  it('خطوة غائبة تُعدّ صفراً لا تُحذف — الانقطاع معلومة', () => {
    const f = funnelOf(counts)
    const approved = f.find((r) => r.step.key === 'approved')!
    expect(approved.value).toBe(0)
    expect(approved.ofValue).toBe(12)
  })

  it('كلّ خطوة تعدّ أشخاصاً فريدين لا أحداثاً', () => {
    for (const s of FUNNEL) expect(s.unique, s.key).toBe(true)
  })

  it('سلسلة المقامات متّصلة: كلّ خطوة تشير إلى خطوة موجودة قبلها', () => {
    const keys = FUNNEL.map((s) => s.key)
    FUNNEL.forEach((s, i) => {
      if (!s.of) return
      expect(keys.indexOf(s.of), s.key).toBeLessThan(i)
    })
  })
})

describe('العيّنة الصغيرة', () => {
  it('«3 من 4 = 75%» لا تُعرض نسبةً', () => {
    expect(ratioReliable(4)).toBe(false)
    expect(ratioReliable(MIN_SAMPLE)).toBe(true)
    expect(ratioReliable(null)).toBe(false)
  })
})

describe('فترة القياس', () => {
  const now = new Date('2026-11-14T12:00:00Z')

  it('«منذ البداية» بلا حدّ', () => {
    expect(periodStart('all', now)).toBeNull()
  })

  it('المدد تُحسب من الآن إلى الوراء', () => {
    expect(periodStart('7d', now)!.toISOString()).toBe('2026-11-07T12:00:00.000Z')
    expect(periodStart('30d', now)!.toISOString()).toBe('2026-10-15T12:00:00.000Z')
  })
})

describe('لا معطى شخصي في جدول القياس', () => {
  const sql = readFileSync('supabase/migrations/0061_analytics_events.sql', 'utf8')

  it('لا عمود اسم ولا هاتف ولا بريد ولا دخل', () => {
    // الحارس البنيوي: ما لا يوجد لا يتسرّب
    for (const banned of ['full_name', 'phone', 'email', 'income', 'monthly_income', 'cin']) {
      expect(sql.includes(`\n  ${banned} `), banned).toBe(false)
    }
  })

  it('المساحة والميزانية فئتان لا قيمتان', () => {
    expect(sql).toContain('area_bucket')
    expect(sql).toContain('budget_bucket')
    expect(sql).not.toMatch(/surface_m2\s+numeric/)
  })

  it('لا يُقرأ بالمفتاح العمومي', () => {
    expect(sql).toMatch(/revoke all on analytics_events from anon/)
  })
})
