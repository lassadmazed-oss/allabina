/**
 * الورشة والتقرير اليومي — المنطق الخالص.
 *
 * القسم 07: «نسبة التقدّم تُحسب بمنهج معتمد على الأشغال والكميات، لا
 * بتقدير عشوائي».
 *
 * فلا أحد يكتب نسبةً هنا. تُكتب كمّيات منجَزة لكلّ سطر من العقد،
 * وتُجمع موزونةً بقيمة السطر. «أنجزنا 60%» رأيٌ يتبدّل بمزاج من كتبه،
 * و«صببنا 18 م³ من 30» واقعة تُقاس وتُراجَع.
 *
 * ووزن السطر قيمتُه لا عدده: مئة متر دهن ليست كمئة متر خرسانة، وقسمة
 * الأسطر بالتساوي تجعل الورشة تبدو في نصفها وهي في هيكلها.
 */

import { PHASES, phaseOfLot, type PhaseKey } from '@/lib/budget-reach'

export type ChantierStatus = 'preparing' | 'running' | 'paused' | 'delivered' | 'stopped'
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export const CHANTIER_AR: Record<ChantierStatus, string> = {
  preparing: 'في التحضير',
  running: 'في التنفيذ',
  paused: 'موقوفة',
  delivered: 'مسلَّمة',
  stopped: 'ملغاة',
}

export const REPORT_AR: Record<ReportStatus, string> = {
  draft: 'مسوّدة',
  submitted: 'في انتظار الاعتماد',
  approved: 'معتمَد',
  rejected: 'مرفوض',
}

/** التوقّف والإلغاء يُعلَّلان: حالة بلا سبب تبدو إهمالاً بعد شهر */
export const NEEDS_NOTE: ChantierStatus[] = ['paused', 'stopped']

const FLOW: Record<ReportStatus, ReportStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  // المرفوض يُصلَح ويُقدَّم من جديد، ولا يُعتمد مباشرةً
  rejected: ['submitted'],
  // المعتمَد يُفتح ثانيةً بالرفض وحده — تعديلٌ صامت يغيّر نسبةً رآها الحريف
  approved: ['rejected'],
}

export const canTransition = (from: ReportStatus, to: ReportStatus): boolean =>
  FLOW[from]?.includes(to) ?? false

// ───────────────────────────────────────────────── التقديم

export type ReportDraft = {
  done: string | null
  blocked: string | null
  blockedReason: string | null
  nextPlan: string | null
  lines: { devisLineId: string; qtyDone: number }[]
  photos: number
}

export type SubmitRefusal =
  | 'empty'
  | 'blocked_without_reason'
  | 'no_next_plan'
  | 'no_photo'

/**
 * ما الذي يمنع تقديم التقرير للاعتماد.
 *
 * تقريرٌ فارغ لا يُراجَع، و«ما تعملش» بلا سبب لا يُفيد، وبرنامج الغد
 * هو ما يجعل التقرير أداةً لا أرشيفاً. والصورة شرط: الحريف يصدّق ما
 * يرى، والقسم 07 يطلب «صوراً مرتبطة بالأشغال».
 */
export function submitRefusals(d: ReportDraft): SubmitRefusal[] {
  const out: SubmitRefusal[] = []
  const hasText = (s: string | null) => Boolean(s && s.trim().length >= 3)
  if (!hasText(d.done) && !hasText(d.blocked) && d.lines.length === 0) out.push('empty')
  if (hasText(d.blocked) && !hasText(d.blockedReason)) out.push('blocked_without_reason')
  if (!hasText(d.nextPlan)) out.push('no_next_plan')
  if (d.photos === 0) out.push('no_photo')
  return out
}

export const canSubmit = (d: ReportDraft): boolean => submitRefusals(d).length === 0

// ───────────────────────────────────────────────── التقدّم

export type ContractLine = {
  id: string
  lotCode: number
  lotNameAr: string
  designationAr: string
  unit: string
  /** الكمّية المتعاقَد عليها */
  quantity: number
  /** قيمة السطر — وزنه في النسبة */
  totalHt: number
}

export type DoneEntry = { devisLineId: string; qtyDone: number }

export type LineProgress = {
  line: ContractLine
  qtyDone: number
  /** نسبة السطر، مسقوفة بـ100 للعرض */
  pct: number
  /** أُنجز أكثر من المتعاقَد عليه — يُقال ولا يُبتلع */
  overrun: boolean
}

/**
 * الكمّيات المنجزة مجموعةً لكلّ سطر.
 * تُمرَّر أسطرُ التقارير **المعتمَدة وحدها**: ما لم يُراجَع لا يُحتسب.
 */
export function sumDone(entries: DoneEntry[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of entries) {
    if (!Number.isFinite(e.qtyDone) || e.qtyDone <= 0) continue
    out.set(e.devisLineId, (out.get(e.devisLineId) ?? 0) + e.qtyDone)
  }
  return out
}

export function lineProgress(lines: ContractLine[], entries: DoneEntry[]): LineProgress[] {
  const done = sumDone(entries)
  return lines.map((line) => {
    const qtyDone = done.get(line.id) ?? 0
    const raw = line.quantity > 0 ? (qtyDone / line.quantity) * 100 : 0
    return {
      line,
      qtyDone,
      pct: Math.min(100, Math.round(raw * 10) / 10),
      overrun: line.quantity > 0 && qtyDone > line.quantity,
    }
  })
}

export type Progress = { pct: number | null; doneValue: number; totalValue: number }

/**
 * نسبة التقدّم: محصَّلة قيمةِ ما أُنجز على قيمة العقد.
 *
 * كلّ سطر يُسقَف بـ100% قبل الجمع: سطرٌ أُنجز بزيادة لا يعوّض سطراً لم
 * يبدأ. وبلا عقد لا نسبة — null لا صفر: «0%» تقول «ما تحرّك شي»،
 * وnull تقول «ما عندناش أساس نحسبو عليه».
 */
export function progressOf(lines: ContractLine[], entries: DoneEntry[]): Progress {
  const totalValue = lines.reduce((s, l) => s + (Number.isFinite(l.totalHt) ? l.totalHt : 0), 0)
  if (totalValue <= 0) return { pct: null, doneValue: 0, totalValue: 0 }

  const done = sumDone(entries)
  let doneValue = 0
  for (const l of lines) {
    if (l.quantity <= 0 || !Number.isFinite(l.totalHt)) continue
    const share = Math.min(1, (done.get(l.id) ?? 0) / l.quantity)
    doneValue += share * l.totalHt
  }
  return {
    pct: Math.round((doneValue / totalValue) * 1000) / 10,
    doneValue,
    totalValue,
  }
}

export type LotProgress = { lotCode: number; lotNameAr: string } & Progress

/** التقدّم لكلّ لوط — الحريف يسأل «وين وصلنا في الكهرباء» لا «كم بالمئة» */
export function progressByLot(lines: ContractLine[], entries: DoneEntry[]): LotProgress[] {
  const byLot = new Map<number, ContractLine[]>()
  for (const l of lines) {
    const list = byLot.get(l.lotCode)
    if (list) list.push(l)
    else byLot.set(l.lotCode, [l])
  }
  return [...byLot.entries()]
    .map(([lotCode, ls]) => ({
      lotCode,
      lotNameAr: ls[0]?.lotNameAr ?? '',
      ...progressOf(ls, entries),
    }))
    .sort((a, b) => a.lotCode - b.lotCode)
}

// ───────────────────────────────────────────────── التأخير

/**
 * التأخير بالأيّام مقابل الموعد المتوقَّع — موجبٌ يعني متأخّرة.
 * null حين لا موعد: ورشة بلا موعد ليست «في وقتها»، هي بلا قياس.
 */
export function lateDays(expectedEnd: string | null, today = new Date()): number | null {
  if (!expectedEnd) return null
  const end = new Date(expectedEnd)
  if (Number.isNaN(end.getTime())) return null
  return Math.floor((today.getTime() - end.getTime()) / 86_400_000)
}

/** آخر تقرير معتمَد أقدم من يومين: الورشة تشتغل والحريف لا يرى */
export const REPORT_GAP_DAYS = 2

export function reportGap(lastApproved: string | null, today = new Date()): number | null {
  if (!lastApproved) return null
  const d = new Date(lastApproved)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000)
}


// ───────────────────────────────────────────── الخطّ الزمني

export type StageState = 'done' | 'current' | 'upcoming'

export type TimelineStage = {
  key: PhaseKey
  nameAr: string
  nameFr: string
  state: StageState
  pct: number
}

/**
 * أشواط الورشة كما يراها الحريف: منجَز · جارٍ · قادم.
 *
 * تُشتقّ من **قيمة** ما أُنجز لا من متوسّط نسب اللوطات: لوطٌ صغير
 * مكتمل لا يرفع الشطر كما يرفعه لوطٌ كبير. فهي نفس قاعدة النسبة
 * العامّة، ولا يصير شطرٌ «منجَزاً» في الخطّ و60% في النسبة.
 * والجاري هو أوّل ما لم يكتمل —
 * الورشة تمشي بالتسلسل، وشطران «جاريان» معاً يعنيان أنّ أحدهما
 * لم يبدأ.
 */
export function timelineOf(
  byLot: { lotCode: number; doneValue: number; totalValue: number }[]
): TimelineStage[] {
  const sums = new Map<PhaseKey, { done: number; total: number }>()
  for (const l of byLot) {
    const p = phaseOfLot(l.lotCode)
    if (!p) continue
    const cur = sums.get(p.key) ?? { done: 0, total: 0 }
    cur.done += Number.isFinite(l.doneValue) ? l.doneValue : 0
    cur.total += Number.isFinite(l.totalValue) ? l.totalValue : 0
    sums.set(p.key, cur)
  }

  const out: TimelineStage[] = []
  let seenCurrent = false
  for (const phase of PHASES) {
    const s = sums.get(phase.key)
    if (!s || s.total <= 0) continue
    const pct = Math.round((s.done / s.total) * 1000) / 10
    let state: StageState
    if (pct >= 100) state = 'done'
    else if (!seenCurrent) {
      state = 'current'
      seenCurrent = true
    } else state = 'upcoming'
    out.push({ key: phase.key, nameAr: phase.nameAr, nameFr: phase.nameFr, state, pct })
  }
  return out
}
