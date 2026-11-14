'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { mediaRejection, nextSortOrder } from '@/lib/article-media'
import { canTransition, submitRefusals, type ChantierStatus } from '@/lib/site-reports'

/**
 * الورشة والتقرير اليومي.
 *
 * التقرير يُكتب ويُقدَّم ويُعتمد — ثلاث خطوات بثلاثة أفعال. والكمّيات
 * لا تدخل التقدّم إلّا بالاعتماد، فالاعتماد ليس تزييناً: هو ما يجعل
 * الرقم رقماً.
 *
 * ومن يكتب لا يعتمد: chef de projet عنده requests.write، والاعتماد
 * يحتاج docs.approve — نفس الفصل الذي في الوثائق.
 */
const SITE_BUCKET = 'site-photos'

function refresh(code?: string) {
  revalidatePath('/admin/chantiers')
  if (code) revalidatePath(`/admin/chantiers/${code}`)
  revalidatePath('/admin/approbations')
}

const num = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? '').trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const text = (v: FormDataEntryValue | null, max = 2000): string | null =>
  String(v ?? '').trim().slice(0, max) || null

// ─────────────────────────────────────────────── الورشة

export async function createChantierAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const devisId = String(formData.get('devis_id') ?? '') || null
  if (!devisId) return

  // المطلب يُستخرج من العرض لا من خانة مخفيّة: خانةٌ تحمل أوّل خيار
  // تربط الورشة بمطلب آخر حين يبدّل المستعمل العرض
  const { data: devis } = await db
    .from('devis')
    .select('request_id')
    .eq('id', devisId)
    .maybeSingle()
  const requestId = devis?.request_id ? String(devis.request_id) : ''
  if (!requestId) return

  const { data, error } = await db
    .from('chantiers')
    .insert({
      request_id: requestId,
      devis_id: devisId,
      started_at: text(formData.get('started_at'), 20),
      expected_end: text(formData.get('expected_end'), 20),
      created_by: actor.userId,
    })
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('create chantier', error.message)
    refresh()
    return
  }
  refresh(data?.code)
  if (data?.code) redirect(`/admin/chantiers/${data.code}`)
}

export async function setChantierStatusAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const code = String(formData.get('code') ?? '')
  const status = String(formData.get('status') ?? '') as ChantierStatus
  const note = text(formData.get('status_note'), 300)
  if (!code) return

  // التوقّف والإلغاء بلا سبب يبدوان إهمالاً بعد شهر
  if ((status === 'paused' || status === 'stopped') && !note) return refresh(code)

  await db
    .from('chantiers')
    .update({
      status,
      status_note: note,
      ...(status === 'delivered' ? { delivered_at: new Date().toISOString().slice(0, 10) } : {}),
    })
    .eq('code', code)
  refresh(code)
}

// ─────────────────────────────────────────────── التقرير

/**
 * حفظ تقرير اليوم.
 *
 * تقرير واحد لكلّ يوم — القاعدة تحرسه بفهرس فريد، وهنا نكتب عليه بدل
 * أن نُنشئ ثانياً. والمعتمَد لا يُحرَّر: تعديلٌ صامت يغيّر نسبةً رآها
 * الحريف.
 */
export async function saveReportAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const code = String(formData.get('code') ?? '')
  const chantierId = String(formData.get('chantier_id') ?? '')
  const reportDate = String(formData.get('report_date') ?? '').trim()
  if (!chantierId || !reportDate) return

  const { data: existing } = await db
    .from('site_reports')
    .select('id, status')
    .eq('chantier_id', chantierId)
    .eq('report_date', reportDate)
    .maybeSingle()

  if (existing && (existing.status === 'approved' || existing.status === 'submitted')) {
    return refresh(code)
  }

  const payload = {
    chantier_id: chantierId,
    report_date: reportDate,
    weather: text(formData.get('weather'), 120),
    planned: text(formData.get('planned')),
    done: text(formData.get('done')),
    blocked: text(formData.get('blocked')),
    blocked_reason: text(formData.get('blocked_reason')),
    decision_needed: text(formData.get('decision_needed')),
    next_plan: text(formData.get('next_plan')),
    author: actor.userId,
    status: 'draft' as const,
    review_note: null,
  }

  const { data: saved, error } = await db
    .from('site_reports')
    .upsert(payload, { onConflict: 'chantier_id,report_date' })
    .select('id')
    .maybeSingle()
  if (error || !saved) {
    console.error('save report', error?.message)
    return refresh(code)
  }

  // الكمّيات تُكتب من جديد: ما غاب من النموذج حُذف عمداً
  await db.from('site_report_lines').delete().eq('report_id', saved.id)
  const rows: { report_id: string; devis_line_id: number; qty_done: number }[] = []
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^qty_(\d+)$/)
    if (!m) continue
    const qty = num(value)
    if (qty === null || qty <= 0) continue
    rows.push({ report_id: String(saved.id), devis_line_id: Number(m[1]), qty_done: qty })
  }
  if (rows.length) {
    const { error: lineErr } = await db.from('site_report_lines').insert(rows)
    if (lineErr) console.error('report lines', lineErr.message)
  }

  refresh(code)
}

export async function submitReportAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return
  const code = String(formData.get('code') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const { data: r } = await db
    .from('site_reports')
    .select('id, status, done, blocked, blocked_reason, next_plan')
    .eq('id', id)
    .maybeSingle()
  if (!r || !canTransition(r.status as never, 'submitted')) return refresh(code)

  const [{ count: photos }, { data: lines }] = await Promise.all([
    db.from('site_report_photos').select('id', { count: 'exact', head: true }).eq('report_id', id),
    db.from('site_report_lines').select('devis_line_id, qty_done').eq('report_id', id),
  ])

  // نفس الشروط التي تعرضها الشاشة، مفحوصةً هنا: الشاشة تُلتفّ عليها
  const refusals = submitRefusals({
    done: (r.done as string) ?? null,
    blocked: (r.blocked as string) ?? null,
    blockedReason: (r.blocked_reason as string) ?? null,
    nextPlan: (r.next_plan as string) ?? null,
    lines: (lines ?? []).map((l) => ({
      devisLineId: String(l.devis_line_id),
      qtyDone: Number(l.qty_done),
    })),
    photos: photos ?? 0,
  })
  if (refusals.length) return refresh(code)

  await db
    .from('site_reports')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), review_note: null })
    .eq('id', id)
  refresh(code)
}

export async function reviewReportAction(formData: FormData) {
  // الاعتماد قرار إدارة — من يكتب التقرير لا يعتمده
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const code = String(formData.get('code') ?? '')
  const id = String(formData.get('id') ?? '')
  const approve = formData.get('approve') === '1'
  const note = text(formData.get('review_note'), 500)
  if (!id) return

  const { data: r } = await db.from('site_reports').select('status').eq('id', id).maybeSingle()
  if (!r) return
  const to = approve ? 'approved' : 'rejected'
  if (!canTransition(r.status as never, to)) return refresh(code)
  // الرفض بسبب — رفضٌ صامت يترك من كتب يخمّن
  if (!approve && !note) return refresh(code)

  await db
    .from('site_reports')
    .update({
      status: to,
      review_note: note,
      ...(approve
        ? { approved_at: new Date().toISOString(), approved_by: actor.userId }
        : { approved_at: null, approved_by: null }),
    })
    .eq('id', id)
  refresh(code)
}

// ─────────────────────────────────────────────── الصور

export type SitePhotoState = {
  ok: boolean
  uploaded?: number
  error?: 'type' | 'size' | 'empty' | 'report' | 'server' | 'forbidden' | 'locked'
}

export async function uploadSitePhotoAction(
  _prev: SitePhotoState,
  formData: FormData
): Promise<SitePhotoState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'forbidden' }

  const code = String(formData.get('code') ?? '')
  const reportId = String(formData.get('report_id') ?? '')
  const caption = text(formData.get('caption'), 200)
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!reportId) return { ok: false, error: 'report' }
  if (!files.length) return { ok: false, error: 'empty' }
  for (const f of files) {
    const rejection = mediaRejection(f.type, f.size)
    if (rejection) return { ok: false, error: rejection }
  }

  const { data: report } = await db
    .from('site_reports')
    .select('status')
    .eq('id', reportId)
    .maybeSingle()
  if (!report) return { ok: false, error: 'report' }
  // تقرير معتمَد لا تُزاد عليه صور: ما اعتُمد يبقى كما اعتُمد
  if (report.status === 'approved') return { ok: false, error: 'locked' }

  const { data: orders } = await db
    .from('site_report_photos')
    .select('sort_order')
    .eq('report_id', reportId)
  let order = nextSortOrder((orders ?? []).map((o) => Number(o.sort_order)))

  let uploaded = 0
  for (const f of files) {
    const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${reportId}/${Date.now()}-${order}.${ext}`
    const { error: upErr } = await db.storage
      .from(SITE_BUCKET)
      .upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type, upsert: false })
    if (upErr) {
      console.error('site photo upload', upErr.message)
      continue
    }
    const { error: rowErr } = await db.from('site_report_photos').insert({
      report_id: reportId,
      storage_path: path,
      caption,
      sort_order: order++,
      created_by: actor.userId,
    })
    if (rowErr) {
      await db.storage.from(SITE_BUCKET).remove([path])
      console.error('site photo row', rowErr.message)
      continue
    }
    uploaded++
  }

  refresh(code)
  return uploaded ? { ok: true, uploaded } : { ok: false, error: 'server' }
}
