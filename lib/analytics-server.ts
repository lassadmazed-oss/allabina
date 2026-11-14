import 'server-only'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/supabase/server'
import {
  EVENTS,
  periodStart,
  type Counted,
  type EventName,
  type PeriodKey,
} from '@/lib/analytics'

/**
 * تسجيل الأحداث وقراءتها.
 *
 * لا مزوّد خارجي: الأحداث تُكتب في قاعدتنا ولا تغادرها — القسم 09:
 * «التحليلات الخارجية لا تستقبل أسماء أو أرقام أو دخل أو وثائق».
 * وأبسط طريقة لضمان ذلك ألّا يوجد خارجيٌّ أصلاً.
 */
const VISITOR_COOKIE = 'allabina_v'

/**
 * معرّف الزائر: رقم عشوائي في كوكي، لا هويّة.
 * يفصل «مئة تقدير» عن «مئة شخص قدّروا» — وهو كلّ ما يفعله.
 */
export async function visitorId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(VISITOR_COOKIE)?.value
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing

  const id = randomUUID()
  try {
    store.set(VISITOR_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 365 * 86400,
    })
  } catch {
    // الكتابة ممنوعة داخل Server Component في بعض المسارات — يبقى القياس
    // ناقصاً لذلك الطلب ولا تسقط الصفحة لأجله
  }
  return id
}

export type EventDims = {
  userId?: string | null
  requestId?: string | null
  govCode?: string | null
  delegationId?: number | null
  projectType?: string | null
  areaBucket?: string | null
  budgetBucket?: string | null
  standing?: string | null
  readiness?: string | null
  meta?: Record<string, unknown> | null
}

/**
 * يسجّل حدثاً ولا يرمي أبداً.
 * قياسٌ يُسقط صفحةً أسوأ من قياسٍ ناقص.
 */
export async function recordEvent(event: EventName, dims: EventDims = {}): Promise<void> {
  try {
    const vid = await visitorId()
    await db.from('analytics_events').insert({
      event,
      visitor_id: vid,
      user_id: dims.userId ?? null,
      request_id: dims.requestId ?? null,
      gov_code: dims.govCode ?? null,
      delegation_id: dims.delegationId ?? null,
      project_type: dims.projectType ?? null,
      area_bucket: dims.areaBucket ?? null,
      budget_bucket: dims.budgetBucket ?? null,
      standing: dims.standing ?? null,
      readiness: dims.readiness ?? null,
      meta: dims.meta ?? null,
    })
  } catch (e) {
    console.warn('analytics', e instanceof Error ? e.message : e)
  }
}

export type Dimension =
  | 'gov_code'
  | 'delegation_id'
  | 'project_type'
  | 'area_bucket'
  | 'budget_bucket'
  | 'standing'
  | 'readiness'

export type Breakdown = { key: string; label: string; count: number }

export type Snapshot = {
  /** عدد الأشخاص الفريدين لكلّ حدث — أساس القُمع */
  people: Counted
  /** عدد الأحداث نفسها — «مئة تقدير» مقابل «مئة شخص» */
  events: Counted
  /** توزيعات على الأبعاد، محسوبة من أحداث الالتزام وحدها */
  breakdowns: Record<Dimension, Breakdown[]>
  /** عدد الأسطر المقروءة — يُعرض حتّى يُعرف إن بلغ السقف */
  rows: number
  capped: boolean
}

/** سقفُ قراءةٍ لا هدف: جدول القياس عندنا بالآلاف لا بالملايين */
const MAX_ROWS = 50_000

const EMPTY_BREAKDOWNS = (): Record<Dimension, Breakdown[]> => ({
  gov_code: [],
  delegation_id: [],
  project_type: [],
  area_bucket: [],
  budget_bucket: [],
  standing: [],
  readiness: [],
})

/**
 * يقرأ أحداث الفترة ويجمعها في الذاكرة.
 *
 * الجمع في Node لا في SQL عمداً: «شخص فريد» هو
 * `coalesce(user_id, visitor_id)` — حسابٌ واحد يُكتب مرّة ويُقرأ، بدل
 * عرضٍ في القاعدة يُؤمَّن ويُراجَع. والحجم يسمح.
 */
export async function snapshot(
  period: PeriodKey,
  stepEventByKey: Record<string, EventName>
): Promise<Snapshot> {
  const from = periodStart(period)
  let q = db
    .from('analytics_events')
    .select(
      'event, visitor_id, user_id, gov_code, delegation_id, project_type, area_bucket, budget_bucket, standing, readiness'
    )
    .order('occurred_at', { ascending: false })
    .limit(MAX_ROWS)
  if (from) q = q.gte('occurred_at', from.toISOString())

  const { data } = await q
  const rows = data ?? []

  const peopleByEvent = new Map<string, Set<string>>()
  const eventCount = new Map<string, number>()
  const dims = EMPTY_BREAKDOWNS()
  const dimMaps: Record<Dimension, Map<string, number>> = {
    gov_code: new Map(),
    delegation_id: new Map(),
    project_type: new Map(),
    area_bucket: new Map(),
    budget_bucket: new Map(),
    standing: new Map(),
    readiness: new Map(),
  }

  for (const r of rows) {
    const ev = String(r.event)
    if (!(EVENTS as readonly string[]).includes(ev)) continue
    const person = String(r.user_id ?? r.visitor_id ?? '')
    if (person) {
      if (!peopleByEvent.has(ev)) peopleByEvent.set(ev, new Set())
      peopleByEvent.get(ev)!.add(person)
    }
    eventCount.set(ev, (eventCount.get(ev) ?? 0) + 1)

    // التوزيعات من أحداث الملفّ لا من التصفّح: «الطلب الاستكشافي لا
    // يساوي طلب شراء»، وتوزيعُ تصفّحٍ على المناطق يضخّم الأقرب لا الأجدّ.
    if (ev === 'review_requested' || ev === 'contract' || ev === 'accepted') {
      for (const d of Object.keys(dimMaps) as Dimension[]) {
        const v = r[d as keyof typeof r]
        if (v === null || v === undefined || v === '') continue
        const k = String(v)
        dimMaps[d].set(k, (dimMaps[d].get(k) ?? 0) + 1)
      }
    }
  }

  for (const d of Object.keys(dimMaps) as Dimension[]) {
    dims[d] = [...dimMaps[d].entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count)
  }

  const people: Counted = {}
  const events: Counted = {}
  for (const [stepKey, ev] of Object.entries(stepEventByKey)) {
    people[stepKey] = peopleByEvent.get(ev)?.size ?? 0
    events[stepKey] = eventCount.get(ev) ?? 0
  }

  return { people, events, breakdowns: dims, rows: rows.length, capped: rows.length >= MAX_ROWS }
}
