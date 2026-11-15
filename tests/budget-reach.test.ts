import { describe, expect, it } from 'vitest'
import {
  PHASES,
  fullStages,
  missingStages,
  neededFor,
  phaseOfLot,
  configFromParams,
  reachOf,
  type LotCost,
} from '@/lib/budget-reach'

/**
 * «بميزانيتك توصل لوين».
 *
 * الخطأ هنا لا يُحدث عطباً: يُحدث وعداً. خانةٌ يؤشّر فيها الحريف على
 * «الهيكل» بـ30 ألف تَعِد بما لا يقع، ويكتشفه في العرض بعد أن بنى
 * توقّعه — وتلك خسارةُ ثقةٍ لا تُسترجع.
 */
const lots = (over: Partial<Record<number, number>> = {}): LotCost[] =>
  [
    { code: 1, nameAr: 'الدراسات', totalHt: over[1] ?? 2000 },
    { code: 2, nameAr: 'الحفر', totalHt: over[2] ?? 2431 },
    { code: 3, nameAr: 'الأساسات', totalHt: over[3] ?? 8395 },
    { code: 4, nameAr: 'الخرسانة', totalHt: over[4] ?? 23981 },
    { code: 5, nameAr: 'البناء', totalHt: over[5] ?? 13181 },
    { code: 10, nameAr: 'الفرش', totalHt: over[10] ?? 9000 },
  ]

describe('الأشواط', () => {
  it('كلّ لوط في شطر واحد لا أكثر', () => {
    const seen = new Set<number>()
    for (const p of PHASES) {
      for (const l of p.lots) {
        expect(seen.has(l), `اللوط ${l} في أكثر من شطر`).toBe(false)
        seen.add(l)
      }
    }
  })

  it('والعشرون لوطاً كلّهم مغطّون', () => {
    for (let i = 1; i <= 20; i++) expect(phaseOfLot(i), `اللوط ${i} بلا شطر`).not.toBeNull()
  })

  it('والترتيب ترتيب تنفيذ: الهيكل قبل التشطيب', () => {
    const keys = PHASES.map((p) => p.key)
    expect(keys.indexOf('structure')).toBeLessThan(keys.indexOf('finish'))
    expect(keys.indexOf('study')).toBeLessThan(keys.indexOf('structure'))
    expect(keys.indexOf('handover')).toBe(keys.length - 1)
  })
})

describe('وين توقف الميزانية', () => {
  it('المثال الحقيقي: 30 ألف على مشروع هيكله 48 ألف', () => {
    // الدراسة 2 000 + الحفر والأساسات والخرسانة والبناء = 47 988
    const r = reachOf(lots(), 30000)
    expect(r.total).toBe(58988)
    expect(r.stopAt?.key).toBe('structure')
    // 30 000 − 2 000 دراسة = 28 000 من 47 988 للهيكل
    expect(r.stopAt?.pct).toBeCloseTo(58.3, 1)
    expect(r.complete).toBe(false)
  })

  it('الشطر المغطّى يُقال كاملاً، وما بعده لا يُبدأ', () => {
    const r = reachOf(lots(), 30000)
    expect(fullStages(r).map((s) => s.key)).toEqual(['study'])
    expect(missingStages(r).map((s) => s.key)).toEqual(['finish'])
  })

  it('ميزانية تكفي كلّ شيء: لا توقّف', () => {
    const r = reachOf(lots(), 80000)
    expect(r.complete).toBe(true)
    expect(r.stopAt).toBeNull()
    expect(r.remaining).toBe(0)
    expect(r.stages.every((s) => s.state === 'full')).toBe(true)
  })

  it('وميزانية صفر: لا شيء يُغطّى، والمجموع يبقى معروفاً', () => {
    const r = reachOf(lots(), 0)
    expect(r.covered).toBe(0)
    expect(r.remaining).toBe(58988)
    expect(r.stopAt).toBeNull()
    expect(r.stages.every((s) => s.state === 'none')).toBe(true)
  })

  it('وميزانية تكفي شطراً بالضبط: مغطّى كاملاً لا جزئياً', () => {
    const r = reachOf(lots(), 2000)
    expect(r.stages[0].state).toBe('full')
    expect(r.stopAt).toBeNull()
  })

  it('النسبة داخل الشطر لا من المشروع — «60% من الهيكل» تُفهم', () => {
    const r = reachOf([{ code: 4, nameAr: 'الخرسانة', totalHt: 10000 }], 6000)
    expect(r.stopAt?.pct).toBe(60)
  })
})

describe('كم ينقص', () => {
  it('لإكمال شطرٍ بعينه', () => {
    const r = reachOf(lots(), 30000)
    // الوصول لآخر الهيكل يحتاج 2 000 + 47 988 = 49 988
    expect(neededFor(r, 'structure')).toBe(19988)
  })

  it('وما غُطّي لا ينقصه شيء', () => {
    expect(neededFor(reachOf(lots(), 30000), 'study')).toBeNull()
  })

  it('وشطرٌ غير موجود في المشروع لا يُسأل عنه', () => {
    expect(neededFor(reachOf(lots(), 30000), 'handover')).toBeNull()
  })
})

describe('ما لا يُحسب', () => {
  it('لوط خارج الأشواط يُهمَل ولا يُسقط الحساب', () => {
    const r = reachOf([...lots(), { code: 99, nameAr: 'غريب', totalHt: 5000 }], 30000)
    expect(r.total).toBe(58988)
  })

  it('وميزانية غير عدد تُعامل صفراً لا NaN', () => {
    const r = reachOf(lots(), Number.NaN)
    expect(r.budget).toBe(0)
    expect(r.covered).toBe(0)
  })

  it('ولوط بكلفة صفر لا يظهر شطراً فارغاً', () => {
    const r = reachOf([{ code: 1, nameAr: 'الدراسات', totalHt: 0 }], 1000)
    expect(r.stages).toHaveLength(0)
  })
})

/**
 * القيم الافتراضية.
 *
 * Number('') يساوي صفراً، وهو عددٌ صحيحٌ موجب — فكانت الخانة الفارغة
 * تمرّ صفراً بدل أن ترجع للافتراضي، فيخرج المكوّن بمساحة صفر وغرف
 * صفر، ويقول الرسم «ما تدخلش» قبل أن يكتب الحريف شيئاً.
 */
describe('قراءة المواصفات من العنوان', () => {
  it('الخانة الغائبة والفارغة ترجعان للافتراضي', () => {
    expect(configFromParams({}).surface).toBe(100)
    expect(configFromParams({ s: '' }).surface).toBe(100)
    expect(configFromParams({ s: '   ' }).bedrooms).toBe(2)
  })

  it('والصفر الصريح كذلك: مساحة صفر ليست مشروعاً', () => {
    expect(configFromParams({ s: '0' }).surface).toBe(100)
  })

  it('والقيمة الصحيحة تُقرأ، والكبيرة تُسقَف', () => {
    expect(configFromParams({ s: '140' }).surface).toBe(140)
    expect(configFromParams({ s: '99999' }).surface).toBe(2000)
  })
})
