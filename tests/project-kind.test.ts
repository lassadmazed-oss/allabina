import { describe, expect, it } from 'vitest'
import {
  CLIENT_KINDS,
  DEFAULT_KIND,
  PROJECT_TYPES,
  asksRooms,
  asksSpan,
  asksUnits,
  drawsSketch,
  kindOfType,
  parseKind,
  typesFor,
} from '@/lib/project-kind'

/**
 * فرد أم محترف.
 *
 * الخطأ هنا لا يُسقط صفحة: يسأل مستودعاً عن غرف نومه. والجواب يُرسم
 * ويُحسب ويُبعث للدراسة — فيصل إلى الفريق ملفٌّ يقول إنّ المستودع فيه
 * صالون. والحريف لم يكذب: السؤال كذب.
 */
describe('من يُعرض له ماذا', () => {
  it('الفرد يبني داراً، والمحترف يبني عمارةً ومستودعاً', () => {
    expect(typesFor('particulier')).toContain('maison')
    expect(typesFor('pro')).toContain('immobilier')
    expect(typesFor('pro')).toContain('usine')
  })

  it('وما يخصّ المحترف لا يُعرض للفرد', () => {
    expect(typesFor('particulier')).not.toContain('immobilier')
    expect(typesFor('particulier')).not.toContain('usine')
  })

  it('و«مشروع آخر» في الاثنين — قائمةٌ مغلقة تطرد من لا يجد نفسه', () => {
    for (const k of CLIENT_KINDS) expect(typesFor(k)).toContain('autre')
  })

  it('و«ترميم» في الاثنين: الفرد يوسّع داره والمحترف يرمّم عمارة', () => {
    for (const k of CLIENT_KINDS) expect(typesFor(k)).toContain('renovation')
  })

  it('وكلّ نوعٍ معروضٌ لصنفٍ واحد على الأقلّ — لا نوع يتيم', () => {
    const shown = new Set([...typesFor('particulier'), ...typesFor('pro')])
    for (const t of PROJECT_TYPES) expect(shown, `${t} ما يظهرش لحتّى صنف`).toContain(t)
  })
})

describe('قراءة الصنف', () => {
  it('الغائب والغريب يرجعان للفرد — الأغلب، ولا ينفتح شيء بالغلط', () => {
    expect(parseKind(undefined)).toBe(DEFAULT_KIND)
    expect(parseKind('admin')).toBe(DEFAULT_KIND)
    expect(parseKind('')).toBe(DEFAULT_KIND)
    expect(parseKind('pro')).toBe('pro')
  })

  it('ورابطٌ يحمل النوع وحده يُنسب لصنفه', () => {
    expect(kindOfType('usine')).toBe('pro')
    expect(kindOfType('immobilier')).toBe('pro')
    expect(kindOfType('maison')).toBe('particulier')
    expect(kindOfType('حاجة')).toBe(DEFAULT_KIND)
  })
})

describe('من يُسأل عن ماذا', () => {
  it('الدار والترميم غرفٌ تُسكن', () => {
    expect(asksRooms('maison')).toBe(true)
    expect(asksRooms('renovation')).toBe(true)
  })

  it('والمستودع لا غرف عنده — ولا يُرسم له صالون', () => {
    expect(asksRooms('usine')).toBe(false)
    expect(drawsSketch('usine')).toBe(false)
    expect(asksSpan('usine')).toBe(true)
  })

  it('والعمارة تُسأل عن شققها لا عن غرف نومها — وحدةٌ من عشرين', () => {
    expect(asksRooms('immobilier')).toBe(false)
    expect(asksUnits('immobilier')).toBe(true)
  })

  it('والمحلّات تُسأل عن عددها', () => {
    expect(asksUnits('commerce')).toBe(true)
    expect(asksRooms('commerce')).toBe(false)
  })

  it('والرسم يتبع الغرف لا الصنف: ما له غرفٌ لا يُرسم', () => {
    for (const t of PROJECT_TYPES) expect(drawsSketch(t)).toBe(asksRooms(t))
  })

  it('ولا نوع يُسأل سؤالين متناقضين في آن', () => {
    for (const t of PROJECT_TYPES) {
      expect([asksRooms(t), asksUnits(t), asksSpan(t)].filter(Boolean).length).toBeLessThanOrEqual(1)
    }
  })
})
