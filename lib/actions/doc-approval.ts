'use server'

import { revalidatePath } from 'next/cache'
import { recordEvent } from '@/lib/analytics-server'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { canSend, canTransition, onMaterialEdit, type Doc, type DocStatus } from '@/lib/doc-flow'
import { contentHash } from '@/lib/doc-hash'

/**
 * اعتماد الوثائق — الفصل بين الإعداد والقرار.
 *
 * كرّاس الشروط V2، القسم 08: «الموظف لا يعتمد اقتراحه إلا إذا عنده
 * تفويض صريح». فـdocs.prepare تُعدّ وتقدّم للمراجعة، وdocs.approve
 * تقرّر وترسل. الوكيل عنده الأولى لا الثانية.
 *
 * والقرار يُربط ببصمة المحتوى لا بالسطر: اعتماد على سعر ثمّ تبديل
 * السعر يسقط الاعتماد وحده — في القاعدة بقيد، وهنا قبل أن يصل إليه.
 */
type Row = {
  id: string
  request_id: string
  kind: string
  version: number
  status: DocStatus
  total_ht: number | string
  tax_rate_pct: number | string | null
  valid_until: string | null
  inclusions: string | null
  exclusions: string | null
  payment_terms: string | null
  content_hash: string | null
  approved_hash: string | null
  approved_at: string | null
}

const FIELDS =
  'id, request_id, kind, version, status, total_ht, tax_rate_pct, valid_until, inclusions, exclusions, payment_terms, content_hash, approved_hash, approved_at'

async function load(id: string): Promise<Row | null> {
  const { data } = await db.from('devis').select(FIELDS).eq('id', id).maybeSingle()
  return (data as Row) ?? null
}

/** يحسب البصمة من الوثيقة وأسطرها كما هي الآن، ويخزّنها */
export async function refreshContentHash(id: string): Promise<string | null> {
  const row = await load(id)
  if (!row) return null

  const { data: lines } = await db
    .from('devis_lines')
    .select('article_code, quantity, pu_total_ht, total_ht')
    .eq('devis_id', id)

  const hash = contentHash({
    kind: row.kind,
    version: row.version,
    totalHt: row.total_ht,
    taxRatePct: row.tax_rate_pct,
    validUntil: row.valid_until,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    paymentTerms: row.payment_terms,
    lines: (lines ?? []).map((l) => ({
      articleCode: String(l.article_code),
      quantity: l.quantity as number,
      puTotalHt: l.pu_total_ht as number,
      totalHt: l.total_ht as number,
    })),
  })

  await db.from('devis').update({ content_hash: hash }).eq('id', id)
  return hash
}

const asDoc = (r: Row): Doc => ({
  kind: r.kind as Doc['kind'],
  status: r.status,
  contentHash: r.content_hash,
  approvedHash: r.approved_hash,
  approvedAt: r.approved_at,
  validUntil: r.valid_until,
})

async function log(requestId: string, actor: string, note: string) {
  await db
    .from('request_events')
    .insert({ request_id: requestId, event_type: 'note', actor, note })
    .then(({ error }) => error && console.warn('request_events', error.message))
}

function done(requestId: string) {
  revalidatePath(`/admin/${requestId}`)
  revalidatePath('/admin/approbations')
}

// ─────────────────────────────────────────── تقديم للمراجعة

export async function submitForReviewAction(formData: FormData) {
  const actor = await staffWithPermission('docs.prepare')
  if (!actor) return
  const id = String(formData.get('id') ?? '')
  const row = await load(id)
  if (!row || !canTransition(row.status, 'in_review')) return

  // البصمة تُثبَّت عند التقديم: المراجع يقرّر على محتوى محدَّد
  await refreshContentHash(id)
  await db
    .from('devis')
    .update({ status: 'in_review', submitted_at: new Date().toISOString(), review_note: null })
    .eq('id', id)

  await log(row.request_id, actor.userId, `تقديم ${row.kind.toUpperCase()} للمراجعة (نسخة ${row.version})`)
  done(row.request_id)
}

// ─────────────────────────────────────────── اعتماد ورفض

export async function approveDocAction(formData: FormData) {
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const id = String(formData.get('id') ?? '')
  const row = await load(id)
  if (!row || !canTransition(row.status, 'approved')) return

  // البصمة تُعاد قبل الاعتماد: قد يكون شيء تبدّل بعد التقديم
  const hash = await refreshContentHash(id)
  if (!hash) return

  await db
    .from('devis')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: actor.userId,
      approved_hash: hash,
      review_note: null,
    })
    .eq('id', id)

  if (row.kind !== 'est') {
    await recordEvent('devis_approved', { requestId: row.request_id, meta: { kind: row.kind } })
  }
  await log(row.request_id, actor.userId, `اعتماد ${row.kind.toUpperCase()} نسخة ${row.version}`)
  done(row.request_id)
}

export async function rejectDocAction(formData: FormData) {
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const id = String(formData.get('id') ?? '')
  // «مرفوض مع سبب» — لا رفض صامت
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500)
  if (!reason) return

  const row = await load(id)
  if (!row || !canTransition(row.status, 'rejected')) return

  await db
    .from('devis')
    .update({ status: 'rejected', review_note: reason, approved_at: null, approved_hash: null })
    .eq('id', id)

  await log(row.request_id, actor.userId, `رفض ${row.kind.toUpperCase()} نسخة ${row.version}: ${reason}`)
  done(row.request_id)
}

// ─────────────────────────────────────────── الإرسال

export async function sendDocAction(formData: FormData) {
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const id = String(formData.get('id') ?? '')
  const row = await load(id)
  if (!row) return

  // البصمة تُعاد قبل الفحص: تعديل بعد الاعتماد يسقطه هنا لا في القاعدة
  await refreshContentHash(id)
  const fresh = await load(id)
  if (!fresh) return

  const verdict = canSend(asDoc(fresh))
  if (!verdict.ok) {
    await log(
      fresh.request_id,
      actor.userId,
      `رُفض إرسال ${fresh.kind.toUpperCase()} نسخة ${fresh.version}: ${verdict.reason}`
    )
    done(fresh.request_id)
    return
  }

  await db
    .from('devis')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  await log(fresh.request_id, actor.userId, `إرسال ${fresh.kind.toUpperCase()} نسخة ${fresh.version}`)
  done(fresh.request_id)
}

// ─────────────────────────────────────────── بعد تعديل جوهري

/**
 * يُستدعى بعد كلّ تحرير يمسّ سعراً أو نطاقاً أو مدّة.
 * يقرّر المصير بدل أن يتركه لذاكرة من حرّر.
 */
export async function afterMaterialEdit(id: string, actorId: string): Promise<void> {
  const row = await load(id)
  if (!row) return
  const outcome = onMaterialEdit(asDoc(row))
  await refreshContentHash(id)

  if (outcome.action === 'back_to_review') {
    await db
      .from('devis')
      .update({ status: 'in_review', approved_at: null, approved_hash: null, approved_by: null })
      .eq('id', id)
    await log(row.request_id, actorId, `تعديل بعد الاعتماد — ${row.kind.toUpperCase()} عاد للمراجعة`)
  }
  // new_version: تُنشئه شاشة التوليد، لأنّه يحتاج أسطراً جديدة لا تحيين حالة
  done(row.request_id)
}
