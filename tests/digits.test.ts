import { describe, expect, it } from 'vitest'
import { isValidPhone, normalizePhone, toAsciiDigits } from '@/lib/digits'
import { requestSchema } from '@/lib/schema'

describe('الأرقام من لوحة عربية', () => {
  it('تصير لاتينية', () => {
    expect(toAsciiDigits('٢٠١٢٣٤٥٦')).toBe('20123456')
    expect(toAsciiDigits('۲۰۱۲')).toBe('2012')
    expect(toAsciiDigits('120 م²')).toBe('120 م²')
  })

  it('الهاتف يُطبَّع: فراغات وشرطات ونقاط و00', () => {
    expect(normalizePhone('+216 20 123 456')).toBe('+21620123456')
    expect(normalizePhone('00216-20123456')).toBe('+21620123456')
    expect(normalizePhone(' 20.123.456 ')).toBe('20123456')
    expect(normalizePhone('(+33) 6 12 34 56 78')).toBe('+33612345678')
  })

  it('الصلاحية بعد التطبيع', () => {
    expect(isValidPhone('٢٠١٢٣٤٥٦')).toBe(true)
    expect(isValidPhone('20 123 456')).toBe(true)
    expect(isValidPhone('2012')).toBe(false)
    expect(isValidPhone('')).toBe(false)
  })

  it('المخطّط يقبل الأرقام الهندية في الهاتف والمساحة', () => {
    expect(requestSchema.shape.phone.safeParse('٢٠ ١٢٣ ٤٥٦')).toMatchObject({ success: true, data: '20123456' })
    expect(requestSchema.shape.desiredAreaM2.safeParse('١٢٠')).toMatchObject({ success: true, data: 120 })
    expect(requestSchema.shape.monthlyIncome.safeParse('٢٤٠٠')).toMatchObject({ success: true, data: 2400 })
  })
})
