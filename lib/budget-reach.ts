/**
 * «بميزانيتك توصل لوين» — المنطق الخالص.
 *
 * الملخّص، القسم 05: عند إدخال الميزانية تعرض المنصّة «الأشغال الممكنة
 * بالمبلغ المتوفّر، **والمرحلة التي يمكن الوصول إليها والتوقّف عندها
 * فنيًا**، والأشغال المتبقّية».
 *
 * والفرق بين هذا وبين خانةٍ يؤشّر فيها الحريف على «gros œuvre» ليس
 * فرقاً في الشكل: الخانة تَعِد، والحساب يقول. وبـ30 ألف دينار على
 * 100 م² لا يكتمل الهيكل — يقف عند الأعمدة. من أشّر على الخانة يكتشف
 * ذلك في العرض، بعد أن بنى توقّعه.
 *
 * والترتيب هنا ترتيب تنفيذ لا ترتيب عرض: لا تُبنى الجدران قبل
 * الأساسات، فالميزانية تُستهلك بالتسلسل، ويقع التوقّف حيث تنفد.
 */

export type PhaseKey = 'study' | 'structure' | 'second' | 'finish' | 'outside' | 'handover'

export type Phase = {
  key: PhaseKey
  nameAr: string
  nameFr: string
  /** أرقام اللوطات، بترتيب التنفيذ */
  lots: number[]
}

/**
 * الأشواط كما في الملخّص، مع «الدراسة» و«التسليم» طرفين لهما كلفة.
 *
 * ⚠ السباكة (8) والكهرباء (9) هنا في «التحضيرات» كاملةً، وهو تقريب:
 * فيهما تحضيرٌ وتجهيز، والفصل الحقيقي يحتاج وسم كلّ مقال بشطره.
 * التقريب يميل للأحوط — يحمّل الشطر الأبكر أكثر ممّا له.
 */
export const PHASES: Phase[] = [
  { key: 'study', nameAr: 'الدراسة والتحضير', nameFr: 'Études & préparation', lots: [1] },
  { key: 'structure', nameAr: 'الهيكل', nameFr: 'Gros œuvre', lots: [2, 3, 4, 5] },
  {
    key: 'second',
    nameAr: 'التحضيرات والتلبيس',
    nameFr: 'Préparations & second œuvre',
    lots: [6, 7, 8, 9],
  },
  {
    key: 'finish',
    nameAr: 'التشطيب والتجهيز',
    nameFr: 'Finitions & équipements',
    lots: [10, 11, 12, 13, 14, 15, 16, 17],
  },
  { key: 'outside', nameAr: 'الواجهة والخارج', nameFr: 'Façade & extérieur', lots: [18, 19] },
  { key: 'handover', nameAr: 'التنظيف والتسليم', nameFr: 'Nettoyage & livraison', lots: [20] },
]

export const phaseOfLot = (lotCode: number): Phase | null =>
  PHASES.find((p) => p.lots.includes(lotCode)) ?? null

export type LotCost = { code: number; nameAr: string; totalHt: number }

export type Coverage = 'full' | 'partial' | 'none'

export type ReachStage = {
  key: PhaseKey
  nameAr: string
  nameFr: string
  cost: number
  /** مجموع ما قبله ومعه */
  cumulative: number
  state: Coverage
  /** نسبة التغطية داخل الشطر — 100 للمكتمل، 0 لما لم يُبدأ */
  pct: number
}

export type Reach = {
  budget: number
  total: number
  /** ما يغطّيه المبلغ فعلاً (لا يتجاوز المجموع) */
  covered: number
  remaining: number
  stages: ReachStage[]
  /** الشطر الذي تنفد فيه الميزانية — null إذا كفت كلّ شيء أو لم تكفِ شيئاً */
  stopAt: ReachStage | null
  /** هل تكفي الميزانية المشروع كاملاً */
  complete: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * أين تقف الميزانية.
 *
 * تُستهلك بترتيب التنفيذ: شطرٌ يُغطّى كاملاً أو جزئياً أو لا يُبدأ.
 * والجزئي يُقال بنسبته داخل شطره، لا بنسبةٍ من المشروع كلّه: «وصلت
 * 60% من الهيكل» تُفهم، و«وصلت 19% من المشروع» لا تقول أين تقف
 * الشاحنة.
 */
export function reachOf(lots: LotCost[], budget: number): Reach {
  const byPhase = new Map<PhaseKey, number>()
  for (const l of lots) {
    const p = phaseOfLot(l.code)
    if (!p) continue
    byPhase.set(p.key, round2((byPhase.get(p.key) ?? 0) + (l.totalHt || 0)))
  }

  const total = round2([...byPhase.values()].reduce((s, v) => s + v, 0))
  const money = Number.isFinite(budget) && budget > 0 ? budget : 0

  let spent = 0
  let left = money
  let stopAt: ReachStage | null = null
  const stages: ReachStage[] = []

  for (const phase of PHASES) {
    const cost = byPhase.get(phase.key) ?? 0
    if (cost <= 0) continue
    spent = round2(spent + cost)

    let state: Coverage
    let pct: number
    if (left >= cost) {
      state = 'full'
      pct = 100
      left = round2(left - cost)
    } else if (left > 0) {
      state = 'partial'
      pct = Math.round((left / cost) * 1000) / 10
      left = 0
    } else {
      state = 'none'
      pct = 0
    }

    const stage: ReachStage = {
      key: phase.key,
      nameAr: phase.nameAr,
      nameFr: phase.nameFr,
      cost,
      cumulative: spent,
      state,
      pct,
    }
    stages.push(stage)
    if (state === 'partial' && !stopAt) stopAt = stage
  }

  const covered = Math.min(money, total)
  return {
    budget: money,
    total,
    covered: round2(covered),
    remaining: round2(Math.max(0, total - covered)),
    stages,
    stopAt,
    complete: total > 0 && money >= total,
  }
}

/** الأشواط المغطّاة كاملةً — «وصلت لآخر الهيكل» */
export const fullStages = (r: Reach): ReachStage[] => r.stages.filter((s) => s.state === 'full')

/** ما لم يُبدأ بعد */
export const missingStages = (r: Reach): ReachStage[] =>
  r.stages.filter((s) => s.state === 'none')

/**
 * كم ينقص للوصول إلى آخر شطرٍ بعينه — «باش تكمّل الهيكل يلزمك…».
 * null إذا كان الشطر مغطّى أصلاً أو غير موجود.
 */
export function neededFor(r: Reach, key: PhaseKey): number | null {
  const idx = r.stages.findIndex((s) => s.key === key)
  if (idx < 0) return null
  const upTo = r.stages[idx].cumulative
  const gap = round2(upTo - r.budget)
  return gap > 0 ? gap : null
}
