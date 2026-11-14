import type { Availability } from '@/lib/catalog'

/**
 * أثر المنطقة على السعر والتوفّر — المنطق الخالص.
 *
 * كرّاس الشروط V2، القسم 03: «المنطقة تؤثر فقط وفق قواعد معتمدة: نقل،
 * توفر، يد عاملة أو توريد. لا نعرض تخفيضات أو توفر غير مؤكد».
 *
 * ثلاث قواعد مكتوبة شفرةً:
 *   1. **بلا قاعدة، بلا تغيير.** غياب القاعدة ليس صفراً ولا متوسّطاً:
 *      السعر يبقى كما هو ولا يُقال للحريف شيء عن منطقته.
 *   2. **غير المعتمَد لا يُطبَّق**، ولو كان مكتوباً وصحيحاً. والمعتمَد
 *      قبل تاريخ نفاذه كذلك.
 *   3. **الأثر يُقال لا يُدسّ.** كلّ زيادة تحمل سببها، فيرى الحريف
 *      «زيادة نقل» لا رقماً تبدّل بلا تفسير.
 */
export type RegionRule = {
  id: number
  govCode: string
  delegationId: number | null
  lotId: number | null
  transportPct: number | null
  transportPerUnit: number | null
  labourFactor: number | null
  availability: Availability | null
  leadTimeDays: number | null
  reasonAr: string | null
  reasonFr: string | null
  isApproved: boolean
  effectiveFrom: string | null
}

export type RegionScope = { govCode: string; delegationId?: number | null; lotId?: number | null }

/**
 * هل هذه القاعدة سارية اليوم؟
 * الاعتماد شرط، وتاريخ النفاذ شرط ثانٍ: قاعدة تبدأ أوّل الشهر القادم
 * تُكتب اليوم ولا تُطبَّق اليوم.
 */
export function ruleInForce(rule: RegionRule, today: Date = new Date()): boolean {
  if (!rule.isApproved) return false
  if (!rule.effectiveFrom) return true
  return new Date(`${rule.effectiveFrom}T00:00:00Z`).getTime() <= today.getTime()
}

/** كلّما ضاق نطاق القاعدة سبقت: معتمدية+لوط ← معتمدية ← ولاية+لوط ← ولاية */
function specificity(rule: RegionRule): number {
  return (rule.delegationId !== null ? 2 : 0) + (rule.lotId !== null ? 1 : 0)
}

/**
 * القاعدة المطبَّقة على هذا المقال في هذه المنطقة — واحدة لا مجموع.
 *
 * جمع قاعدتين متداخلتين (ولاية + معتمدية) يضاعف النقل بلا أن ينتبه
 * أحد. فالأضيق تفوز، والأخرى تُهمَل كما تُهمَل قاعدة عامّة حين توجد
 * قاعدة خاصّة.
 */
export function pickRule(
  rules: RegionRule[],
  scope: RegionScope,
  today: Date = new Date()
): RegionRule | null {
  const matching = rules.filter((r) => {
    if (!ruleInForce(r, today)) return false
    if (r.govCode !== scope.govCode) return false
    if (r.delegationId !== null && r.delegationId !== (scope.delegationId ?? null)) return false
    if (r.lotId !== null && r.lotId !== (scope.lotId ?? null)) return false
    return true
  })
  if (!matching.length) return null
  return matching.sort((a, b) => specificity(b) - specificity(a) || b.id - a.id)[0]
}

export type RegionEffect = {
  /** السعر بعد القاعدة — null إن كان الأصل غير معروف */
  priceHt: number | null
  availability: Availability
  leadTimeDays: number | null
  /** أسباب الفرق، لتُعرض. فارغة = لا شيء تبدّل. */
  reasons: { kind: 'transport' | 'labour' | 'availability' | 'lead_time'; amount?: number; text: string | null }[]
  changed: boolean
}

export type PricedArticle = {
  /** سعر التوريد وحده */
  supplyHt: number | null
  /** سعر اليد العاملة وحده — المعامل يمسّه وحده */
  labourHt: number | null
  availability: Availability
  leadTimeDays: number | null
}

/**
 * تطبيق القاعدة. بلا قاعدة ترجع الأصل كما هو وreasons فارغة.
 *
 * واليد العاملة تُضرب وحدها: معاملٌ يضرب السعر كلّه يرفع ثمن المادّة
 * لأنّ اليد أغلى، وهذا خطأ في المعنى لا في الحساب.
 */
export function applyRegion(
  article: PricedArticle,
  rule: RegionRule | null,
  locale: 'ar' | 'fr' = 'ar'
): RegionEffect {
  const base =
    article.supplyHt === null && article.labourHt === null
      ? null
      : (article.supplyHt ?? 0) + (article.labourHt ?? 0)

  if (!rule) {
    return {
      priceHt: base,
      availability: article.availability,
      leadTimeDays: article.leadTimeDays,
      reasons: [],
      changed: false,
    }
  }

  const text = (locale === 'fr' ? rule.reasonFr : rule.reasonAr) || null
  const reasons: RegionEffect['reasons'] = []

  let supply = article.supplyHt ?? 0
  let labour = article.labourHt ?? 0

  if (rule.labourFactor !== null && labour > 0) {
    const before = labour
    labour = labour * rule.labourFactor
    reasons.push({ kind: 'labour', amount: labour - before, text })
  }

  let price = base === null ? null : supply + labour

  if (price !== null && rule.transportPct !== null && rule.transportPct > 0) {
    const add = price * (rule.transportPct / 100)
    price += add
    reasons.push({ kind: 'transport', amount: add, text })
  }
  if (price !== null && rule.transportPerUnit !== null && rule.transportPerUnit > 0) {
    price += rule.transportPerUnit
    reasons.push({ kind: 'transport', amount: rule.transportPerUnit, text })
  }

  const availability = rule.availability ?? article.availability
  if (rule.availability && rule.availability !== article.availability) {
    reasons.push({ kind: 'availability', text })
  }

  const leadTimeDays = rule.leadTimeDays ?? article.leadTimeDays
  if (rule.leadTimeDays !== null && rule.leadTimeDays !== article.leadTimeDays) {
    reasons.push({ kind: 'lead_time', text })
  }

  return { priceHt: price, availability, leadTimeDays, reasons, changed: reasons.length > 0 }
}
