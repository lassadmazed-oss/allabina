/**
 * أيّ ورقة تخصّ أيّ ملفّ.
 *
 * القاعدة الحاكمة: **لا نعرض ورقة لا تخصّه، ولا نخفي ورقة تخصّه.**
 * عرض ورقة زائدة يبعث المواطن إلى البلدية في سفرة بلا فائدة، وإخفاء
 * ورقة لازمة يوقّف ملفّه بعد شهر — والاثنان يكلّفانه وقتاً لا يملكه.
 *
 * منطق خالص بلا قاعدة ولا كوكيز: الدليل يجي من request_doc_catalog،
 * والسياق من إجابات صاحب المطلب، والدالّة تقرّر. فيُختبَر وحده.
 */

export const DOC_GROUPS = [
  'identity',
  'income',
  'property',
  'permits',
  'social',
  'support',
] as const

export type DocGroup = (typeof DOC_GROUPS)[number]

export type CatalogDoc = {
  code: string
  nameAr: string
  nameFr: string | null
  whyAr: string | null
  issuerAr: string | null
  group: DocGroup
  /** null = كلّ المسارات */
  appliesTo: string[] | null
  /** شروط إضافية، كلّها معاً */
  onlyIf: string[]
  required: boolean
  sortOrder: number
}

/** ما نعرفه عن صاحب الملفّ ساعة نقرّر أوراقه */
export type DocContext = {
  requestType: string
  employment: string
  cashReady: boolean
  isRenting: boolean
  existingLoans: number
  foprolosInterest: boolean
  hasDisability: boolean
  /** صفة الحيازة — واحدة */
  housingCondition: string
  /** ما يضايقه في مسكنه — متعدّد */
  housingProblems: readonly string[]
  incomeStability: string
  /** الترميم: من يملك الدار؟ الكاري لا يرمّم ولا يُطلَب منه إثبات ملكية */
  ownership?: string
  /** الترميم: نوع الأشغال — الرخصة تلزم حين يُبنى شيء */
  works?: readonly string[]
}

const EMPLOYED = new Set(['public', 'private'])
const SELF = new Set(['self_employed', 'informal', 'other'])

/**
 * هل يتحقّق الشرط؟
 *
 * شرط غير معروف يرجع false لا true: الفريق يقدر يزيد رمز شرط في
 * القاعدة قبل أن ندعمه في الكود، والأسلم أن تختفي الورقة حتى ندعمه
 * لا أن تُعرض للجميع.
 */
function holds(condition: string, c: DocContext): boolean {
  switch (condition) {
    case 'employed':
      return EMPLOYED.has(c.employment)
    case 'self_employed':
      return SELF.has(c.employment)
    case 'retired':
      return c.employment === 'retired'
    case 'expat':
      return c.employment === 'expat'
    case 'needs_bank':
      return !c.cashReady
    case 'cash_ready':
      return c.cashReady
    case 'renting':
      return c.isRenting || c.housingCondition === 'renting'
    case 'has_loans':
      return c.existingLoans > 0
    case 'foprolos':
      return c.foprolosInterest
    case 'owns_land':
      return c.requestType === 'build_on_land'
    /** إثبات الملكية لمن يملك — وفي غير الترميم لا معنى للسؤال فيمرّ */
    case 'home_owner':
      return c.requestType !== 'renovation' || c.ownership === 'owner' || c.ownership === 'heirs'
    /** رخصة الأشغال تلزم حين يُبنى شيء: توسعة أو طابق */
    case 'structural':
      return Boolean(c.works?.includes('extension') || c.works?.includes('add_floor'))
    case 'disability':
      return c.hasDisability
    /**
     * ضائقة: لا نسأل عليها مباشرة — من في ضائقة لا يصنّف نفسه.
     * نستنتجها من ثلاثة: بلا مسكن، أو مسكن خطر/بلا مرافق، أو بلا دخل.
     */
    case 'hardship':
      return (
        c.housingCondition === 'homeless' ||
        c.housingProblems.includes('unsafe') ||
        c.housingProblems.includes('no_utilities') ||
        c.incomeStability === 'none'
      )
    default:
      return false
  }
}

/** الأوراق التي تخصّ هذا الملفّ، مرتّبة كما تُعرض. */
export function applicableDocuments(catalog: CatalogDoc[], c: DocContext): CatalogDoc[] {
  return catalog
    .filter((d) => !d.appliesTo || d.appliesTo.includes(c.requestType))
    .filter((d) => d.onlyIf.every((cond) => holds(cond, c)))
    .sort((a, b) =>
      a.group === b.group
        ? a.sortOrder - b.sortOrder
        : DOC_GROUPS.indexOf(a.group) - DOC_GROUPS.indexOf(b.group)
    )
}

export type DocSection = { group: DocGroup; docs: CatalogDoc[] }

/** نفس القائمة مقسّمة بأقسامها، بلا قسم فارغ */
export function groupDocuments(docs: CatalogDoc[]): DocSection[] {
  return DOC_GROUPS.map((group) => ({ group, docs: docs.filter((d) => d.group === group) })).filter(
    (s) => s.docs.length > 0
  )
}

/** «عندك 4 من 7 ضرورية» — الضرورية وحدها تُعدّ */
export function requiredProgress(
  docs: CatalogDoc[],
  declared: readonly string[]
): { done: number; total: number } {
  const required = docs.filter((d) => d.required)
  const have = new Set(declared)
  return { done: required.filter((d) => have.has(d.code)).length, total: required.length }
}

/**
 * ما ينقص من الضروري — ما يقرأه الفريق قبل أن يرفع السمّاعة.
 */
export function missingRequired(docs: CatalogDoc[], declared: readonly string[]): CatalogDoc[] {
  const have = new Set(declared)
  return docs.filter((d) => d.required && !have.has(d.code))
}
