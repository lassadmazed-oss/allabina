import 'server-only'
import { headers } from 'next/headers'
import { db } from '@/lib/supabase/server'
import {
  emptyStats,
  phoneMatches,
  publicStateOf,
  type PublicState,
  type PublicStats,
} from '@/lib/public-state'

/** أعداد مجرّدة للعرض العمومي — بلا أيّ معطى شخصي */
export async function getPublicStats(): Promise<PublicStats> {
  const { data, error } = await db.from('public_request_stats').select('*').maybeSingle()
  if (error || !data) return emptyStats
  return {
    received: Number(data.received ?? 0),
    resolved: Number(data.resolved ?? 0),
    in_progress: Number(data.in_progress ?? 0),
    waiting: Number(data.waiting ?? 0),
    closed: Number(data.closed ?? 0),
  }
}

export type LookupResult =
  | {
      found: true
      refCode: string
      state: PublicState
      update: string | null
      nextStep: string | null
      createdAt: string
      updatedAt: string | null
    }
  | { found: false; reason: 'not_found' | 'rate_limited' | 'no_input' }

// تحديد معدّل الاستعلام: يمنع تجريب الأرقام واحداً واحداً
const attempts = new Map<string, number[]>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_LOOKUPS = 20

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  attempts.set(key, hits)
  return hits.length > MAX_LOOKUPS
}

/**
 * البحث عن ملفّ برمز المطلب **ورقم الهاتف معاً**.
 *
 * الرمز وحده لا يكفي: الرموز متسلسلة (LB-2026-000012) فيمكن تجريبها واحداً واحداً.
 * والهاتف وحده لا يكفي: من يعرف رقم شخص يطّلع على وضعية ملفّه. اشتراط الاثنين
 * يجعل الاطّلاع حكراً على صاحب الملفّ.
 *
 * لا يرجع أبداً اسماً ولا هاتفاً ولا مبلغاً — الحالة والتحيين والمرحلة القادمة فقط.
 */
export async function lookupRequest(input: {
  ref?: string
  phone?: string
}): Promise<LookupResult> {
  const ref = (input.ref ?? '').trim().toUpperCase()
  const phone = (input.phone ?? '').trim()
  if (!ref || !phone) return { found: false, reason: 'no_input' }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip)) return { found: false, reason: 'rate_limited' }

  const columns = 'ref_code, status, public_update, public_next_step, created_at, public_updated_at, updated_at, phone'

  type Row = {
    ref_code: string
    status: string
    public_update: string | null
    public_next_step: string | null
    created_at: string
    public_updated_at: string | null
    updated_at: string
    phone: string
  }

  const { data } = await db.from('housing_requests').select(columns).eq('ref_code', ref).maybeSingle()
  const row = data as Row | null

  // الرمز موجود لكن الهاتف لا يطابق: نفس الجواب حتى لا يكشف وجود الملفّ
  if (row && !phoneMatches(row.phone, phone)) return { found: false, reason: 'not_found' }

  if (!row) return { found: false, reason: 'not_found' }

  return {
    found: true,
    refCode: row.ref_code,
    state: publicStateOf(row.status),
    update: row.public_update,
    nextStep: row.public_next_step,
    createdAt: row.created_at,
    updatedAt: row.public_updated_at ?? row.updated_at,
  }
}
