import 'server-only'
import { db } from '@/lib/supabase/server'
import {
  progressByLot,
  progressOf,
  type ChantierStatus,
  type LotProgress,
  type Progress,
} from '@/lib/site-reports'
import { getApprovedEntries, getContractLines } from '@/lib/chantiers-server'

/**
 * ما يراه الحريف من ورشته.
 *
 * القسم 07: «لوحة الحريف تعرض الشطر الحالي، المنجز والجاري والمتبقّي،
 * **آخر التقارير المعتمدة** والآجال المتوقّعة».
 *
 * فالترشيح هنا ثلاثي، وكلّه في الاستعلام لا في العرض:
 *   · ورشته هو — عبر مطلبٍ مربوط بحسابه.
 *   · التقارير المعتمَدة وحدها — المسوّدة والمقدَّم لا يخرجان.
 *   · وما يخرج من التقرير ليس كلّه: «اللي تعمل» و«برنامج الغد»
 *     و«ما تعملش بسببه» نعم؛ و«قرار مطلوب من الإدارة» لا — ذاك
 *     نقاشٌ داخلي، والقسم 08 يمنع خروج الملاحظات الداخلية.
 *   · ولا كمّيات ولا أسعار: النسبة تكفي، والتفصيل في العقد.
 */

export type ClientReport = {
  id: string
  reportDate: string
  weather: string | null
  done: string | null
  blocked: string | null
  blockedReason: string | null
  nextPlan: string | null
  photos: { url: string; caption: string | null }[]
}

export type ClientChantier = {
  code: string
  status: ChantierStatus
  statusNote: string | null
  startedAt: string | null
  expectedEnd: string | null
  deliveredAt: string | null
  progress: Progress
  byLot: LotProgress[]
  reports: ClientReport[]
}

const SITE_BUCKET = 'site-photos'

/**
 * ورشة مطلبٍ بعينه، مرشَّحةً لصاحبه.
 * userId يُمرَّر ويُفحص هنا: صفحةٌ تنسى الفحص تعرض ورشة غيره.
 */
export async function getClientChantier(
  requestId: string,
  userId: string,
  reportLimit = 5
): Promise<ClientChantier | null> {
  // الملكية أوّلاً: المطلب لهذا الحساب أو لا شيء
  const { data: req } = await db
    .from('housing_requests')
    .select('id')
    .eq('id', requestId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!req) return null

  const { data: ch } = await db
    .from('chantiers')
    .select('id, code, devis_id, status, status_note, started_at, expected_end, delivered_at')
    .eq('request_id', requestId)
    .maybeSingle()
  if (!ch) return null

  const [lines, entries, { data: reportRows }] = await Promise.all([
    getContractLines((ch.devis_id as string) ?? null),
    getApprovedEntries(String(ch.id)),
    db
      .from('site_reports')
      .select('id, report_date, weather, done, blocked, blocked_reason, next_plan')
      .eq('chantier_id', ch.id)
      .eq('status', 'approved')
      .order('report_date', { ascending: false })
      .limit(reportLimit),
  ])

  const reports: ClientReport[] = []
  for (const r of reportRows ?? []) {
    const { data: photoRows } = await db
      .from('site_report_photos')
      .select('storage_path, caption')
      .eq('report_id', r.id)
      .order('sort_order')

    const paths = (photoRows ?? []).map((p) => String(p.storage_path))
    const signed = paths.length
      ? (await db.storage.from(SITE_BUCKET).createSignedUrls(paths, 3600)).data ?? []
      : []
    const byPath = new Map(signed.map((s) => [String(s.path), s.signedUrl]))

    reports.push({
      id: String(r.id),
      reportDate: String(r.report_date),
      weather: (r.weather as string) ?? null,
      done: (r.done as string) ?? null,
      blocked: (r.blocked as string) ?? null,
      blockedReason: (r.blocked_reason as string) ?? null,
      nextPlan: (r.next_plan as string) ?? null,
      photos: (photoRows ?? [])
        .map((p) => ({
          url: byPath.get(String(p.storage_path)) ?? '',
          caption: (p.caption as string) ?? null,
        }))
        .filter((p) => p.url),
    })
  }

  return {
    code: String(ch.code),
    status: (ch.status as ChantierStatus) ?? 'preparing',
    statusNote: (ch.status_note as string) ?? null,
    startedAt: (ch.started_at as string) ?? null,
    expectedEnd: (ch.expected_end as string) ?? null,
    deliveredAt: (ch.delivered_at as string) ?? null,
    progress: progressOf(lines, entries),
    byLot: progressByLot(lines, entries),
    reports,
  }
}

/** ورشات كلّ مطالب الحساب — للوحة «ملفّاتي» */
export async function getClientChantiers(
  userId: string
): Promise<Map<string, ClientChantier>> {
  const { data: reqs } = await db
    .from('housing_requests')
    .select('id')
    .eq('user_id', userId)
    .limit(20)

  const out = new Map<string, ClientChantier>()
  for (const r of reqs ?? []) {
    const c = await getClientChantier(String(r.id), userId, 1)
    if (c) out.set(String(r.id), c)
  }
  return out
}
