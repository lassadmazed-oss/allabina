/**
 * الرسم التصوّري — توزيع المساحات، لا مخطّط.
 *
 * الملخّص، القسم 05: «sketch تصوّري أوّلي يوضّح توزيع الفضاءات
 * ومساحاتها التقريبية… المخطّط النهائي يخضع لدراسة المعماري».
 *
 * والفرق بين الاثنين ليس تفصيلاً: مخطّطٌ آلي فيه حيطان وأبواب وشبابيك
 * يُقرأ على أنّه عملُ معماري، فإذا كان ضعيفاً — وهو سيكون — خسر صاحبه
 * ثقةَ من يفهم في البناء. أمّا توزيع المساحات فيجيب على السؤال الذي
 * يسأله الحريف فعلاً: «100 متر يطلعوا شنوّة؟» ولا يدّعي ما ليس له.
 *
 * وفيه ما ليس في أيّ ماكيت: **يقول حين لا تكفي المساحة**. خمس غرف
 * وصالون ومطبخ وحمّامان في 100 م² لا تدخل، ومعرفة ذلك في الدقيقة
 * الأولى أنفع من رسمٍ جميل يكذب.
 */

export type ZoneKind = 'bedroom' | 'living' | 'kitchen' | 'bath' | 'circulation'

export type Zone = {
  kind: ZoneKind
  /** «غرفة 1» — الترقيم من واحد لا من صفر */
  label: string
  /** المساحة بالمتر المربّع، مقرّبة */
  area: number
}

export type ZoneBox = Zone & { x: number; y: number; w: number; h: number }

/**
 * مساحات مرجعية للسكن في تونس، بالمتر المربّع.
 * الدنيا ليست رأياً: غرفة تحت 9 م² لا يدخلها سرير وخزانة.
 */
export const NORMS: Record<
  Exclude<ZoneKind, 'circulation'>,
  { ideal: number; min: number; max: number }
> = {
  bedroom: { ideal: 12, min: 9, max: 18 },
  living: { ideal: 22, min: 14, max: 35 },
  kitchen: { ideal: 10, min: 6, max: 16 },
  bath: { ideal: 5, min: 3, max: 8 },
}

/** نصيب الممرّات والجدران من المساحة المبنية */
export const CIRCULATION_SHARE = 0.14

export type SketchInput = {
  surface: number
  bedrooms: number
  livingRooms: number
  kitchens: number
  bathrooms: number
}

export type Sketch =
  | {
      fits: true
      zones: Zone[]
      /** ما بقي بعد توزيع المساحات المرجعية — فضاء حرّ */
      spare: number
      /** هل صُغّرت الغرف عن المرجعي لتدخل */
      tight: boolean
    }
  | {
      fits: false
      /** أقلّ مساحة تدخل فيها هذه الحاجة */
      needed: number
      surface: number
    }

const round1 = (n: number) => Math.round(n * 10) / 10

function wanted(input: SketchInput): { kind: Exclude<ZoneKind, 'circulation'>; label: string }[] {
  const out: { kind: Exclude<ZoneKind, 'circulation'>; label: string }[] = []
  const n = (v: number) => Math.max(0, Math.min(12, Math.round(v || 0)))
  for (let i = 1; i <= n(input.livingRooms); i++)
    out.push({ kind: 'living', label: n(input.livingRooms) > 1 ? `صالون ${i}` : 'صالون' })
  for (let i = 1; i <= n(input.bedrooms); i++) out.push({ kind: 'bedroom', label: `غرفة ${i}` })
  for (let i = 1; i <= n(input.kitchens); i++)
    out.push({ kind: 'kitchen', label: n(input.kitchens) > 1 ? `مطبخ ${i}` : 'مطبخ' })
  for (let i = 1; i <= n(input.bathrooms); i++)
    out.push({ kind: 'bath', label: n(input.bathrooms) > 1 ? `حمّام ${i}` : 'حمّام' })
  return out
}

/**
 * توزيع المساحة على الفضاءات.
 *
 * المرجعي أوّلاً. إن ضاقت المساحة صُغِّرت الفضاءات بالتناسب حتّى
 * حدودها الدنيا — وإن لم تكفِ عندها، لا يُرسم شيء ويُقال العدد الذي
 * تحتاجه. رسمُ غرفٍ بسبعة أمتار ليبدو الأمر ممكناً كذبةٌ تُكتشف عند
 * المعماري.
 */
export function sketchOf(input: SketchInput): Sketch {
  const surface = Number(input.surface) || 0
  const rooms = wanted(input)
  if (surface <= 0 || rooms.length === 0) {
    return { fits: false, needed: 0, surface }
  }

  const circulation = surface * CIRCULATION_SHARE
  const usable = surface - circulation

  const ideal = rooms.reduce((s, r) => s + NORMS[r.kind].ideal, 0)
  const min = rooms.reduce((s, r) => s + NORMS[r.kind].min, 0)

  if (usable < min) {
    return { fits: false, needed: Math.ceil(min / (1 - CIRCULATION_SHARE)), surface }
  }

  const tight = usable < ideal
  // بين الدنيا والمرجعي: معامل واحد على الجميع، فلا تُصغَّر غرفة ويُترك
  // صالونٌ على سعته
  const factor = tight ? (usable - min) / (ideal - min || 1) : 1

  const zones: Zone[] = rooms.map((r) => {
    const { ideal: idl, min: mn } = NORMS[r.kind]
    const area = tight ? mn + (idl - mn) * factor : idl
    return { kind: r.kind, label: r.label, area: round1(area) }
  })

  const used = zones.reduce((s, z) => s + z.area, 0)
  let spare = round1(Math.max(0, usable - used))

  /*
   * الفائض يُوزَّع على الفضاءات حتّى حدودها العليا، لا يُكدَّس في
   * الصالون: دارٌ من 100 متر بصالون 47 متراً رقمٌ لا يصدّقه من رأى
   * داراً. وما بقي بعد الحدود يبقى **فضاءً حرّاً مسمّى** — مساحةٌ
   * تختفي من الرسم تجعل المجموع لا يساوي ما يدفع الحريف ثمنه.
   */
  if (spare > 0) {
    const room = zones.filter((z) => z.kind !== 'circulation')
    const capacity = room.reduce(
      (a, z) => a + Math.max(0, NORMS[z.kind as Exclude<ZoneKind, 'circulation'>].max - z.area),
      0
    )
    if (capacity > 0) {
      const share = Math.min(1, spare / capacity)
      for (const z of room) {
        const max = NORMS[z.kind as Exclude<ZoneKind, 'circulation'>].max
        z.area = round1(z.area + Math.max(0, max - z.area) * share)
      }
      spare = round1(Math.max(0, spare - capacity))
    }
    if (spare > 0) zones.push({ kind: 'circulation', label: 'فضاء حرّ', area: spare })
  }

  zones.push({ kind: 'circulation', label: 'ممرّات', area: round1(circulation) })

  return { fits: true, zones, spare, tight }
}

// ─────────────────────────────────────────────── التخطيط

/**
 * ترتيب الفضاءات في مستطيل، بالتقطيع المتناوب.
 *
 * ليست هندسةَ مبنى: نسب المساحات مقروءة بالعين، لا أكثر. والتناوب
 * يمنع الشرائح الطويلة الرفيعة التي تجعل غرفةً بمترٍ عرضاً.
 */
export function layout(zones: Zone[], width = 100, height = 70): ZoneBox[] {
  const total = zones.reduce((s, z) => s + z.area, 0)
  if (total <= 0) return []

  const out: ZoneBox[] = []
  // الأكبر أوّلاً ليأخذ الكتلة الأعرض، والممرّات آخراً لأنّها ما يلتفّ
  const sorted = [...zones].sort((a, b) => {
    if (a.kind === 'circulation') return 1
    if (b.kind === 'circulation') return -1
    return b.area - a.area
  })

  const place = (
    list: Zone[],
    x: number,
    y: number,
    w: number,
    h: number,
    horizontal: boolean
  ): void => {
    if (!list.length || w <= 0 || h <= 0) return
    if (list.length === 1) {
      out.push({ ...list[0], x, y, w, h })
      return
    }
    const sum = list.reduce((s, z) => s + z.area, 0)
    // نقسم القائمة إلى نصفين متقاربي المساحة
    let acc = 0
    let cut = 1
    for (let i = 0; i < list.length - 1; i++) {
      acc += list[i].area
      cut = i + 1
      if (acc >= sum / 2) break
    }
    const first = list.slice(0, cut)
    const second = list.slice(cut)
    const share = first.reduce((s, z) => s + z.area, 0) / sum

    if (horizontal) {
      const w1 = w * share
      place(first, x, y, w1, h, !horizontal)
      place(second, x + w1, y, w - w1, h, !horizontal)
    } else {
      const h1 = h * share
      place(first, x, y, w, h1, !horizontal)
      place(second, x, y + h1, w, h - h1, !horizontal)
    }
  }

  place(sorted, 0, 0, width, height, true)
  return out
}

/** أبعاد المستطيل من المساحة — نسبة 1.3 قريبة من قطعة سكنية */
export function frame(surface: number, ratio = 1.3): { w: number; h: number } {
  const s = Math.max(1, surface)
  const h = Math.sqrt(s / ratio)
  return { w: round1(h * ratio), h: round1(h) }
}
