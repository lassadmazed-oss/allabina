/**
 * دورة حياة وثائق العرض — منطق خالص، بلا قاعدة ولا تشفير.
 *
 * كرّاس الشروط V2، القسم 05: «مسودة ← قيد المراجعة ← معتمد أو مرفوض
 * مع سبب ← مرسل ← مقبول / تعديل مطلوب / منتهي».
 *
 * الحالات محفوظة في القاعدة بنفس الأسماء، والحارس الحقيقي قيدٌ في
 * القاعدة (devis_sent_needs_approval) لا هذا الملفّ: هذا يمنع الخطأ،
 * وذاك يمنع الالتفاف.
 */

export const DOC_KINDS = ['est', 'dev', 'ctr', 'avenant'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const DOC_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'sent',
  'accepted',
  'changes_requested',
  'expired',
  'obsolete',
] as const
export type DocStatus = (typeof DOC_STATUSES)[number]

/**
 * ما يجوز أن يلي ماذا.
 *
 * `rejected` يرجع إلى المسودة لا إلى المراجعة: الرفض يعني أنّ شيئاً
 * يلزم يتبدّل، والتبديل يبدأ مسودة. و`sent` لا يرجع إلى `approved`:
 * نسخة خرجت إلى الحريف لا تُستبدل — تُنشأ نسخة جديدة.
 */
export const TRANSITIONS: Record<DocStatus, readonly DocStatus[]> = {
  draft: ['in_review', 'obsolete'],
  in_review: ['approved', 'rejected'],
  approved: ['sent', 'draft', 'obsolete'],
  rejected: ['draft', 'obsolete'],
  sent: ['accepted', 'changes_requested', 'expired', 'obsolete'],
  accepted: ['obsolete'],
  changes_requested: ['draft', 'obsolete'],
  expired: ['draft', 'obsolete'],
  obsolete: [],
}

/** الحالات التي تعني أنّ الوثيقة خرجت من الشركة إلى الحريف */
export const OUT_STATUSES: readonly DocStatus[] = ['sent', 'accepted', 'changes_requested', 'expired']

export type Doc = {
  kind: DocKind
  status: DocStatus
  contentHash: string | null
  approvedHash: string | null
  approvedAt: string | Date | null
  validUntil?: string | Date | null
}

/**
 * التقدير الآلي لا يحتاج اعتماداً يدوياً: القسم 04 يقول صراحةً إنّه
 * «لا يحتاج موافقة يدوية على كل حركة للزائر، ولا يمثّل عرضاً معتمداً».
 * ما عداه يحتاجه.
 */
export const needsApproval = (kind: DocKind) => kind !== 'est'

/**
 * هل الاعتماد ما زال صالحاً؟
 *
 * «القرار مربوط برقم النسخة أو hash؛ أي تعديل جوهري يلغي صلاحيته».
 * فبصمة ساعة الاعتماد تُقارَن ببصمة المحتوى الآن: اختلافهما يعني أنّ
 * المعتمَد ليس ما في اليد، والاعتماد يسقط بلا تدخّل أحد.
 */
export function approvalValid(doc: Doc): boolean {
  if (!needsApproval(doc.kind)) return true
  return Boolean(doc.approvedAt && doc.approvedHash && doc.approvedHash === doc.contentHash)
}

export type SendRefusal = 'not_approved' | 'approval_stale' | 'bad_status' | 'expired'

export function canSend(doc: Doc, now: Date = new Date()): { ok: true } | { ok: false; reason: SendRefusal } {
  if (!TRANSITIONS[doc.status].includes('sent')) return { ok: false, reason: 'bad_status' }
  if (doc.validUntil && new Date(doc.validUntil).getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (!needsApproval(doc.kind)) return { ok: true }
  if (!doc.approvedAt) return { ok: false, reason: 'not_approved' }
  if (!approvalValid(doc)) return { ok: false, reason: 'approval_stale' }
  return { ok: true }
}

export function canTransition(from: DocStatus, to: DocStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * ماذا يحدث حين يُعدَّل سعر أو نطاق أو مدّة؟
 *
 * «تعديل سعر أو نطاق أو مدة بعد الاعتماد ينشئ نسخة جديدة وتعود
 * للمراجعة. لا تُستبدل نسخة أرسلت للحريف.»
 */
export type EditOutcome =
  /** تُعدَّل في مكانها: ما زالت مسودة */
  | { action: 'edit_in_place' }
  /** تسقط صلاحية الاعتماد وتعود للمراجعة */
  | { action: 'back_to_review' }
  /** خرجت للحريف: تُجمَّد وتُنشأ نسخة جديدة */
  | { action: 'new_version' }

export function onMaterialEdit(doc: Doc): EditOutcome {
  if (OUT_STATUSES.includes(doc.status)) return { action: 'new_version' }
  if (doc.status === 'approved') return { action: 'back_to_review' }
  return { action: 'edit_in_place' }
}

/** وثيقة لا يعود العمل عليها ممكناً — للعرض لا للمنع */
export const isClosed = (s: DocStatus) => TRANSITIONS[s].length === 0
