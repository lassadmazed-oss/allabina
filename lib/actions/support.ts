'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { isPublicPledgeKind } from '@/lib/support'

/** إنشاء أو تحيين حالة تحتاج مساندة — النشر ممنوع بلا موافقة */
export async function upsertSupportCaseAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id'))
  const consent = formData.get('consent_given') === 'on'
  const wantsPublish = formData.get('published') === 'on'
  const str = (k: string) => String(formData.get(k) ?? '').trim() || null

  const title = String(formData.get('title_ar') ?? '').trim()
  const summary = String(formData.get('summary_ar') ?? '').trim()
  if (!title || !summary) return

  const { error } = await db.from('support_cases').upsert(
    {
      request_id: requestId,
      title_ar: title,
      title_fr: str('title_fr'),
      summary_ar: summary,
      summary_fr: str('summary_fr'),
      gov_code: String(formData.get('gov_code') ?? 'SFX'),
      delegation_id: str('delegation_id') ? Number(formData.get('delegation_id')) : null,
      consent_given: consent,
      consent_at: consent ? new Date().toISOString() : null,
      anonymised: formData.get('anonymised') !== 'off',
      // لا نشر بلا موافقة — مهما جاء من النموذج
      published: consent && wantsPublish,
      created_by: actor.userId,
    },
    { onConflict: 'request_id' }
  )

  if (error) {
    console.error('upsert support case', error)
    return
  }

  revalidatePath('/admin/support')
  revalidatePath(`/admin/${requestId}`)
  revalidatePath('/ar/soutien')
  revalidatePath('/fr/soutien')
}

/** قيد جديد في دفتر الشفافية — لا تعديل ولا حذف، التصحيح بقيد جديد */
export async function addLedgerEntryAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const requestId = String(formData.get('request_id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return

  const value = String(formData.get('value_tnd') ?? '').trim()
  const partner = String(formData.get('partner_id') ?? '').trim()

  const { error } = await db.from('support_ledger').insert({
    request_id: requestId,
    contribution_id: String(formData.get('contribution_id') ?? '').trim() || null,
    need_id: String(formData.get('need_id') ?? '').trim()
      ? Number(formData.get('need_id'))
      : null,
    event: String(formData.get('event') ?? 'needed'),
    label,
    kind: String(formData.get('kind') ?? '').trim() || null,
    quantity_note: String(formData.get('quantity_note') ?? '').trim() || null,
    value_tnd: value ? Number(value) : null,
    partner_id: partner || null,
    partner_public: String(formData.get('partner_public') ?? '').trim() || null,
    note: String(formData.get('note') ?? '').trim() || null,
    actor: actor.userId,
    occurred_at: String(formData.get('occurred_at') ?? '').trim() || undefined,
  })

  if (error) console.error('ledger entry', error)

  revalidatePath(`/admin/${requestId}`)
  revalidatePath('/admin/support')
  revalidatePath('/ar/soutien')
  revalidatePath('/fr/soutien')
}

export type PledgeState = { ok: boolean; error?: 'banner' | 'rateLimited' | 'server' }

const recent = new Map<string, number[]>()
function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 60 * 60 * 1000)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > 5
}

/**
 * تعهّد عيني من العموم — مواد أو يد عاملة أو دراسة أو نقل.
 * لا مبالغ ولا وسيلة دفع: المنصة لا تجمع أموالاً.
 */
export async function submitPledgeAction(
  _prev: PledgeState,
  formData: FormData
): Promise<PledgeState> {
  if ((formData.get('website') as string)?.length) return { ok: false, error: 'server' }

  const name = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').replace(/[\s-]/g, '')
  const label = String(formData.get('label') ?? '').trim()
  const kind = String(formData.get('kind') ?? '').trim()
  const consent = formData.get('consent') === 'on'

  // عيني فقط: القاعدة ترفض 'funding' بقيد، ونرفضه هنا برسالة مفهومة
  if (
    name.length < 3 ||
    !/^\+?\d{8,15}$/.test(phone) ||
    !label ||
    !isPublicPledgeKind(kind) ||
    !consent
  ) {
    return { ok: false, error: 'banner' }
  }

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip) || rateLimited(phone)) return { ok: false, error: 'rateLimited' }

  const caseId = String(formData.get('support_case_id') ?? '').trim()
  const { error } = await db.from('support_pledges').insert({
    support_case_id: caseId || null,
    full_name: name,
    phone,
    email: String(formData.get('email') ?? '').trim() || null,
    kind,
    label,
    note: String(formData.get('note') ?? '').trim() || null,
    consent_at: new Date().toISOString(),
  })

  if (error) {
    console.error('pledge', error)
    return { ok: false, error: 'server' }
  }

  revalidatePath('/admin/support')
  return { ok: true }
}

/** متابعة تعهّد: اتصلنا · قبلناه · اعتذرنا */
export async function updatePledgeAction(formData: FormData) {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return

  const { error } = await db
    .from('support_pledges')
    .update({ status: String(formData.get('status') ?? 'new'), handled_by: actor.userId })
    .eq('id', String(formData.get('pledge_id')))

  if (error) console.error('update pledge', error)
  revalidatePath('/admin/support')
}
