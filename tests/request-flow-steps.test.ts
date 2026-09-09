import { describe, expect, it } from 'vitest'
import { FIELD_STEP } from '@/lib/request-flow'
import { requestSchema } from '@/lib/schema'

/**
 * كلّ حقل في المخطّط له خطوة: حقل بلا خطوة كان يُنسب إلى خطوة الاتّصال،
 * فيقرأ الحريف «معطيات الاتّصال ناقصة» والمشكل في مساحة أو دخل.
 */
describe('خريطة الحقول → الخطوات', () => {
  it('لا حقل في المخطّط بلا خطوة', () => {
    const missing = Object.keys(requestSchema.shape).filter((k) => !(k in FIELD_STEP))
    expect(missing).toEqual([])
  })

  it('الخطوات بين 1 و6', () => {
    for (const [k, v] of Object.entries(FIELD_STEP)) {
      expect(v, k).toBeGreaterThanOrEqual(1)
      expect(v, k).toBeLessThanOrEqual(6)
    }
  })
})
