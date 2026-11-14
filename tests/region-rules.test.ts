import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  applyRegion,
  pickRule,
  ruleInForce,
  type PricedArticle,
  type RegionRule,
} from '@/lib/region-rules'

/**
 * قواعد المناطق.
 *
 * «المنطقة تؤثر فقط وفق قواعد معتمدة… لا نعرض تخفيضات أو توفر غير
 * مؤكد» (القسم 03). الشطر الثاني هو ما يُختبر هنا أكثر من الأوّل:
 * سعرُ منطقةٍ خمّنه أحد، أو توفّرٌ «غالباً موجود»، يصل إلى الحريف
 * بصفة التزام ولا أحد كتبه ولا اعتمده.
 */
const today = new Date('2026-11-14T12:00:00Z')

const rule = (over: Partial<RegionRule> = {}): RegionRule => ({
  id: 1,
  govCode: 'SFX',
  delegationId: null,
  lotId: null,
  transportPct: null,
  transportPerUnit: null,
  labourFactor: null,
  availability: null,
  leadTimeDays: null,
  reasonAr: 'زيادة نقل',
  reasonFr: 'Transport',
  isApproved: true,
  effectiveFrom: null,
  ...over,
})

const article = (over: Partial<PricedArticle> = {}): PricedArticle => ({
  supplyHt: 30,
  labourHt: 10,
  availability: 'on_order',
  leadTimeDays: null,
  ...over,
})

describe('ما يُطبَّق وما لا يُطبَّق', () => {
  it('غير المعتمَد لا يُطبَّق ولو كان مكتوباً وصحيحاً', () => {
    expect(ruleInForce(rule({ isApproved: false }), today)).toBe(false)
  })

  it('المعتمَد بلا تاريخ نفاذ ساري', () => {
    expect(ruleInForce(rule(), today)).toBe(true)
  })

  it('المعتمَد قبل تاريخ نفاذه لا يُطبَّق — يُكتب اليوم ويبدأ غداً', () => {
    expect(ruleInForce(rule({ effectiveFrom: '2026-12-01' }), today)).toBe(false)
    expect(ruleInForce(rule({ effectiveFrom: '2026-11-01' }), today)).toBe(true)
  })

  it('بلا قاعدة: السعر كما هو ولا يُقال للحريف شيء', () => {
    const e = applyRegion(article(), null)
    expect(e.priceHt).toBe(40)
    expect(e.reasons).toEqual([])
    expect(e.changed).toBe(false)
  })
})

describe('اختيار القاعدة — واحدة لا مجموع', () => {
  const rules = [
    rule({ id: 1, transportPct: 5 }),
    rule({ id: 2, delegationId: 7, transportPct: 12 }),
    rule({ id: 3, delegationId: 7, lotId: 5, transportPct: 20 }),
    rule({ id: 4, govCode: 'TUN', transportPct: 99 }),
  ]

  it('الأضيق تفوز: معتمدية + لوط', () => {
    expect(pickRule(rules, { govCode: 'SFX', delegationId: 7, lotId: 5 }, today)?.id).toBe(3)
  })

  it('ثمّ المعتمدية، ثمّ الولاية', () => {
    expect(pickRule(rules, { govCode: 'SFX', delegationId: 7, lotId: 9 }, today)?.id).toBe(2)
    expect(pickRule(rules, { govCode: 'SFX', delegationId: 3 }, today)?.id).toBe(1)
  })

  it('ولاية أخرى لا تلتقط قاعدة هذه', () => {
    expect(pickRule(rules, { govCode: 'TUN' }, today)?.id).toBe(4)
    expect(pickRule(rules, { govCode: 'NBL' }, today)).toBeNull()
  })

  it('غير المعتمَد مستبعَد من الاختيار أصلاً', () => {
    const out = pickRule([rule({ id: 9, delegationId: 7, transportPct: 50, isApproved: false })], {
      govCode: 'SFX',
      delegationId: 7,
    }, today)
    expect(out).toBeNull()
  })
})

describe('الأثر على السعر', () => {
  it('نسبة النقل تُضاف وتُقال', () => {
    const e = applyRegion(article(), rule({ transportPct: 10 }))
    expect(e.priceHt).toBeCloseTo(44, 6)
    expect(e.reasons).toHaveLength(1)
    expect(e.reasons[0]).toMatchObject({ kind: 'transport', text: 'زيادة نقل' })
    expect(e.reasons[0].amount).toBeCloseTo(4, 6)
  })

  it('مبلغ النقل للوحدة يُضاف كما هو', () => {
    expect(applyRegion(article(), rule({ transportPerUnit: 2.5 })).priceHt).toBeCloseTo(42.5, 6)
  })

  it('معامل اليد العاملة يمسّ اليد وحدها لا السعر كلّه', () => {
    // 30 توريد + (10 × 1.2) = 42، لا 40 × 1.2 = 48
    const e = applyRegion(article(), rule({ labourFactor: 1.2 }))
    expect(e.priceHt).toBeCloseTo(42, 6)
  })

  it('معامل دون الواحد ممكن — لكن بقرار معتمد', () => {
    expect(applyRegion(article(), rule({ labourFactor: 0.9 })).priceHt).toBeCloseTo(39, 6)
  })

  it('النقل بعد اليد العاملة لا قبلها', () => {
    // (30 + 10×1.5) + 10% = 45 + 4.5
    const e = applyRegion(article(), rule({ labourFactor: 1.5, transportPct: 10 }))
    expect(e.priceHt).toBeCloseTo(49.5, 6)
    expect(e.reasons.map((r) => r.kind)).toEqual(['labour', 'transport'])
  })

  it('سعر غير معروف يبقى غير معروف — لا يصير نقلاً وحده', () => {
    const e = applyRegion(article({ supplyHt: null, labourHt: null }), rule({ transportPct: 10 }))
    expect(e.priceHt).toBeNull()
  })
})

describe('الأثر على التوفّر', () => {
  it('قاعدة المنطقة تطغى، والسبب يُقال', () => {
    const e = applyRegion(article(), rule({ availability: 'on_survey' }))
    expect(e.availability).toBe('on_survey')
    expect(e.reasons.map((r) => r.kind)).toContain('availability')
  })

  it('نفس التوفّر ليس تغييراً', () => {
    const e = applyRegion(article({ availability: 'in_stock' }), rule({ availability: 'in_stock' }))
    expect(e.reasons).toHaveLength(0)
    expect(e.changed).toBe(false)
  })

  it('أجل التوريد يُستبدَل ويُقال', () => {
    const e = applyRegion(article({ leadTimeDays: 3 }), rule({ leadTimeDays: 10 }))
    expect(e.leadTimeDays).toBe(10)
    expect(e.reasons.map((r) => r.kind)).toContain('lead_time')
  })
})

describe('القيود في القاعدة نفسها', () => {
  const sql = readFileSync('supabase/migrations/0060_region_rules.sql', 'utf8')

  it('النقل زيادة لا نقصان', () => {
    expect(sql).toMatch(/transport_pct is null or transport_pct >= 0/)
  })

  it('قاعدة بلا أثر مرفوضة', () => {
    expect(sql).toContain('region_rules_has_effect')
  })

  it('نطاق واحد لا يتكرّر — وإلّا قاعدتان متناقضتان لنفس المنطقة', () => {
    expect(sql).toMatch(/unique index[\s\S]*region_rules_scope_idx/)
  })

  it('لا تُقرأ بالمفتاح العمومي', () => {
    expect(sql).toMatch(/revoke all on region_rules from anon/)
  })
})
