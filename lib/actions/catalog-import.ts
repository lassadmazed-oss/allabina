'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import {
  buildPlan,
  planApplicable,
  type ExistingArticle,
  type ImportColumn,
  type ImportState,
} from '@/lib/catalog-import'

/**
 * استيراد الكاتالوج: معاينة ثمّ تطبيق.
 *
 * القسم 07: «استيراد مع dry-run». والمعاينة هنا ليست عرضاً تجميلياً:
 * النصّ نفسه يُعاد تحليله عند التطبيق ويُقارَن بالقاعدة **كما هي تلك
 * اللحظة**، لا بما كانت عليه وقت المعاينة. فلو بدّل زميل سعراً بين
 * الشاشتين ظهر الفرق أو سقط التطبيق — لا يُكتب على عمل أحد صامتاً.
 */

/** ملفّ كاتالوج معقول: 333 سطراً ≈ 50 كيلوبايت. المليون حدّ أمان لا هدف. */
const MAX_BYTES = 1_000_000

const COLUMN_TO_DB: Partial<Record<ImportColumn, string>> = {
  designation_ar: 'designation_ar',
  designation_fr: 'designation_fr',
  unit: 'unit',
  qty_formula: 'qty_formula',
  pu_fourniture_ht: 'pu_fourniture_ht',
  pu_main_oeuvre_ht: 'pu_main_oeuvre_ht',
  availability: 'availability',
  lead_time_days: 'lead_time_days',
  description: 'description',
}

const NUMERIC: ImportColumn[] = ['pu_fourniture_ht', 'pu_main_oeuvre_ht', 'lead_time_days']

const toNumber = (v: string) => {
  const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function loadContext(): Promise<{ existing: ExistingArticle[]; lotIdByCode: Map<number, number> }> {
  const [{ data: arts }, { data: lots }] = await Promise.all([
    db
      .from('articles')
      .select(
        'code, designation_ar, designation_fr, unit, qty_formula, pu_fourniture_ht, pu_main_oeuvre_ht, availability, lead_time_days, description, lots(code)'
      ),
    db.from('lots').select('id, code').eq('is_active', true),
  ])

  type Row = Record<string, unknown> & { lots?: { code: number } | { code: number }[] | null }
  const existing: ExistingArticle[] = ((arts ?? []) as unknown as Row[]).map((r) => {
    const lot = Array.isArray(r.lots) ? r.lots[0] : r.lots
    return {
      code: String(r.code),
      lotCode: Number(lot?.code ?? 0),
      designationAr: String(r.designation_ar ?? ''),
      designationFr: (r.designation_fr as string) ?? null,
      unit: String(r.unit ?? ''),
      qtyFormula: (r.qty_formula as string) ?? null,
      puFournitureHt: r.pu_fourniture_ht === null ? null : Number(r.pu_fourniture_ht),
      puMainOeuvreHt: r.pu_main_oeuvre_ht === null ? null : Number(r.pu_main_oeuvre_ht),
      availability: String(r.availability ?? 'on_order'),
      leadTimeDays: r.lead_time_days === null ? null : Number(r.lead_time_days),
      description: (r.description as string) ?? null,
    }
  })

  const lotIdByCode = new Map<number, number>(
    (lots ?? []).map((l) => [Number(l.code), Number(l.id)])
  )
  return { existing, lotIdByCode }
}

async function readText(formData: FormData): Promise<string | null> {
  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return null
    return await file.text()
  }
  const text = String(formData.get('text') ?? '')
  return text.length && text.length <= MAX_BYTES ? text : null
}

// ──────────────────────────────────────────────── المعاينة

export async function previewImportAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { step: 'idle', error: 'forbidden' }

  const file = formData.get('file')
  if (file instanceof File && file.size > MAX_BYTES) return { step: 'idle', error: 'too_big' }

  const text = await readText(formData)
  if (!text) return { step: 'idle', error: 'empty' }

  const { existing, lotIdByCode } = await loadContext()
  const plan = buildPlan(text, existing, [...lotIdByCode.keys()])
  return { step: 'preview', plan, text }
}

// ──────────────────────────────────────────────── التطبيق

export async function applyImportAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return { step: 'idle', error: 'forbidden' }

  const text = await readText(formData)
  if (!text) return { step: 'idle', error: 'empty' }

  // تُعاد القراءة من القاعدة الآن: المعاينة قد تكون قديمة
  const { existing, lotIdByCode } = await loadContext()
  const plan = buildPlan(text, existing, [...lotIdByCode.keys()])
  if (!planApplicable(plan)) return { step: 'preview', plan, text, error: 'not_applicable' }

  let created = 0
  let updated = 0

  for (const row of plan.rows) {
    if (row.action === 'create') {
      const lotCode = Number(row.values.lot_code)
      const lotId = lotIdByCode.get(lotCode)
      if (!lotId) continue
      const payload: Record<string, unknown> = {
        code: row.code,
        lot_id: lotId,
        // المقال المستورَد لا يُنشر: النشر قرار إدارة في شاشة أخرى
        is_public: false,
        is_active: true,
        updated_by: actor.userId,
      }
      for (const [col, dbCol] of Object.entries(COLUMN_TO_DB) as [ImportColumn, string][]) {
        const v = row.values[col]
        if (v === undefined || v === '') continue
        payload[dbCol] = NUMERIC.includes(col) ? toNumber(v) : v
      }
      const { error } = await db.from('articles').insert(payload)
      if (error) {
        console.error('import insert', row.code, error.message)
        continue
      }
      created++
      continue
    }

    if (row.action !== 'update') continue

    const payload: Record<string, unknown> = { updated_by: actor.userId }
    for (const ch of row.changes) {
      if (ch.column === 'lot_code') {
        const lotId = lotIdByCode.get(Number(ch.to))
        if (lotId) payload.lot_id = lotId
        continue
      }
      const dbCol = COLUMN_TO_DB[ch.column]
      if (!dbCol) continue
      payload[dbCol] = NUMERIC.includes(ch.column) ? toNumber(ch.to) : ch.to
    }
    const { error } = await db.from('articles').update(payload).eq('code', row.code)
    if (error) {
      console.error('import update', row.code, error.message)
      continue
    }
    updated++
  }

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'catalog.import', created, updated, lines: plan.rows.length },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  revalidatePath('/admin/bordereau')
  for (const l of ['ar', 'fr']) revalidatePath(`/${l}/catalogue`)

  return { step: 'done', applied: { created, updated } }
}
