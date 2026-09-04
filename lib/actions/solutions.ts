'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'

/** Module 2 — تصنيف الدراسة مع سببه */
export async function updateStudyTrackAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const track = String(formData.get('study_track') ?? '').trim()
  const reason = String(formData.get('track_reason') ?? '').trim()

  const { error } = await db
    .from('housing_requests')
    .update({ study_track: track || null, track_reason: reason || null })
    .eq('id', id)

  if (error) {
    console.error('update study track', error)
    return
  }

  await db.from('request_events').insert({
    request_id: id,
    event_type: 'note',
    actor: actor.userId,
    note: track ? `تصنيف الدراسة: ${track}${reason ? ` — ${reason}` : ''}` : 'أُلغي تصنيف الدراسة',
  })

  revalidatePath(`/admin/${id}`)
  revalidatePath('/admin')
}

/** Module 7 — مؤشّرات الحالة الاجتماعية. الأولوية قرار إنسان لا حساب آلي. */
export async function updateSocialAssessmentAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const priority = formData.get('is_priority') === 'on'

  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v ? Number(v) : null
  }
  const str = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v || null
  }

  const { error } = await db.from('social_assessments').upsert(
    {
      request_id: id,
      household_size: num('household_size'),
      dependents: num('dependents'),
      has_disability: formData.get('has_disability') === 'on',
      housing_condition: str('housing_condition'),
      income_stability: str('income_stability'),
      notes: str('notes'),
      is_priority: priority,
      decided_by: actor.userId,
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'request_id' }
  )

  if (error) {
    console.error('social assessment', error)
    return
  }

  revalidatePath(`/admin/${id}`)
}

/** Module 7 — عنصر من عناصر الحلّ: أرض، تمويل، مواد، يد عاملة… */
export async function addContributionAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return

  const partner = String(formData.get('partner_id') ?? '').trim()
  const value = String(formData.get('value_tnd') ?? '').trim()

  const { error } = await db.from('contributions').insert({
    request_id: id,
    partner_id: partner || null,
    kind: String(formData.get('kind') ?? 'other'),
    label,
    value_tnd: value ? Number(value) : null,
    status: 'proposed',
  })

  if (error) console.error('add contribution', error)
  revalidatePath(`/admin/${id}`)
}

export async function updateContributionAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id'))
  const { error } = await db
    .from('contributions')
    .update({ status: String(formData.get('status') ?? 'proposed') })
    .eq('id', String(formData.get('contribution_id')))

  if (error) console.error('update contribution', error)
  revalidatePath(`/admin/${requestId}`)
}

/** Module 8 — مهمّة مُسنَدة لشريك أو لعضو فريق */
export async function addTaskAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('id'))
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return

  const partner = String(formData.get('partner_id') ?? '').trim()
  const assigned = String(formData.get('assigned_to') ?? '').trim()
  const due = String(formData.get('due_at') ?? '').trim()

  const { error } = await db.from('tasks').insert({
    request_id: id,
    title,
    detail: String(formData.get('detail') ?? '').trim() || null,
    partner_id: partner || null,
    assigned_to: assigned || null,
    due_at: due || null,
  })

  if (error) console.error('add task', error)
  revalidatePath(`/admin/${id}`)
}

export async function updateTaskAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id'))
  const status = String(formData.get('status') ?? 'todo')

  const { error } = await db
    .from('tasks')
    .update({ status, done_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', String(formData.get('task_id')))

  if (error) console.error('update task', error)
  revalidatePath(`/admin/${requestId}`)
}

/** Module 8 — إدارة الشركاء */
export async function upsertPartnerAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return

  const id = String(formData.get('partner_id') ?? '').trim()
  const payload = {
    name: String(formData.get('name') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'other'),
    contact_name: String(formData.get('contact_name') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    is_active: formData.get('is_active') !== 'off',
  }
  if (!payload.name) return

  const { error } = id
    ? await db.from('partners').update(payload).eq('id', id)
    : await db.from('partners').insert(payload)

  if (error) console.error('upsert partner', error)
  revalidatePath('/admin/partners')
}

/**
 * Module 9 — حالة منجزة.
 * النشر ممنوع بلا موافقة: قيد في قاعدة البيانات نفسها يحرس هذا،
 * وهنا نمنعه قبل أن يصل إليها.
 */
export async function upsertCaseStudyAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const id = String(formData.get('case_id') ?? '').trim()
  const consent = formData.get('consent_given') === 'on'
  const wantsPublish = formData.get('published') === 'on'

  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim()
    return v ? Number(v) : null
  }
  const str = (k: string) => String(formData.get(k) ?? '').trim() || null

  const payload = {
    request_id: String(formData.get('request_id') ?? '').trim() || null,
    title_ar: String(formData.get('title_ar') ?? '').trim(),
    title_fr: str('title_fr'),
    problem_ar: String(formData.get('problem_ar') ?? '').trim(),
    problem_fr: str('problem_fr'),
    solution_ar: String(formData.get('solution_ar') ?? '').trim(),
    solution_fr: str('solution_fr'),
    result_ar: str('result_ar'),
    result_fr: str('result_fr'),
    kind: String(formData.get('kind') ?? 'other'),
    gov_code: String(formData.get('gov_code') ?? 'SFX'),
    delegation_id: num('delegation_id'),
    area_m2: num('area_m2'),
    duration_months: num('duration_months'),
    completed_at: str('completed_at'),
    photo_before: str('photo_before'),
    photo_after: str('photo_after'),
    video_url: str('video_url'),
    anonymised: formData.get('anonymised') !== 'off',
    consent_given: consent,
    consent_at: consent ? new Date().toISOString() : null,
    // لا نشر بلا موافقة — مهما جاء من النموذج
    published: consent && wantsPublish,
    created_by: actor.userId,
  }

  if (!payload.title_ar || !payload.problem_ar || !payload.solution_ar) return

  const { error } = id
    ? await db.from('case_studies').update(payload).eq('id', id)
    : await db.from('case_studies').insert(payload)

  if (error) {
    console.error('upsert case study', error)
    return
  }

  revalidatePath('/admin/cases')
  revalidatePath('/ar/realisations')
  revalidatePath('/fr/realisations')
}
