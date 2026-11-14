import { createHash } from 'node:crypto'

/**
 * بصمة محتوى الوثيقة.
 *
 * الاعتماد يُربط بها: «القرار مربوط برقم النسخة أو hash؛ أي تعديل
 * جوهري يلغي صلاحيته» (القسم 08). فتعديل سطر أو سعر أو شرط دفع بعد
 * الاعتماد يبدّل البصمة، فيسقط الاعتماد وحده — لا بإرادة أحد ولا
 * بتذكّره.
 *
 * ما يدخل البصمة: ما يراه الحريف ويبني عليه قراره. وما لا يدخل:
 * المعرّفات والتواريخ الداخلية وترتيب الأسطر في القاعدة — تبديلها لا
 * يبدّل العرض، وإسقاط اعتماد لأجلها إزعاج بلا فائدة.
 *
 * منفصل عن lib/doc-flow.ts لأنّه يستورد node:crypto، وذاك يُقرأ في
 * الواجهة.
 */
export type HashableLine = {
  articleCode: string
  quantity: number | string
  puTotalHt: number | string
  totalHt: number | string
}

export type HashableDoc = {
  kind: string
  version: number
  totalHt: number | string
  taxRatePct?: number | string | null
  validUntil?: string | null
  inclusions?: string | null
  exclusions?: string | null
  paymentTerms?: string | null
  lines: HashableLine[]
}

/** رقم كنصّ ثابت: 1000 و1000.00 و«1000» بصمة واحدة */
const num = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : String(v)
}

const txt = (v: string | null | undefined): string => (v ?? '').trim().replace(/\s+/g, ' ')

export function contentHash(doc: HashableDoc): string {
  const lines = doc.lines
    .map((l) => [txt(l.articleCode), num(l.quantity), num(l.puTotalHt), num(l.totalHt)].join('|'))
    // الترتيب لا يبدّل العرض: نرتّب حتّى لا تسقط الاعتمادات بلا سبب
    .sort()

  const payload = [
    `kind=${txt(doc.kind)}`,
    `version=${doc.version}`,
    `total=${num(doc.totalHt)}`,
    `tax=${num(doc.taxRatePct)}`,
    `valid=${txt(doc.validUntil)}`,
    `inc=${txt(doc.inclusions)}`,
    `exc=${txt(doc.exclusions)}`,
    `pay=${txt(doc.paymentTerms)}`,
    `lines=${lines.length}`,
    ...lines,
  ].join('\n')

  return createHash('sha256').update(payload).digest('base64url').slice(0, 32)
}
