/**
 * قواعد وحدة المساندة — ثوابت مشتركة بين الخادم والواجهة.
 * ملفّ منفصل عن `lib/actions/support.ts` لأنّ وحدة 'use server'
 * لا تُصدِّر إلّا دوالّ غير متزامنة.
 */

/** أحداث دفتر الشفافية بالترتيب الطبيعي للحياة: طُلب ← تُعهّد ← تأكّد ← وصل */
export const LEDGER_EVENTS = ['needed', 'pledged', 'confirmed', 'delivered', 'cancelled'] as const
export type LedgerEvent = (typeof LEDGER_EVENTS)[number]

/** كلّ أنواع المساهمة كما في القاعدة */
export const CONTRIBUTION_KINDS = [
  'land',
  'funding',
  'materials',
  'labour',
  'study',
  'admin_support',
  'other',
] as const

/**
 * أنواع المساهمة المفتوحة للعموم — بلا 'funding'.
 * المنصة لا تجمع أموالاً؛ القيد مضاعف: هنا وفي قيد على الجدول.
 */
export const PUBLIC_PLEDGE_KINDS = CONTRIBUTION_KINDS.filter((k) => k !== 'funding')

export const isPublicPledgeKind = (k: string) =>
  (PUBLIC_PLEDGE_KINDS as readonly string[]).includes(k)

/** حالات متابعة التعهّد في الـBack-office */
export const PLEDGE_STATUSES = ['new', 'contacted', 'accepted', 'declined'] as const

/**
 * تقدّم الحالة بالأعداد لا بالدنانير: «قُضيت 3 حاجيات من 5».
 * لا نعرض مجموعاً مالياً أبداً في الواجهة العمومية.
 */
export function needsProgress(needs: number, covered: number) {
  const total = Math.max(0, needs)
  const done = Math.min(Math.max(0, covered), total)
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/**
 * نصّ التعهّد كما يقرأه الفريق: الحاجيات المختارة ثمّ ما زاده المساهم.
 * حاجة مختارة تُذكر باسمها في الدفتر لا بصياغة المساهم لها — الاسم
 * الموحّد هو ما يطابق به الفريق التعهّد بالحاجة.
 */
export function composePledgeLabel(needLabels: readonly string[], free: string): string {
  const parts = [...needLabels.map((l) => l.trim()).filter(Boolean), free.trim()].filter(Boolean)
  return parts.join(' · ')
}

/* ============================================================
 * الحاجيات بالتفصيل — مسار كلّ حاجة في الدفتر
 * ============================================================ */

/** مراحل الحاجة بترتيبها: طُلبت ← تعهّد بها أحد ← تأكّد التعهّد ← وصلت */
export const NEED_STAGES = ['needed', 'pledged', 'confirmed', 'delivered'] as const
export type NeedStage = (typeof NEED_STAGES)[number] | 'cancelled'

export type LedgerLike = {
  id: number
  event: string
  label: string
  need_id: number | null
  occurred_at: string
  partner_public?: string | null
}

/** بلا تشكيل ولا مدّ ولا فراغات زائدة — «تعهّد بـ120» و«تعهد ب120» واحد */
const normLabel = (s: string) =>
  s.replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * ما جرى لحاجة واحدة.
 *
 * القيد يُنسب للحاجة بمعرّفها (need_id)، وإن غاب — قيود قديمة أو مكتوبة
 * يدوياً — بنصّها: «تعهّد بـ120 كيس إسمنت» يخصّ حاجة «120 كيس إسمنت».
 * المرحلة أعلى ما بلغته؛ الإلغاء لا يُحسب إلّا إن كان آخر ما حدث ولم تصل.
 */
export function needTimeline<T extends LedgerLike>(need: T, rows: readonly T[]) {
  const key = normLabel(need.label)
  const related = rows
    .filter((r) => r.id !== need.id && r.event !== 'needed')
    .filter((r) => r.need_id === need.id || (r.need_id == null && key.length > 2 && normLabel(r.label).includes(key)))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id)
  const has = (e: string) => related.some((r) => r.event === e)
  const last = related[related.length - 1] ?? null
  let stage: NeedStage = 'needed'
  if (has('delivered')) stage = 'delivered'
  else if (last?.event === 'cancelled') stage = 'cancelled'
  else if (has('confirmed')) stage = 'confirmed'
  else if (has('pledged')) stage = 'pledged'
  const partner = [...related].reverse().find((r) => r.partner_public)?.partner_public ?? null
  return { stage, related, last, partner }
}

export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number]

/** كلّ نوع تدخّل كما يشرحه الفريق لنفسه: ماذا يغطّي وكيف يُكتب في الدفتر */
export const CONTRIBUTION_KIND_INFO: Record<ContributionKind, { ar: string; hint: string; example: string }> = {
  materials: { ar: 'مواد بناء', hint: 'إسمنت، آجرّ، حديد، ألمنيوم، عزل — بالكمّية والوحدة', example: '120 كيس إسمنت' },
  labour: { ar: 'يد عاملة', hint: 'بنّاء، كهربائي، سبّاك — بعدد الأيّام أو المهمّة', example: 'بنّاء لثلاثة أيّام لصبّ السقف' },
  study: { ar: 'دراسة فنّية', hint: 'مهندس، رسم، معاينة سلامة، تقدير كلفة', example: 'معاينة مهندس لسلامة الجدران' },
  admin_support: { ar: 'مرافقة إدارية', hint: 'رخصة بناء، وثائق عقارية، ملفّ بلدية', example: 'ملفّ رخصة ترميم بالبلدية' },
  land: { ar: 'أرض', hint: 'قطعة أرض أو حقّ استعمال موثّق', example: 'قطعة 150 م² بحقّ استعمال' },
  funding: { ar: 'تمويل مؤسّسي', hint: 'داخلي فقط: لا يُقبل من العموم، شريك مؤسّسي بوثيقة', example: 'منحة جمعية لشراء نوافذ' },
  other: { ar: 'أخرى', hint: 'نقل مواد، سكن مؤقّت، أثاث أساسي', example: 'نقل المواد من صفاقس إلى قرقنة' },
}

/** من تصريح صاحب الطلب (support_intake.need_kinds) إلى أنواع التدخّل التي تسدّه */
const INTAKE_TO_KINDS: Record<string, ContributionKind[]> = {
  roof: ['materials', 'labour'],
  room: ['materials', 'labour', 'study'],
  materials: ['materials'],
  labor: ['labour'],
  study: ['study'],
  admin: ['admin_support'],
  relocation: ['other'],
  utilities: ['materials', 'labour'],
  other: ['other'],
}

export function suggestedKinds(intakeKinds: readonly string[] | null | undefined): ContributionKind[] {
  const out: ContributionKind[] = []
  for (const k of intakeKinds ?? []) for (const c of INTAKE_TO_KINDS[k] ?? []) if (!out.includes(c)) out.push(c)
  return out
}
