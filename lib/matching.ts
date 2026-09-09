/**
 * محرّك المطابقة — Module 6.
 *
 * ينطلق من مطلب المواطن ويبحث في العروض عن الأقرب لوضعيته، لا العكس.
 * النتيجة اقتراح مفسَّر للفريق: نسبة مع أسباب مكتوبة. القرار يبقى بشرياً،
 * والمحرّك لا يُقصي ملفّاً ولا يعِد أحداً بشيء.
 *
 * دوال صافية: لا قاعدة بيانات هنا ولا أثر جانبي — قابلة للاختبار كاملة.
 */

export type MatchRequest = {
  requestType: string
  govCode: string
  delegationId: number | null
  imadaId: number | null
  desiredAreaM2: number | null
  /** الميزانية التقديرية من التنقيط (القرض + المساهمة الذاتية − المصاريف) */
  maxBudget: number | null
  ownsLand: boolean
  scoreBand: string | null
}

export type MatchProperty = {
  id: string
  kind: string
  govCode: string
  delegationId: number | null
  imadaId: number | null
  areaM2: number | null
  builtAreaM2: number | null
  priceTnd: number | null
  status: string
}

export type MatchReason = {
  key: string
  weight: number
  points: number
  /** نصّ يُعرض للفريق — لماذا هذا العرض مقترح */
  ar: string
}

export type MatchResult = {
  propertyId: string
  score: number
  reasons: MatchReason[]
  /** أسباب استبعاد قاطعة — يظهر العرض في القائمة فقط إن لم توجد */
  blockers: string[]
}

/** أنواع العقارات التي تخدم كلّ نوع مطلب */
const TYPE_FIT: Record<string, string[]> = {
  build_on_land: ['land'],
  land_and_house: ['land', 'house'],
  apartment: ['apartment'],
  economic: ['apartment', 'house'],
  rent_to_own: ['apartment', 'house'],
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * أوزان المطابقة — مجموعها 100.
 * الموقع أوّلاً: المواطن يبني حيث يعيش، لا حيث يتوفّر العرض.
 */
export const MATCH_WEIGHTS = {
  location: 35,
  type: 20,
  budget: 25,
  area: 15,
  readiness: 5,
} as const

export function matchScore(request: MatchRequest, property: MatchProperty): MatchResult {
  const reasons: MatchReason[] = []
  const blockers: string[] = []

  // ---------- 1) الموقع ----------
  let locPoints = 0
  let locText = 'ولاية مختلفة'
  if (property.govCode === request.govCode) {
    if (request.delegationId && property.delegationId === request.delegationId) {
      locPoints = MATCH_WEIGHTS.location
      locText =
        request.imadaId && property.imadaId === request.imadaId
          ? 'نفس العمادة المطلوبة'
          : 'نفس المعتمدية المطلوبة'
    } else {
      locPoints = MATCH_WEIGHTS.location * 0.55
      locText = 'نفس الولاية، معتمدية أخرى'
    }
  } else {
    blockers.push('العقار خارج ولاية المطلب')
  }
  reasons.push({ key: 'location', weight: MATCH_WEIGHTS.location, points: round1(locPoints), ar: locText })

  // ---------- 2) نوع العقار ----------
  const fits = TYPE_FIT[request.requestType] ?? []
  const typeOk = fits.includes(property.kind)
  if (!typeOk) blockers.push('نوع العقار لا يخدم نوع المطلب')
  reasons.push({
    key: 'type',
    weight: MATCH_WEIGHTS.type,
    points: typeOk ? MATCH_WEIGHTS.type : 0,
    ar: typeOk ? 'نوع العقار يناسب المطلب' : 'نوع العقار لا يناسب المطلب',
  })

  // ---------- 3) الميزانية ----------
  let budgetPoints = 0
  let budgetText = 'الميزانية غير محسوبة بعد'
  if (request.maxBudget && property.priceTnd) {
    const ratio = property.priceTnd / request.maxBudget
    if (ratio <= 0.8) {
      budgetPoints = MATCH_WEIGHTS.budget
      budgetText = 'الثمن في حدود الميزانية مع هامش'
    } else if (ratio <= 1) {
      budgetPoints = MATCH_WEIGHTS.budget * 0.85
      budgetText = 'الثمن قريب من سقف الميزانية'
    } else if (ratio <= 1.15) {
      budgetPoints = MATCH_WEIGHTS.budget * 0.4
      budgetText = `الثمن يفوق الميزانية بـ${Math.round((ratio - 1) * 100)}% — يحتاج تفاوضاً`
    } else {
      budgetPoints = 0
      budgetText = `الثمن يفوق الميزانية بـ${Math.round((ratio - 1) * 100)}%`
      blockers.push('الثمن يفوق الميزانية بأكثر من 15%')
    }
  }
  reasons.push({ key: 'budget', weight: MATCH_WEIGHTS.budget, points: round1(budgetPoints), ar: budgetText })

  // ---------- 4) المساحة ----------
  let areaPoints = 0
  let areaText = 'المساحة غير محدّدة'
  const wanted = request.desiredAreaM2
  const available = property.kind === 'land' ? property.areaM2 : property.builtAreaM2 ?? property.areaM2

  if (wanted && available) {
    if (property.kind === 'land') {
      // الأرض: تكفي إن ساوت المساحة المطلوبة أو زادت
      const ratio = available / wanted
      areaPoints = MATCH_WEIGHTS.area * clamp(ratio)
      areaText =
        ratio >= 1
          ? `الأرض ${Math.round(available)} م² تكفي لبناء ${wanted} م²`
          : `الأرض ${Math.round(available)} م² أصغر من المساحة المطلوبة`
      if (ratio < 0.6) blockers.push('مساحة الأرض أصغر بكثير من المطلوب')
    } else {
      // المبني: نقبل فرقاً معقولاً في الاتجاهين
      const diff = Math.abs(available - wanted) / wanted
      areaPoints = MATCH_WEIGHTS.area * clamp(1 - diff / 0.4)
      areaText =
        diff <= 0.1
          ? `المساحة ${Math.round(available)} م² مطابقة تقريباً`
          : `المساحة ${Math.round(available)} م² مقابل ${wanted} م² مطلوبة`
    }
  }
  reasons.push({ key: 'area', weight: MATCH_WEIGHTS.area, points: round1(areaPoints), ar: areaText })

  // ---------- 5) جاهزية الملفّ ----------
  const bandPoints: Record<string, number> = { A: 1, B: 0.8, C: 0.5, D: 0.2 }
  const readiness = MATCH_WEIGHTS.readiness * (bandPoints[request.scoreBand ?? ''] ?? 0.5)
  reasons.push({
    key: 'readiness',
    weight: MATCH_WEIGHTS.readiness,
    points: round1(readiness),
    ar: request.scoreBand
      ? `جاهزية الملفّ: صنف ${request.scoreBand}`
      : 'جاهزية الملفّ غير محسوبة',
  })

  // ---------- عرض غير قابل للمطابقة ----------
  if (property.status !== 'approved') {
    blockers.push('العرض غير مراجَع بعد')
  }

  const total = Math.round(reasons.reduce((sum, r) => sum + r.points, 0))

  return {
    propertyId: property.id,
    score: Math.max(0, Math.min(100, total)),
    reasons,
    blockers,
  }
}

/** ترتيب العروض لمطلب واحد، مع استبعاد ما فيه مانع قاطع */
export function rankProperties(
  request: MatchRequest,
  properties: MatchProperty[],
  options: { minScore?: number; limit?: number } = {}
): MatchResult[] {
  const minScore = options.minScore ?? 40
  const limit = options.limit ?? 10

  return properties
    .map((p) => matchScore(request, p))
    .filter((m) => m.blockers.length === 0 && m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/* ============================================================
 * الاتجاه المعاكس: من العرض إلى الحرفاء
 * ============================================================
 * نفس التنقيط بلا تغيير — يتبدّل اتجاه القراءة برك. الفريق كان مجبوراً
 * يفتح كلّ ملفّ حريف وحده باش يعرف شكون يناسبو عرض معيّن. هذا يقلبها:
 * العرض يقول بروحو شكون ينتظرو.
 */

export type MatchRequestWithId = MatchRequest & { id: string }

export type RequestMatch = {
  requestId: string
  score: number
  reasons: MatchReason[]
}

/** ترتيب الحرفاء المناسبين لعرض واحد، مع استبعاد ما فيه مانع قاطع */
export function rankRequests(
  property: MatchProperty,
  requests: MatchRequestWithId[],
  options: { minScore?: number; limit?: number } = {}
): RequestMatch[] {
  const minScore = options.minScore ?? 40
  const limit = options.limit ?? 10

  return requests
    .map((r) => ({ requestId: r.id, ...matchScore(r, property) }))
    .filter((m) => m.blockers.length === 0 && m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ requestId, score, reasons }) => ({ requestId, score, reasons }))
}

/* ============================================================
 * الفرص: أين يلتقي الطلب بالعرض
 * ============================================================
 * «37 مواطناً يبحثون عن أرض في منطقة X، وعندنا 3 عروض مناسبة.»
 * تجميع حسب المعتمدية ونوع المطلب، لا حسب السطور. الغرض أن تفتح
 * الإدارة الشاشة فتعرف وين تحطّ يدّها اليوم، بلا ما تقلّب في القوائم.
 */

export type Opportunity = {
  delegationId: number | null
  requestType: string
  /** عدد المطالب المفتوحة في هذه المنطقة وهذا النوع */
  demand: number
  /** منها ما هو جاهز فعلاً: صنف A أو B */
  readyDemand: number
  /** عدد العروض التي شكّلت تقاطعاً حقيقياً مع مطلب في هذه الخانة */
  supply: number
  /** أزواج (مطلب ← عرض) تجاوزت عتبة التنقيط — تقاطع حقيقي لا مجرّد جوار */
  pairs: number
  /** أعلى تنقيط في هذه الخانة */
  bestScore: number
}

export function findOpportunities(
  requests: MatchRequestWithId[],
  properties: MatchProperty[],
  options: { minScore?: number } = {}
): Opportunity[] {
  const minScore = options.minScore ?? 55
  const buckets = new Map<string, Opportunity>()
  // العروض التي طابقت فعلاً في كلّ خانة — لا نعدّ الجوار الجغرافي عرضاً
  const matchedProps = new Map<string, Set<string>>()

  for (const r of requests) {
    const key = `${r.delegationId ?? 'none'}|${r.requestType}`
    let b = buckets.get(key)
    if (!b) {
      b = {
        delegationId: r.delegationId,
        requestType: r.requestType,
        demand: 0,
        readyDemand: 0,
        supply: 0,
        pairs: 0,
        bestScore: 0,
      }
      buckets.set(key, b)
      matchedProps.set(key, new Set())
    }
    b.demand++
    if (r.scoreBand === 'A' || r.scoreBand === 'B') b.readyDemand++

    for (const p of properties) {
      const m = matchScore(r, p)
      if (m.blockers.length === 0 && m.score >= minScore) {
        b.pairs++
        matchedProps.get(key)!.add(p.id)
        if (m.score > b.bestScore) b.bestScore = m.score
      }
    }
  }

  for (const [key, b] of buckets) {
    b.supply = matchedProps.get(key)?.size ?? 0
  }

  return [...buckets.values()]
    .filter((b) => b.demand > 0)
    .sort((a, b) => b.pairs - a.pairs || b.demand - a.demand)
}
