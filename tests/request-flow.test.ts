import { describe, expect, it } from 'vitest'
import { elevatorMakesSense, normalizeType, requestFlow, type Field } from '@/lib/request-flow'

const fieldsOf = (input: Parameters<typeof requestFlow>[0]) => [...requestFlow(input).fields].sort()

describe('المصفوفة — عمود عمود', () => {
  it('نبني فوق أرضي: كلّ شيء عدا مساحة الأرض المطلوبة (تُسأل في خطوة الأرض)', () => {
    const f = requestFlow({ requestType: 'build_on_land' })
    expect(f.has('landArea')).toBe(false)
    expect(f.has('landStep')).toBe(true)
    expect(f.has('constructionSystem')).toBe(true)
    expect(f.has('extras')).toBe(true)
    expect(f.locationRequired).toBe(true)
    expect(f.location).toBe('own_land')
    expect(f.steps).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('نبني فوق أرضي: لا «منطقة أخرى» ولا «نوع سكن آخر» — أرضه في مكانها', () => {
    const f = requestFlow({ requestType: 'build_on_land' })
    expect(f.flexibility).not.toContain('zone')
    expect(f.flexibility).not.toContain('type')
    expect(f.flexibility).toContain('phased')
  })

  it('أرض ودار: المساحتان معاً، وكلّ التنازلات بما فيها الأرض بشهادة عادية والتجزئة', () => {
    const f = requestFlow({ requestType: 'land_and_house' })
    expect(f.has('builtArea')).toBe(true)
    expect(f.has('landArea')).toBe(true)
    expect(f.has('landStep')).toBe(false)
    expect(f.flexibility).toEqual(
      expect.arrayContaining(['zone', 'type', 'title', 'lot', 'levels', 'phased'])
    )
    expect(f.location).toBe('wish')
    expect(f.steps).toEqual([1, 2, 4, 5, 6])
  })

  it('شقّة: لا طريقة بناء ولا طوابق ولا زيادات، والحمّامات وحدها من المواصفات', () => {
    const f = requestFlow({ requestType: 'apartment' })
    for (const hidden of ['constructionSystem', 'levels', 'livingRooms', 'kitchens', 'extras', 'landArea'] as Field[]) {
      expect(f.has(hidden)).toBe(false)
    }
    expect(f.has('bathrooms')).toBe(true)
    expect(f.has('apartmentState')).toBe(true)
    expect(f.has('floorPref')).toBe(true)
    expect(f.extras).toEqual([])
  })

  it('شقّة: «طابق أقلّ» و«بناء على مراحل» لا معنى لهما في شراء', () => {
    const f = requestFlow({ requestType: 'apartment' })
    expect(f.flexibility).not.toContain('levels')
    expect(f.flexibility).not.toContain('phased')
    expect(f.flexibility).toContain('zone')
  })

  it('شقّة جاهزة بلا تشطيب، وفي طور البناء بتشطيب وتنازل «تشطيب أبسط»', () => {
    const ready = requestFlow({ requestType: 'apartment', apartmentState: 'ready' })
    const offPlan = requestFlow({ requestType: 'apartment', apartmentState: 'off_plan' })
    expect(ready.has('standing')).toBe(false)
    expect(ready.flexibility).not.toContain('standing')
    expect(offPlan.has('standing')).toBe(true)
    expect(offPlan.flexibility).toContain('standing')
  })

  it('ترميم بلا أشغال محدّدة: نوع الأشغال والمساحة الحالية والدار الحالية — لا مساحة مطلوبة', () => {
    const f = requestFlow({ requestType: 'renovation' })
    expect(f.has('works')).toBe(true)
    expect(f.has('currentArea')).toBe(true)
    expect(f.has('builtArea')).toBe(false)
    expect(f.has('homeStep')).toBe(true)
    expect(f.has('constructionSystem')).toBe(false)
    expect(f.has('levels')).toBe(false)
    expect(f.location).toBe('existing_home')
    expect(f.steps).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('ترميم مع توسعة: تُفتح المساحة المضافة والغرف وطريقة البناء', () => {
    const f = requestFlow({ requestType: 'renovation', works: ['extension'] })
    expect(f.has('extensionArea')).toBe(true)
    expect(f.has('bedrooms')).toBe(true)
    expect(f.has('kitchens')).toBe(true)
    expect(f.has('constructionSystem')).toBe(true)
    expect(f.structural).toBe(true)
    expect(f.has('levels')).toBe(false)
  })

  it('ترميم مع زيادة طابق: الطوابق وتنازل «طابق أقلّ» يظهران', () => {
    const f = requestFlow({ requestType: 'renovation', works: ['add_floor'] })
    expect(f.has('levels')).toBe(true)
    expect(f.flexibility).toContain('levels')
    expect(f.has('extensionArea')).toBe(false)
  })

  it('ترميم: زيادات الدار القائمة فقط، ولا منطقة أخرى', () => {
    const f = requestFlow({ requestType: 'renovation' })
    expect(f.extras).toEqual(['cloture', 'majel', 'solar', 'ascenseur'])
    expect(f.flexibility).not.toContain('zone')
    expect(f.flexibility).toContain('phased')
  })

  it('المستأجر لا يرمّم', () => {
    expect(requestFlow({ requestType: 'renovation', ownership: 'tenant' }).blocked).toBe('tenant')
    expect(requestFlow({ requestType: 'renovation', ownership: 'heirs' }).blocked).toBeNull()
    expect(requestFlow({ requestType: 'build_on_land', ownership: 'tenant' }).blocked).toBeNull()
  })

  it('مشكل آخر: الحكاية والاستعجال والعائق فقط، بلا تنازلات، والمال مطويّ', () => {
    const f = requestFlow({ requestType: 'other' })
    expect(fieldsOf({ requestType: 'other' })).toEqual(['horizon', 'problemNote', 'problemType', 'urgency'])
    expect(f.flexibility).toEqual([])
    expect(f.financeOptional).toBe(true)
    expect(f.location).toBe('current')
    expect(f.steps).toEqual([1, 2, 4, 5, 6])
  })
})

describe('قواعد عابرة', () => {
  it('الإعاقة تقترح أرضياً أو مصعداً للشقّة، ومصعداً لمن يبني، ولا شيء لغيرهما', () => {
    expect(requestFlow({ requestType: 'apartment', hasDisability: true }).disabilityHint).toBe('ground_or_elevator')
    expect(requestFlow({ requestType: 'build_on_land', hasDisability: true }).disabilityHint).toBe('elevator')
    expect(requestFlow({ requestType: 'other', hasDisability: true }).disabilityHint).toBeNull()
    expect(requestFlow({ requestType: 'apartment', hasDisability: false }).disabilityHint).toBeNull()
  })

  it('المساران المخفيّان يُعامَلان كشقّة، والمجهول كمشكل آخر', () => {
    expect(normalizeType('economic')).toBe('apartment')
    expect(normalizeType('rent_to_own')).toBe('apartment')
    expect(normalizeType('')).toBe('other')
    expect(normalizeType('whatever')).toBe('other')
  })

  it('المصعد من طابقين فما فوق', () => {
    expect(elevatorMakesSense(1)).toBe(false)
    expect(elevatorMakesSense(2)).toBe(false)
    expect(elevatorMakesSense(3)).toBe(true)
    expect(elevatorMakesSense(undefined)).toBe(false)
  })

  it('الحكاية والاستعجال في كلّ المسارات بلا استثناء', () => {
    for (const t of ['build_on_land', 'land_and_house', 'apartment', 'renovation', 'other']) {
      const f = requestFlow({ requestType: t })
      expect(f.has('problemNote')).toBe(true)
      expect(f.has('urgency')).toBe(true)
      expect(f.has('horizon')).toBe(true)
    }
  })
})
