import 'server-only'
import { db } from '@/lib/supabase/server'
import {
  progressByLot,
  progressOf,
  reportGap,
  type ChantierStatus,
  type ContractLine,
  type DoneEntry,
  type Progress,
  type ReportStatus,
} from '@/lib/site-reports'

/**
 * قراءات الورشة.
 *
 * قاعدة واحدة تسري على كلّ ما هنا: **لا يُحتسب في التقدّم إلّا تقريرٌ
 * معتمَد**. ما لم يراجعه أحد لا يصير رقماً — لا في اللوحة ولا عند
 * الحريف. والترشيح في الاستعلام لا في العرض.
 */
type Row = Record<string, unknown>

export type Chantier = {
  id: string
  code: string
  requestId: string
  requestRef: string | null
  clientName: string | null
  devisId: string | null
  chefUserId: string | null
  status: ChantierStatus
  statusNote: string | null
  startedAt: string | null
  expectedEnd: string | null
  deliveredAt: string | null
}

const CH_SELECT =
  'id, code, request_id, devis_id, chef_user_id, status, status_note, started_at, expected_end, delivered_at, ' +
  'housing_requests(ref_code, full_name)'

function shapeChantier(r: Row): Chantier {
  const raw = r.housing_requests as Row | Row[] | null
  const req = Array.isArray(raw) ? raw[0] : raw
  return {
    id: String(r.id),
    code: String(r.code),
    requestId: String(r.request_id),
    requestRef: (req?.ref_code as string) ?? null,
    clientName: (req?.full_name as string) ?? null,
    devisId: (r.devis_id as string) ?? null,
    chefUserId: (r.chef_user_id as string) ?? null,
    status: (r.status as ChantierStatus) ?? 'preparing',
    statusNote: (r.status_note as string) ?? null,
    startedAt: (r.started_at as string) ?? null,
    expectedEnd: (r.expected_end as string) ?? null,
    deliveredAt: (r.delivered_at as string) ?? null,
  }
}

export type SiteReport = {
  id: string
  chantierId: string
  reportDate: string
  weather: string | null
  planned: string | null
  done: string | null
  blocked: string | null
  blockedReason: string | null
  decisionNeeded: string | null
  nextPlan: string | null
  status: ReportStatus
  reviewNote: string | null
  photos: number
}

/** أسطر العقد — الكمّيات المتعاقَد عليها وقيمتها */
export async function getContractLines(devisId: string | null): Promise<ContractLine[]> {
  if (!devisId) return []
  const { data } = await db
    .from('devis_lines')
    .select('id, lot_code, lot_name_ar, designation_ar, unit, quantity, total_ht')
    .eq('devis_id', devisId)
    .order('sort_order')
  return (data ?? []).map((r) => ({
    id: String(r.id),
    lotCode: Number(r.lot_code ?? 0),
    lotNameAr: String(r.lot_name_ar ?? ''),
    designationAr: String(r.designation_ar ?? ''),
    unit: String(r.unit ?? ''),
    quantity: Number(r.quantity ?? 0),
    totalHt: Number(r.total_ht ?? 0),
  }))
}

/** الكمّيات المنجزة من التقارير **المعتمَدة** وحدها */
export async function getApprovedEntries(chantierId: string): Promise<DoneEntry[]> {
  const { data: reports } = await db
    .from('site_reports')
    .select('id')
    .eq('chantier_id', chantierId)
    .eq('status', 'approved')
  const ids = (reports ?? []).map((r) => String(r.id))
  if (!ids.length) return []

  const { data } = await db
    .from('site_report_lines')
    .select('devis_line_id, qty_done')
    .in('report_id', ids)
  return (data ?? []).map((r) => ({
    devisLineId: String(r.devis_line_id),
    qtyDone: Number(r.qty_done ?? 0),
  }))
}

export type ChantierCard = Chantier & {
  progress: Progress
  lastApproved: string | null
  gapDays: number | null
  pendingReports: number
}

export async function getChantiers(): Promise<ChantierCard[]> {
  const { data } = await db.from('chantiers').select(CH_SELECT).order('code')
  const rows = (data ?? []) as unknown as Row[]

  const out: ChantierCard[] = []
  for (const r of rows) {
    const c = shapeChantier(r)
    const [lines, entries, last, pending] = await Promise.all([
      getContractLines(c.devisId),
      getApprovedEntries(c.id),
      db
        .from('site_reports')
        .select('report_date')
        .eq('chantier_id', c.id)
        .eq('status', 'approved')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('site_reports')
        .select('id', { count: 'exact', head: true })
        .eq('chantier_id', c.id)
        .eq('status', 'submitted'),
    ])
    const lastApproved = (last.data?.report_date as string) ?? null
    out.push({
      ...c,
      progress: progressOf(lines, entries),
      lastApproved,
      gapDays: reportGap(lastApproved),
      pendingReports: pending.count ?? 0,
    })
  }
  return out
}

export type ChantierDetail = {
  chantier: Chantier
  lines: ContractLine[]
  entries: DoneEntry[]
  reports: SiteReport[]
  progress: Progress
  byLot: ReturnType<typeof progressByLot>
}

export async function getChantier(code: string): Promise<ChantierDetail | null> {
  const { data } = await db.from('chantiers').select(CH_SELECT).eq('code', code).maybeSingle()
  if (!data) return null
  const chantier = shapeChantier(data as unknown as Row)

  const [lines, entries, { data: reportRows }] = await Promise.all([
    getContractLines(chantier.devisId),
    getApprovedEntries(chantier.id),
    db
      .from('site_reports')
      .select(
        'id, chantier_id, report_date, weather, planned, done, blocked, blocked_reason, decision_needed, next_plan, status, review_note'
      )
      .eq('chantier_id', chantier.id)
      .order('report_date', { ascending: false }),
  ])

  const reports: SiteReport[] = []
  for (const r of reportRows ?? []) {
    const { count } = await db
      .from('site_report_photos')
      .select('id', { count: 'exact', head: true })
      .eq('report_id', r.id)
    reports.push({
      id: String(r.id),
      chantierId: String(r.chantier_id),
      reportDate: String(r.report_date),
      weather: (r.weather as string) ?? null,
      planned: (r.planned as string) ?? null,
      done: (r.done as string) ?? null,
      blocked: (r.blocked as string) ?? null,
      blockedReason: (r.blocked_reason as string) ?? null,
      decisionNeeded: (r.decision_needed as string) ?? null,
      nextPlan: (r.next_plan as string) ?? null,
      status: (r.status as ReportStatus) ?? 'draft',
      reviewNote: (r.review_note as string) ?? null,
      photos: count ?? 0,
    })
  }

  return {
    chantier,
    lines,
    entries,
    reports,
    progress: progressOf(lines, entries),
    byLot: progressByLot(lines, entries),
  }
}

/** كمّيات تقرير بعينه — لتعمير النموذج عند التحرير */
export async function getReportEntries(reportId: string): Promise<Map<string, number>> {
  const { data } = await db
    .from('site_report_lines')
    .select('devis_line_id, qty_done')
    .eq('report_id', reportId)
  return new Map((data ?? []).map((r) => [String(r.devis_line_id), Number(r.qty_done ?? 0)]))
}

/** المطالب التي لها عرض — منها تُفتح ورشة */
export async function getContractableRequests(): Promise<
  { requestId: string; ref: string; name: string; devisId: string; devisRef: string }[]
> {
  const { data } = await db
    .from('devis')
    .select('id, ref_code, kind, request_id, housing_requests(ref_code, full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const out: { requestId: string; ref: string; name: string; devisId: string; devisRef: string }[] =
    []
  for (const r of (data ?? []) as unknown as Row[]) {
    const raw = r.housing_requests as Row | Row[] | null
    const req = Array.isArray(raw) ? raw[0] : raw
    out.push({
      requestId: String(r.request_id),
      ref: String(req?.ref_code ?? ''),
      name: String(req?.full_name ?? ''),
      devisId: String(r.id),
      devisRef: String(r.ref_code ?? r.kind ?? ''),
    })
  }
  return out
}
