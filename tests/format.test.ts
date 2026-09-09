import { describe, expect, it } from 'vitest'
import {
  THIN_NBSP,
  countAr,
  formatMoney,
  formatNumber,
  formatRange,
  formatSignedMoney,
  LRI,
  PDI,
} from '@/lib/format'
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

  it('المجال يفصل بشرطة طويلة بين رقمين منسّقين، ويعزل نفسه', () => {
    // العزل جزء من الدالّة لا من نقطة الاستعمال: الشرطة بين رقمين
    // محايدة، وبلا LRI…PDI يُقرأ المجال «1 350 – 1 200» في نصّ عربي.
    expect(formatRange(1200, 1350)).toBe(`⁦1${THIN_NBSP}200 – 1${THIN_NBSP}350⁩`)
  })

  it('قيمة غير صالحة ترجع شرطة بدل NaN', () => {
    expect(formatNumber(Number.NaN)).toBe('—')
  })
})

describe('مبلغ بإشارة داخل نصّ عربي', () => {
  it('الإشارة والرقم معزولان في جزيرة LTR، والعملة خارجها', () => {
    const out = formatSignedMoney(-12000)
    expect(out.startsWith(LRI)).toBe(true)
    expect(out).toContain(`−12 000${PDI}`)
    expect(out.endsWith('د.ت')).toBe(true)
  })

  it('الموجب بعلامة +، والصفر بلا إشارة', () => {
    expect(formatSignedMoney(3900)).toContain('+3 900')
    expect(formatSignedMoney(0)).toContain(`${LRI}0${PDI}`)
  })

  it('بالفرنسية نفس العزل والعملة DT', () => {
    expect(formatSignedMoney(-2160, 'fr')).toMatch(/⁦−2 160⁩ DT$/)
  })
})

describe('العدّ العربي', () => {
  const F = { one: 'عرض واحد', two: 'عرضان', few: 'عروض', many: 'عرضاً' }

  it('المفرد والمثنى بلا رقم', () => {
    expect(countAr(1, F)).toBe('عرض واحد')
    expect(countAr(2, F)).toBe('عرضان')
  })

  it('جمع القلّة من 3 إلى 10', () => {
    expect(countAr(5, F)).toContain('عروض')
    expect(countAr(10, F)).toContain('عروض')
  })

  it('التمييز المفرد من 11 فما فوق', () => {
    expect(countAr(11, F)).toContain('عرضاً')
    expect(countAr(333, F)).toContain('عرضاً')
  })

  it('الصفر جمع لا مفرد', () => {
    expect(countAr(0, F)).toContain('عروض')
  })

  it('المئات تتبع خانتيها: 105 جمع قلّة و112 تمييز مفرد', () => {
    expect(countAr(105, F)).toContain('عروض')
    expect(countAr(112, F)).toContain('عرضاً')
  })
})
