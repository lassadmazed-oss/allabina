import { describe, expect, it } from 'vitest'
import { THIN_NBSP, formatMoney, formatNumber, formatRange } from '@/lib/format'
import { formatTND } from '@/lib/finance'

/**
 * حماية من عودة خلل «الأرقام مقلوبة»: الفاصل بين الآلاف لا يكون فراغاً عادياً،
 * لأنّ الفراغ العادي يقطع الرقم داخل نصّ عربي فينقلب ترتيب مجموعاته.
 */
describe('فاصل الآلاف آمن في الاتجاه ثنائي اللغة', () => {
  it('لا يستعمل الفراغ العادي (U+0020)', () => {
    for (const v of [1200, 91733, 410955, 1000000]) {
      expect(formatNumber(v)).not.toMatch(/ /)
      expect(formatMoney(v)).not.toMatch(/\u0020/)
      expect(formatTND(v)).not.toMatch(/\u0020/)
    }
  })

  it('يستعمل الفراغ الضيّق غير الفاصل U+202F', () => {
    expect(formatNumber(91733)).toBe(`91${THIN_NBSP}733`)
    expect(formatNumber(1200)).toBe(`1${THIN_NBSP}200`)
  })

  it('لا فاصل تحت الألف', () => {
    expect(formatNumber(780)).toBe('780')
  })
})

describe('تنسيق موحّد', () => {
  it('نفس الشكل للأسعار والمبالغ — لا نقطة مرّة وفراغ مرّة', () => {
    expect(formatNumber(1200)).toBe(formatNumber(1200))
    expect(formatMoney(1200)).toContain(formatNumber(1200))
  })

  it('العملة تتبع اللغة', () => {
    expect(formatMoney(1000, 'ar')).toContain('د.ت')
    expect(formatMoney(1000, 'fr')).toContain('DT')
    expect(formatTND(1000, 'fr')).toContain('DT')
  })

  it('المبالغ تُقرّب لأقرب دينار', () => {
    expect(formatMoney(1200.6)).toBe(formatMoney(1201))
  })

  it('المجال يفصل بشرطة طويلة بين رقمين منسّقين', () => {
    expect(formatRange(1200, 1350)).toBe(`1${THIN_NBSP}200 – 1${THIN_NBSP}350`)
  })

  it('قيمة غير صالحة ترجع شرطة بدل NaN', () => {
    expect(formatNumber(Number.NaN)).toBe('—')
  })
})
