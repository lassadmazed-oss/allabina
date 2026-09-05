/**
 * مولّد الـDevis — Module 11.
 *
 * دوال صافية: لا قاعدة بيانات هنا. تأخذ مواصفات المشروع وقائمة المقالات
 * وتُرجع أسطر العرض محسوبة. الحفظ (المجمَّد) يتمّ في lib/actions/devis.ts.
 *
 * الكمّيات تُشتقّ من صيغة مكتوبة على كلّ مقال («surface * 1.15»)، تضبطها
 * الإدارة من الـBack-office. لا رقم ولا صيغة داخل الكود.
 */

export type ProjectConfig = {
  surface: number
  levels: number
  bedrooms: number
  livingRooms: number
  kitchens: number
  bathrooms: number
  garage: boolean
  terrasse: boolean
  jardin: boolean
  landArea: number
}

export type ArticleInput = {
  id: string
  code: string
  lotCode: number
  lotNameAr: string
  designationAr: string
  unit: string
  qtyFormula: string
  puFournitureHt: number
  puMainOeuvreHt: number
  sortOrder?: number
}

export type DevisLine = {
  articleId: string
  lotCode: number
  lotNameAr: string
  articleCode: string
  designationAr: string
  unit: string
  quantity: number
  puFournitureHt: number
  puMainOeuvreHt: number
  puTotalHt: number
  totalHt: number
}

export type DevisResult = {
  lines: DevisLine[]
  /** المجموع حسب الـLot، مرتّباً بترتيب البوردرو */
  lots: { code: number; nameAr: string; totalHt: number }[]
  totalHt: number
  /** مقالات تعذّر حساب كمّيتها — تُعرض للفريق ولا تُخفى */
  errors: { code: string; reason: string }[]
}

const round2 = (v: number) => Math.round(v * 100) / 100
const round3 = (v: number) => Math.round(v * 1000) / 1000

/** أسماء المتغيّرات المسموح بها في الصيغ */
export const FORMULA_VARS = [
  'surface',
  'levels',
  'bedrooms',
  'living_rooms',
  'kitchens',
  'bathrooms',
  'garage',
  'terrasse',
  'jardin',
  'land_area',
] as const

function variables(config: ProjectConfig): Record<string, number> {
  return {
    surface: config.surface || 0,
    levels: config.levels || 1,
    bedrooms: config.bedrooms || 0,
    living_rooms: config.livingRooms || 0,
    kitchens: config.kitchens || 0,
    bathrooms: config.bathrooms || 0,
    garage: config.garage ? 1 : 0,
    terrasse: config.terrasse ? 1 : 0,
    jardin: config.jardin ? 1 : 0,
    land_area: config.landArea || 0,
  }
}

/**
 * مقيّم صيغ صغير: أرقام، متغيّرات، + - * / و الأقواس.
 * لا eval ولا Function — الصيغ تأتي من الإدارة ولا يجوز أن تنفّذ كوداً.
 */
export function evaluateFormula(formula: string, config: ProjectConfig): number {
  const vars = variables(config)
  const src = (formula ?? '').trim()
  if (!src) return 0

  // تحليل لغوي: رقم · متغيّر · عامل · قوس
  const tokens: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') {
      i++
      continue
    }
    if ('+-*/()'.includes(c)) {
      tokens.push(c)
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let n = ''
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++]
      if (!/^\d*\.?\d+$/.test(n)) throw new Error(`رقم غير صالح: ${n}`)
      tokens.push(n)
      continue
    }
    if (/[a-z_]/i.test(c)) {
      let name = ''
      while (i < src.length && /[a-z_0-9]/i.test(src[i])) name += src[i++]
      const key = name.toLowerCase()
      if (!(key in vars)) throw new Error(`متغيّر غير معروف: ${name}`)
      tokens.push(String(vars[key]))
      continue
    }
    throw new Error(`رمز غير مسموح: ${c}`)
  }

  // تحليل نحوي تنازلي: تعبير ← حدّ ← عامل
  let pos = 0
  const peek = () => tokens[pos]

  const factor = (): number => {
    const t = peek()
    if (t === undefined) throw new Error('صيغة ناقصة')
    if (t === '(') {
      pos++
      const v = expression()
      if (peek() !== ')') throw new Error('قوس غير مغلق')
      pos++
      return v
    }
    if (t === '-') {
      pos++
      return -factor()
    }
    if (t === '+') {
      pos++
      return factor()
    }
    pos++
    const n = Number(t)
    if (!Number.isFinite(n)) throw new Error(`قيمة غير صالحة: ${t}`)
    return n
  }

  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/') {
      const op = tokens[pos++]
      const r = factor()
      if (op === '/') {
        if (r === 0) throw new Error('قسمة على صفر')
        v /= r
      } else {
        v *= r
      }
    }
    return v
  }

  function expression(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++]
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  const value = expression()
  if (pos !== tokens.length) throw new Error('صيغة غير مفهومة')
  if (!Number.isFinite(value)) throw new Error('نتيجة غير صالحة')
  return value < 0 ? 0 : round3(value)
}

/** توليد أسطر الـDevis من المواصفات والمقالات المتاحة */
export function generateDevis(config: ProjectConfig, articles: ArticleInput[]): DevisResult {
  const lines: DevisLine[] = []
  const errors: { code: string; reason: string }[] = []

  for (const a of articles) {
    let quantity = 0
    try {
      quantity = evaluateFormula(a.qtyFormula, config)
    } catch (e) {
      errors.push({ code: a.code, reason: e instanceof Error ? e.message : 'صيغة غير صالحة' })
      continue
    }
    if (quantity <= 0) continue

    const puTotal = round3((a.puFournitureHt || 0) + (a.puMainOeuvreHt || 0))
    lines.push({
      articleId: a.id,
      lotCode: a.lotCode,
      lotNameAr: a.lotNameAr,
      articleCode: a.code,
      designationAr: a.designationAr,
      unit: a.unit,
      quantity,
      puFournitureHt: round3(a.puFournitureHt || 0),
      puMainOeuvreHt: round3(a.puMainOeuvreHt || 0),
      puTotalHt: puTotal,
      totalHt: round2(quantity * puTotal),
    })
  }

  lines.sort((x, y) => x.lotCode - y.lotCode || x.articleCode.localeCompare(y.articleCode))

  const byLot = new Map<number, { code: number; nameAr: string; totalHt: number }>()
  for (const l of lines) {
    const cur = byLot.get(l.lotCode) ?? { code: l.lotCode, nameAr: l.lotNameAr, totalHt: 0 }
    cur.totalHt = round2(cur.totalHt + l.totalHt)
    byLot.set(l.lotCode, cur)
  }

  return {
    lines,
    lots: [...byLot.values()].sort((a, b) => a.code - b.code),
    totalHt: round2(lines.reduce((sum, l) => sum + l.totalHt, 0)),
    errors,
  }
}

/** كلفة المتر المربّع الناتجة عن العرض — للمقارنة بالنطاق المرجعي */
export function costPerM2(result: DevisResult, surface: number): number | null {
  if (!surface || surface <= 0 || result.totalHt <= 0) return null
  return round2(result.totalHt / surface)
}

/**
 * صلاحية العرض.
 * العرض التقديري لا يبقى صالحاً إلى الأبد: الأسعار تتحرّك، والرقم القديم
 * يصير وعداً لا يُوفى. المدّة إعداد إداري (devis.validity_days) لا رقم هنا.
 */
export const DEFAULT_VALIDITY_DAYS = 30

/** آخر يوم صلاحية، بصيغة YYYY-MM-DD */
export function devisValidUntil(from: Date, days = DEFAULT_VALIDITY_DAYS): string {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + Math.max(0, Math.round(days)))
  return d.toISOString().slice(0, 10)
}

/** هل انتهت صلاحية العرض؟ يوم الانتهاء نفسه ما زال صالحاً. */
export function isDevisExpired(validUntil: string | null, now = new Date()): boolean {
  if (!validUntil) return false
  return validUntil < now.toISOString().slice(0, 10)
}

/** كم يوماً بقي — سالب إن انتهت */
export function daysLeft(validUntil: string | null, now = new Date()): number | null {
  if (!validUntil) return null
  const end = new Date(`${validUntil}T00:00:00Z`).getTime()
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((end - today) / 86_400_000)
}
