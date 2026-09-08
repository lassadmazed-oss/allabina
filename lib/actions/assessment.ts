'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import {
  ALGO_VERSION,
  CRITERIA,
  DECISIONS,
  DECISION_AR,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  assess,
  decisionProblem,
  normalizeWeights,
  type Decision,
  type Scores,
  type Thresholds,
  type Verification,
  type Weights,
} from '@/lib/support-assessment'

export type AssessmentState = { ok: boolean; error?: string }

/** الأوزان والحدود من الإعدادات — الفريق يعدّلها بلا مطوّر */
export async function loadAssessmentConfig(): Promise<{ weights: Weights; thresholds: Thresholds }> {
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['support.assessment_weights', 'support.band_thresholds'])
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]))
  const w = map.get('support.assessment_weights') as Partial<Weights> | undefined
  const t = map.get('support.band_thresholds') as Partial<Thresholds> | undefined
  return {
    weights: normalizeWeights(w ?? DEFAULT_WEIGHTS),
    thresholds: { ...DEFAULT_THRESHOLDS, ...(t ?? {}) },
  }
}

/**
 * حفظ دراسة طلب المساندة: الدرجات، التثبّت، القرار.
 * المجموع والفئة يُحسبان هنا لا في المتصفّح، ويُسجَّل كلّ قرار في سجلّ الأثر.
 */
export async function saveSupportAssessmentAction(
  _prev: AssessmentState,
  formData: FormData
): Promise<AssessmentState> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'غير مصرّح' }

  const requestId = String(formData.get('request_id') ?? '').trim()
  if (!requestId) return { ok: false, error: 'مطلب غير معرّف' }

  const scores = {} as Scores
  for (const c of CRITERIA) scores[c] = Number(formData.get(`score_${c}`) ?? 0) || 0

  const flag = (k: string) => formData.get(k) === 'on'
  const verification: Verification = {
    phone_verified: flag('phone_verified'),
    documents_checked: flag('documents_checked'),
    home_visit_done: flag('home_visit_done'),
    third_party_confirmed: flag('third_party_confirmed'),
    inconsistencies_found: flag('inconsistencies_found'),
  }

  const decisionRaw = String(formData.get('decision') ?? 'pending')
  const decision = (DECISIONS as readonly string[]).includes(decisionRaw)
    ? (decisionRaw as Decision)
    : 'pending'
  const reason = String(formData.get('decision_reason') ?? '').trim() || null
  const problem = decisionProblem(decision, reason)
  if (problem) return { ok: false, error: problem }

  const { weights, thresholds } = await loadAssessmentConfig()
  const result = assess(scores, verification, weights, thresholds)

  const { data: before } = await db
    .from('support_assessments')
    .select('decision, band')
    .eq('request_id', requestId)
    .maybeSingle()

  const decided = decision !== 'pending'
  const { error } = await db.from('support_assessments').upsert(
    {
      request_id: requestId,
      ...scores,
      ...verification,
      verification_note: String(formData.get('verification_note') ?? '').trim() || null,
      total: result.total,
      band: result.band,
      algo_version: ALGO_VERSION,
      decision,
      decision_reason: reason,
      decided_by: decided ? actor.userId : null,
      decided_at: decided ? new Date().toISOString() : null,
      assessed_by: actor.userId,
    },
    { onConflict: 'request_id' }
  )
  if (error) {
    console.error('save assessment', error)
    return { ok: false, error: 'تعذّر الحفظ — عاود المحاولة' }
  }

  // الأثر: الدرجة والفئة دائماً، والقرار كي يتغيّر
  const parts = [`دراسة المساندة: ${result.total}/100 — ${result.band}`]
  if (result.capped && result.capReason) parts.push(`(حاجز: ${result.capReason})`)
  if (before?.decision !== decision) parts.push(`القرار: ${DECISION_AR[decision]}${reason ? ` — ${reason}` : ''}`)
  await db.from('request_events').insert({
    request_id: requestId,
    event_type: 'note',
    actor: actor.userId,
    note: parts.join(' · '),
  })

  // القبول في مسار المساندة يفتح حالة (غير منشورة، بلا موافقة بعدُ) حتى يبدأ دفتر الشفافية
  if (decision === 'accept_support') {
    const { data: r } = await db
      .from('housing_requests')
      .select('gov_code, delegation_id, problem_note')
      .eq('id', requestId)
      .maybeSingle()
    if (r) {
      await db.from('support_cases').upsert(
        {
          request_id: requestId,
          title_ar: 'حالة تحتاج مساندة — بانتظار الصياغة',
          summary_ar: (r.problem_note as string | null)?.slice(0, 400) || 'يُصاغ الملخّص بعد المكالمة.',
          gov_code: r.gov_code,
          delegation_id: r.delegation_id,
          consent_given: false,
          published: false,
          anonymised: true,
          created_by: actor.userId,
        },
        { onConflict: 'request_id', ignoreDuplicates: true }
      )
    }
  }

  revalidatePath(`/admin/${requestId}`)
  revalidatePath('/admin/support')
  return { ok: true }
}
