/**
 * طريقة البناء — كراس الشروط، القسم 12.
 *
 * المنصة كانت تفترض طريقة بناء واحدة ضمنيّة: بوردرو واحد وDevis واحد بلا
 * أن تقول أيّ نظام تحسب. هنا يصير النظام كائناً صريحاً يختاره المواطن.
 *
 * قاعدة تسري في كلّ ما يلي: **الأرقام تُعلَّق على العرض (مصنّع × نظام) لا
 * على النظام**. «بحر 4,80 م» ليس رقم «نظام البلوك»، بل رقم poutrelle
 * بعينها في Avis Technique بعينه. خلط الاثنين ينسب رقماً إلى وثيقة لا
 * تحتويه — وفي السقوف هذا خطر لا خطأ تحريري.
 */

export type SystemCode = string

export type ConstructionSystem = {
  code: SystemCode
  name_ar: string
  name_fr: string | null
  citizen_summary_ar: string
  citizen_summary_fr: string | null
  principle_ar: string | null
  principle_fr: string | null
  sort_order: number
  is_active: boolean
  constraints: SystemConstraints
}

/**
 * حدود تسري في النظام لا نصّ يُعرض.
 * مثال: مشروع بقبو موقف سيارات لا يُقترح عليه نظام البلوك آلياً، لأنّ
 * الـAvis يشترط لذلك مقاومة حريق أعلى من الساعة التي يضمنها.
 */
export type SystemConstraints = {
  fire_resistance_hours?: number
  fire_reaction_class?: string
  load_bearing_series_cm?: number[]
  partition_series_cm?: number[]
  excluded_uses?: string[]
  excluded_reason_ar?: string
  wind_check?: string
  raidisseur_spacing_m?: number
  enduit_exterieur_mm?: number
  standards?: string[]
}

export const ELEMENT_SCOPES = ['mur', 'plancher', 'cloture'] as const
export type ElementScope = (typeof ELEMENT_SCOPES)[number]

export const SCOPE_LABELS: Record<ElementScope, string> = {
  mur: 'الجدران',
  plancher: 'السقف',
  cloture: 'سور الحدود',
}

export const OFFERING_STATUSES = ['draft', 'partial', 'published'] as const
export type OfferingStatus = (typeof OFFERING_STATUSES)[number]

export const OFFERING_STATUS_LABELS: Record<OfferingStatus, string> = {
  draft: 'مسوّدة',
  partial: 'ناقص الوثائق',
  published: 'منشور',
}

export const DOC_KIND_LABELS: Record<string, string> = {
  avis_technique: 'Avis Technique',
  plan: 'Plans',
  note_calcul: 'Note de calcul',
  fiche: 'Fiche technique',
  methode: 'Méthode de mise en œuvre',
  autre: 'أخرى',
}

export type SpanLimit = {
  usage_code: string
  usage_ar: string
  load_kn_m2: number
  assembly_code: string
  span_max_m: number
  reinforcement: string | null
}

/** سماكة السقف المجمَّعة: 12+4 = 16 صم · 15+5 = 20 · 20+6 = 26 */
export function assemblyThicknessCm(assembly: string): number | null {
  const parts = assembly.split('+').map((p) => Number(p.trim()))
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null
  return parts[0] + parts[1]
}

export type AssemblyVerdict = {
  assembly: string
  spanMax: number
  /** هل البحر المطلوب داخل حدّ هذه التركيبة */
  fits: boolean
  /** كم متراً ينقص أو يفيض — للعرض لا للحساب الإنشائي */
  marginM: number
}

/**
 * أيّ تركيبات سقف تحتمل بحراً معلوماً في استعمال معلوم.
 *
 * هذه دالّة **فرز لا قرار**. تعطي الترتيب وتقول أين يقف كلّ خيار من
 * الحدّ، ولا تختار. سببه في القسم 8 من الفصل: غرفة ببحر 4,50 م تتجاوز
 * حدّ 15+5 (4,20) فتستوجب 20+6، ونفس الـ4,20 م تكفي للسكن ولا تكفي
 * لمحلّ تجاري (3,60). أيّ اختيار آليّ من المساحة وحدها قد يعطي سقفاً
 * خارج حدوده.
 */
export function assembliesForSpan(
  limits: SpanLimit[],
  usageCode: string,
  spanM: number
): AssemblyVerdict[] {
  return limits
    .filter((l) => l.usage_code === usageCode)
    .map((l) => ({
      assembly: l.assembly_code,
      spanMax: l.span_max_m,
      fits: spanM > 0 && spanM <= l.span_max_m,
      marginM: Math.round((l.span_max_m - spanM) * 100) / 100,
    }))
    .sort((a, b) => a.spanMax - b.spanMax)
}

/**
 * أصغر تركيبة تحتمل البحر — **اقتراح يُعرض على المهندس**، لا قرار.
 * تعيد null إن لم تكفِ أيّ تركيبة: هناك الجواب «هذا النظام لا يناسب»
 * لا «خذ الأكبر».
 */
export function suggestAssembly(
  limits: SpanLimit[],
  usageCode: string,
  spanM: number
): AssemblyVerdict | null {
  return assembliesForSpan(limits, usageCode, spanM).find((a) => a.fits) ?? null
}

/**
 * طول تقوية القصّ عند كلّ طرف حين يستوجب البحر L1 تقوية:
 * يُبحث عن أكبر بحر L2 لا يستوجبها، والطول = (L1 − L2)/2 + 20 صم،
 * بحدّ أدنى 40 صم. (Avis Technique — الأسقف)
 *
 * موجودة هنا لأنّها تُعرض للمختصّ في ورقة السقف، لا ليحسب بها البرنامج
 * وحده: القرار يبقى للمهندس ويُسجَّل باسمه.
 */
export function shearReinforcementCm(spanL1M: number, spanL2M: number): number {
  const cm = ((spanL1M - spanL2M) * 100) / 2 + 20
  return Math.max(40, Math.round(cm))
}

/**
 * هل يصلح النظام لهذا المشروع؟
 * تُقرأ الحدود من `constraints` بصيغة برمجية، فيُستبعَد النظام آلياً بدل
 * أن يُترك للمواطن نصّ تحذيريّ يقرأه أو لا يقرأه.
 */
export function systemFitsProject(
  system: Pick<ConstructionSystem, 'constraints'>,
  project: { uses?: string[] }
): { ok: boolean; reason?: string } {
  const excluded = system.constraints?.excluded_uses ?? []
  const hit = (project.uses ?? []).find((u) => excluded.includes(u))
  if (!hit) return { ok: true }
  return {
    ok: false,
    reason: system.constraints?.excluded_reason_ar ?? 'خارج نطاق استعمال هذا النظام',
  }
}

/** استعمالات المشروع التي تُفحص ضدّ حدود الأنظمة */
export const PROJECT_USES: { code: string; label_ar: string }[] = [
  { code: 'sous_sol_parking', label_ar: 'قبو بموقف سيارات' },
  { code: 'commerce_rdc', label_ar: 'محلّ تجاري بالطابق السفلي' },
  { code: 'bureaux', label_ar: 'مكاتب' },
]

/** سماكة الجدار الحامل: تُقرأ من حدود النظام لا من ثابت في الشفرة */
export function loadBearingSeries(system: Pick<ConstructionSystem, 'constraints'>): number[] {
  return system.constraints?.load_bearing_series_cm ?? []
}

export function isLoadBearingThickness(
  system: Pick<ConstructionSystem, 'constraints'>,
  cm: number
): boolean {
  return loadBearingSeries(system).includes(cm)
}
