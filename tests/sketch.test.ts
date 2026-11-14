import { describe, expect, it } from 'vitest'
import { CIRCULATION_SHARE, NORMS, frame, layout, sketchOf, type SketchInput } from '@/lib/sketch'

/**
 * الرسم التصوّري.
 *
 * ليس مخطّطاً وليس ادّعاءه: توزيع مساحات يجيب على «100 متر يطلعوا
 * شنوّة؟». والخطأ الذي يُكلّف هنا ليس خطأ رسم — هو رسمُ ما لا يدخل:
 * غرفٌ بسبعة أمتار لتبدو الحاجة ممكنة، ثمّ يكتشف الحريف عند المعماري
 * أنّ ما وُعد به لا يُبنى.
 */
const inp = (over: Partial<SketchInput> = {}): SketchInput => ({
  surface: 100,
  bedrooms: 2,
  livingRooms: 1,
  kitchens: 1,
  bathrooms: 1,
  ...over,
})

describe('ما يدخل وما لا يدخل', () => {
  it('المثال المعتاد يدخل بالمساحات المرجعية', () => {
    const s = sketchOf(inp())
    expect(s.fits).toBe(true)
    if (!s.fits) return
    expect(s.tight).toBe(false)
    // المرجعي أرضية لا سقف: ما فاض من المساحة يتوزّع حتّى الحدود العليا
    expect(s.zones.find((z) => z.label === 'غرفة 1')!.area).toBeGreaterThanOrEqual(
      NORMS.bedroom.ideal
    )
    expect(s.zones.find((z) => z.kind === 'kitchen')!.area).toBeGreaterThanOrEqual(
      NORMS.kitchen.ideal
    )
  })

  it('والمجموع يساوي المساحة المبنية — ما تختفيش أمتار', () => {
    const s = sketchOf(inp())
    if (!s.fits) throw new Error('المفروض تدخل')
    const total = s.zones.reduce((a, z) => a + z.area, 0) + s.spare
    expect(total).toBeCloseTo(100, 1)
  })

  it('والممرّات حصّة معلومة لا بقيّة مجهولة', () => {
    const s = sketchOf(inp())
    if (!s.fits) throw new Error('المفروض تدخل')
    expect(s.zones.find((z) => z.kind === 'circulation')!.area).toBeCloseTo(
      100 * CIRCULATION_SHARE,
      1
    )
  })

  it('مساحة ضيّقة: تُصغَّر الفضاءات بالتناسب ويُقال إنّها ضيّقة', () => {
    const s = sketchOf(inp({ surface: 70, bedrooms: 3 }))
    expect(s.fits).toBe(true)
    if (!s.fits) return
    expect(s.tight).toBe(true)
    const bed = s.zones.find((z) => z.kind === 'bedroom')!
    expect(bed.area).toBeLessThan(NORMS.bedroom.ideal)
    expect(bed.area).toBeGreaterThanOrEqual(NORMS.bedroom.min)
  })

  it('وما لا يدخل لا يُرسم — يُقال العدد المطلوب', () => {
    const s = sketchOf(inp({ surface: 55, bedrooms: 5, bathrooms: 2 }))
    expect(s.fits).toBe(false)
    if (s.fits) return
    expect(s.needed).toBeGreaterThan(55)
    // 5×9 + 14 + 6 + 2×3 = 71 صافية ← مع الممرّات نحو 83
    expect(s.needed).toBeGreaterThanOrEqual(80)
  })

  it('ولا غرفة تحت حدّها الأدنى مهما ضاقت المساحة', () => {
    const s = sketchOf(inp({ surface: 62, bedrooms: 3, bathrooms: 1 }))
    if (!s.fits) return
    for (const z of s.zones) {
      if (z.kind === 'circulation') continue
      expect(z.area).toBeGreaterThanOrEqual(NORMS[z.kind].min - 0.05)
    }
  })

  it('الفائض يتوزّع حتّى الحدود العليا، ولا يُكدَّس في الصالون', () => {
    const s = sketchOf(inp({ surface: 120 }))
    if (!s.fits) throw new Error('المفروض تدخل')
    const living = s.zones.find((z) => z.kind === 'living')!
    expect(living.area).toBeGreaterThan(NORMS.living.ideal)
    expect(living.area).toBeLessThanOrEqual(NORMS.living.max + 0.05)
    // والغرف تاخذ نصيبها كذلك بدل ما تبقى على المرجعي
    expect(s.zones.find((z) => z.kind === 'bedroom')!.area).toBeGreaterThan(NORMS.bedroom.ideal)
  })

  it('ولا فضاء يتجاوز حدّه الأعلى مهما كبرت المساحة', () => {
    const s = sketchOf(inp({ surface: 300 }))
    if (!s.fits) throw new Error('المفروض تدخل')
    for (const z of s.zones) {
      if (z.kind === 'circulation') continue
      expect(z.area).toBeLessThanOrEqual(NORMS[z.kind].max + 0.05)
    }
  })

  it('وما فاض عن الحدود يبقى فضاءً مسمّى لا يختفي', () => {
    const s = sketchOf(inp({ surface: 300 }))
    if (!s.fits) throw new Error('المفروض تدخل')
    const free = s.zones.find((z) => z.label === 'فضاء حرّ')
    expect(free).toBeDefined()
    const total = s.zones.reduce((a, z) => a + z.area, 0)
    expect(total).toBeCloseTo(300, 0)
  })

  it('وبلا فضاءات أصلاً لا رسم', () => {
    expect(sketchOf(inp({ bedrooms: 0, livingRooms: 0, kitchens: 0, bathrooms: 0 })).fits).toBe(
      false
    )
    expect(sketchOf(inp({ surface: 0 })).fits).toBe(false)
  })

  it('والترقيم من واحد', () => {
    const s = sketchOf(inp({ bedrooms: 3 }))
    if (!s.fits) throw new Error('المفروض تدخل')
    expect(s.zones.filter((z) => z.kind === 'bedroom').map((z) => z.label)).toEqual([
      'غرفة 1',
      'غرفة 2',
      'غرفة 3',
    ])
  })
})

describe('التخطيط', () => {
  const zones = (() => {
    const s = sketchOf(inp({ bedrooms: 3, bathrooms: 2 }))
    if (!s.fits) throw new Error('المفروض تدخل')
    return s.zones
  })()

  it('كلّ فضاء له مكان', () => {
    expect(layout(zones)).toHaveLength(zones.length)
  })

  it('ولا شيء يخرج عن الإطار', () => {
    for (const b of layout(zones, 100, 70)) {
      expect(b.x).toBeGreaterThanOrEqual(-0.01)
      expect(b.y).toBeGreaterThanOrEqual(-0.01)
      expect(b.x + b.w).toBeLessThanOrEqual(100.01)
      expect(b.y + b.h).toBeLessThanOrEqual(70.01)
    }
  })

  it('ولا صندوق بلا مساحة', () => {
    for (const b of layout(zones)) {
      expect(b.w).toBeGreaterThan(0)
      expect(b.h).toBeGreaterThan(0)
    }
  })

  it('ومساحة الصندوق تتبع مساحة الفضاء', () => {
    const boxes = layout(zones, 100, 70)
    const big = boxes.find((b) => b.kind === 'living')!
    const small = boxes.find((b) => b.kind === 'bath')!
    expect(big.w * big.h).toBeGreaterThan(small.w * small.h)
  })

  it('وبلا فضاءات لا صناديق', () => {
    expect(layout([])).toEqual([])
  })
})

describe('الإطار', () => {
  it('أبعاد معقولة من المساحة', () => {
    const f = frame(100)
    expect(f.w * f.h).toBeCloseTo(100, 0)
    expect(f.w).toBeGreaterThan(f.h)
  })
})
