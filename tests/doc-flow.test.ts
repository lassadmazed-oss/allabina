import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DOC_STATUSES,
  TRANSITIONS,
  approvalValid,
  canSend,
  canTransition,
  isClosed,
  needsApproval,
  onMaterialEdit,
  type Doc,
} from '@/lib/doc-flow'
import { contentHash, type HashableDoc } from '@/lib/doc-hash'

/**
 * دورة اعتماد الوثائق.
 *
 * قبل 14/11/2026 كانت الحالات أربعاً: draft | sent | accepted | obsolete.
 * لا «قيد المراجعة» ولا «معتمد» ولا «مرفوض بسبب» — فشرط الكرّاس «يمنع
 * إرسال عرض غير معتمد» لم يكن قابلاً للتطبيق: ما ثمّ حالة تميّز
 * المعتمد من غيره.
 *
 * والخطأ هنا صامت وغالٍ: عرض يخرج بسعر لم تعتمده الإدارة يلزم الشركة
 * تجارياً. فالاختبار يسأل عن الرفض أكثر ممّا يسأل عن القبول.
 */
const doc = (over: Partial<Doc> = {}): Doc => ({
  kind: 'dev',
  status: 'approved',
  contentHash: 'h1',
  approvedHash: 'h1',
  approvedAt: '2026-11-14T10:00:00Z',
  ...over,
})

describe('ما يجوز أن يلي ماذا', () => {
  it('المسودة تمشي للمراجعة لا للإرسال', () => {
    expect(canTransition('draft', 'in_review')).toBe(true)
    expect(canTransition('draft', 'sent')).toBe(false)
    expect(canTransition('draft', 'approved')).toBe(false)
  })

  it('المرفوض يرجع مسودة لا مراجعة: الرفض يعني أنّ شيئاً يلزم يتبدّل', () => {
    expect(canTransition('rejected', 'draft')).toBe(true)
    expect(canTransition('rejected', 'in_review')).toBe(false)
  })

  it('نسخة خرجت للحريف لا ترجع معتمدة ولا مسودة', () => {
    expect(canTransition('sent', 'approved')).toBe(false)
    expect(canTransition('sent', 'draft')).toBe(false)
    expect(canTransition('sent', 'accepted')).toBe(true)
    expect(canTransition('sent', 'changes_requested')).toBe(true)
  })

  it('المقبول والملغى نهايتان', () => {
    expect(isClosed('obsolete')).toBe(true)
    expect(TRANSITIONS.accepted).toEqual(['obsolete'])
  })

  it('كلّ حالة معروفة لها مدخل — ولا وجهة خارج القائمة', () => {
    for (const s of DOC_STATUSES) {
      expect(TRANSITIONS[s], s).toBeDefined()
      for (const to of TRANSITIONS[s]) expect(DOC_STATUSES, `${s}→${to}`).toContain(to)
    }
  })
})

describe('الإرسال', () => {
  it('المعتمَد ببصمة مطابقة يُرسَل', () => {
    expect(canSend(doc())).toEqual({ ok: true })
  })

  it('غير المعتمَد لا يُرسَل', () => {
    const d = canSend(doc({ approvedAt: null, approvedHash: null }))
    expect(d).toEqual({ ok: false, reason: 'not_approved' })
  })

  it('اعتماد على محتوى تبدّل بعده يسقط — وهذا بيت القصيد', () => {
    const d = canSend(doc({ contentHash: 'h2' }))
    expect(d).toEqual({ ok: false, reason: 'approval_stale' })
  })

  it('من حالة لا تسمح بالإرسال: يُرفض قبل النظر في الاعتماد', () => {
    expect(canSend(doc({ status: 'draft' }))).toEqual({ ok: false, reason: 'bad_status' })
    expect(canSend(doc({ status: 'in_review' }))).toEqual({ ok: false, reason: 'bad_status' })
  })

  it('منتهي الصلاحية لا يُرسَل ولو كان معتمداً', () => {
    const d = canSend(doc({ validUntil: '2026-11-01' }), new Date('2026-11-14T10:00:00Z'))
    expect(d).toEqual({ ok: false, reason: 'expired' })
  })

  it('التقدير الآلي يُرسَل بلا اعتماد — والكرّاس يقول ذلك صراحةً', () => {
    expect(needsApproval('est')).toBe(false)
    expect(canSend(doc({ kind: 'est', approvedAt: null, approvedHash: null }))).toEqual({ ok: true })
  })

  it('العقد والavenant يحتاجان اعتماداً كالعرض', () => {
    for (const kind of ['dev', 'ctr', 'avenant'] as const) {
      expect(needsApproval(kind), kind).toBe(true)
      expect(canSend(doc({ kind, approvedAt: null })).ok, kind).toBe(false)
    }
  })
})

describe('ماذا يحدث عند تعديل جوهري', () => {
  it('المسودة تُعدَّل في مكانها', () => {
    expect(onMaterialEdit(doc({ status: 'draft' }))).toEqual({ action: 'edit_in_place' })
  })

  it('المعتمَد يرجع للمراجعة', () => {
    expect(onMaterialEdit(doc({ status: 'approved' }))).toEqual({ action: 'back_to_review' })
  })

  it('ما خرج للحريف يُجمَّد وتُنشأ نسخة', () => {
    for (const s of ['sent', 'accepted', 'changes_requested', 'expired'] as const) {
      expect(onMaterialEdit(doc({ status: s })), s).toEqual({ action: 'new_version' })
    }
  })
})

describe('بصمة المحتوى', () => {
  const base: HashableDoc = {
    kind: 'dev',
    version: 1,
    totalHt: 120000,
    taxRatePct: 19,
    validUntil: '2026-12-31',
    paymentTerms: '30% عند الإمضاء',
    lines: [
      { articleCode: 'A-01', quantity: 10, puTotalHt: 100, totalHt: 1000 },
      { articleCode: 'A-02', quantity: 5, puTotalHt: 200, totalHt: 1000 },
    ],
  }

  it('نفس المحتوى نفس البصمة', () => {
    expect(contentHash(base)).toBe(contentHash({ ...base }))
  })

  it('صيغة الرقم لا تبدّلها: 1000 و«1000.00» سواء', () => {
    const other = { ...base, totalHt: '120000.000' as const }
    expect(contentHash(other)).toBe(contentHash(base))
  })

  it('ترتيب الأسطر لا يبدّلها — لا يسقط اعتماد لأجل ترتيب', () => {
    expect(contentHash({ ...base, lines: [...base.lines].reverse() })).toBe(contentHash(base))
  })

  it('تبديل كمّية أو سعر يبدّلها', () => {
    const qty = { ...base, lines: [{ ...base.lines[0], quantity: 11 }, base.lines[1]] }
    expect(contentHash(qty)).not.toBe(contentHash(base))
    expect(contentHash({ ...base, totalHt: 120001 })).not.toBe(contentHash(base))
  })

  it('تبديل شرط دفع أو أداء أو صلاحية يبدّلها — وهي بنود الوثيقة', () => {
    for (const over of [
      { paymentTerms: '50% عند الإمضاء' },
      { taxRatePct: 7 },
      { validUntil: '2027-01-31' },
      { exclusions: 'بلا تكييف' },
    ]) {
      expect(contentHash({ ...base, ...over }), JSON.stringify(over)).not.toBe(contentHash(base))
    }
  })

  it('حذف سطر يبدّلها ولو بقي المجموع', () => {
    expect(contentHash({ ...base, lines: [base.lines[0]] })).not.toBe(contentHash(base))
  })
})

describe('الحارس في القاعدة لا في الشفرة وحدها', () => {
  const sql = readFileSync('supabase/migrations/0056_doc_approval.sql', 'utf8')

  it('قيد يمنع الإرسال بلا اعتماد — يصمد أمام استدعاء SQL مباشر', () => {
    expect(sql).toContain('devis_sent_needs_approval')
    expect(sql).toContain('approved_hash = content_hash')
  })

  it('التقدير الآلي مستثنى صراحةً', () => {
    expect(sql).toMatch(/kind = 'est'/)
  })

  it('مرجع لكلّ نوع: EST · DEV · CTR · AVN', () => {
    for (const p of ['EST', 'DEV', 'CTR', 'AVN']) expect(sql).toContain(`'${p}'`)
  })
})
