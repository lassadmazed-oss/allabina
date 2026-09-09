'use server'

import { redirect } from 'next/navigation'
import { attachVoiceNotes } from '@/lib/actions/voice-note'
import { after } from 'next/server'
import { sendNetworkConfirmation } from '@/lib/sms/winsms'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { savedRedirect } from '@/lib/actions/saved'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { intervenantSchema } from '@/lib/network-schema'
import { canTransition, isAvailability, isStatus, type IntervenantStatus } from '@/lib/network'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'

export type NetworkState = {
  ok: boolean
  error?: 'banner' | 'rateLimited' | 'duplicate' | 'server'
  fields?: string[]
}

const recent = new Map<string, number[]>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 6

function rateLimited(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recent.set(key, hits)
  return hits.length > MAX_PER_WINDOW
}

/**
 * الانضمام إلى الشبكة — استمارة عمومية.
 *
 * الملفّ يدخل بحالة `new` ولا يظهر في أيّ مطابقة قبل قرار بشري. المتصفّح
 * لا يكتب في القاعدة: الإدراج يمرّ من هنا بالمفتاح السرّي بعد التحقّق.
 */
export async function joinNetwork(
  _prev: NetworkState,
  formData: FormData
): Promise<NetworkState> {
  // مصيدة الروبوتات: خانة مخفيّة لا يعمّرها إنسان
  if ((formData.get('website') as string)?.length) return { ok: false, error: 'server' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = intervenantSchema.safeParse({
    ...raw,
    extraCategoryIds: formData.getAll('extraCategoryIds'),
    skillIds: formData.getAll('skillIds'),
    zoneDelegationIds: formData.getAll('zoneDelegationIds'),
    consent: raw.consent === 'on',
  })

  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? '')))].filter(
      Boolean
    )
    console.error('intervenant validation failed:', fields.join(', '))
    return { ok: false, error: 'banner', fields }
  }

  const d = parsed.data
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'local'
  if (rateLimited(ip) || rateLimited(d.phone)) return { ok: false, error: 'rateLimited' }

  // نفس الهاتف ونفس الاختصاص = نفس الشخص يعاود التسجيل
  const { data: existing } = await db
    .from('intervenants')
    .select('id')
    .eq('phone', d.phone)
    .eq('category_id', d.categoryId)
    .maybeSingle()
  if (existing) return { ok: false, error: 'duplicate' }

  const { data: inserted, error } = await db
    .from('intervenants')
    .insert({
      full_name: d.fullName,
      company_name: d.companyName || null,
      phone: d.phone,
      whatsapp: d.whatsapp || null,
      email: d.email || null,
      category_id: d.categoryId,
      legal_status: d.legalStatus,
      years_experience: d.yearsExperience,
      bio: d.bio || null,
      gov_code: d.govCode,
      delegation_id: d.delegationId,
      zone_id: d.zoneId,
      address: d.address || null,
      radius_km: d.radiusKm,
      availability: d.availability,
      available_from: d.availableFrom,
      status: 'new',
      source: 'public_form',
      lang: isLocale(String(formData.get('locale') ?? '')) ? String(formData.get('locale')) : DEFAULT_LOCALE,
    })
    // علاقتان بين المتدخّل والاختصاصات (الرئيسي والإضافية): نسمّي المفتاح صراحةً
    .select('id, ref_code, intervenant_categories!intervenants_category_id_fkey(name_ar, name_fr)')
    .single()

  if (error || !inserted) {
    console.error('insert intervenant', error)
    return { ok: false, error: 'server' }
  }

  const id = inserted.id

  // التسجيل الصوتي: رُفع إلى المسوّدة قبل وجود السطر، فيُنقل إليه الآن.
  // لا يوقف شيئاً إن فشل — الملفّ محفوظ، والصوت خدمة فوقه.
  const voiceToken = String(formData.get('voiceBio') ?? '')
  if (voiceToken) {
    await attachVoiceNotes('intervenant', String(id), voiceToken, 'bio')
  }

  // الروابط المتعدّدة — فشلها لا يُسقط التسجيل، الملفّ الأساسي محفوظ
  const links: PromiseLike<unknown>[] = []
  if (d.skillIds.length) {
    links.push(
      db.from('intervenant_skills').insert(d.skillIds.map((skill_id) => ({ intervenant_id: id, skill_id })))
    )
  }
  if (d.extraCategoryIds.length) {
    links.push(
      db.from('intervenant_extra_categories').insert(
        d.extraCategoryIds
          .filter((c) => c !== d.categoryId)
          .map((category_id) => ({ intervenant_id: id, category_id }))
      )
    )
  }
  if (d.zoneDelegationIds.length) {
    links.push(
      db.from('intervenant_zones').insert(
        d.zoneDelegationIds.map((delegation_id) => ({ intervenant_id: id, delegation_id }))
      )
    )
  }
  const results = await Promise.allSettled(links)
  for (const r of results) if (r.status === 'rejected') console.error('intervenant links', r.reason)

  const locale = String(formData.get('locale') ?? '')
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE

  // الرمز على الهاتف مع اختصاصه — بعد الردّ، والفشل يُسجَّل ولا يمسّ التسجيل
  const refCode = String(inserted.ref_code)
  const catRow = (inserted as unknown as { intervenant_categories: { name_ar: string; name_fr: string | null } | null }).intervenant_categories
  const catName = catRow ? (l === 'fr' ? catRow.name_fr || catRow.name_ar : catRow.name_ar) : null
  after(() => sendNetworkConfirmation(String(id), refCode, catName, d.phone, l))

  redirect(`/${l}/reseau/merci?ref=${refCode}`)
}

/* ---------- الـBack-office ---------- */

/** تغيير حالة الملفّ في مسار الاعتماد — مع من قرّر ومتى ولماذا */
export async function setIntervenantStatusAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return

  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('status') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  if (!isStatus(to) || !id) return

  const { data: before } = await db
    .from('intervenants')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (!before || !isStatus(before.status)) return

  const from = before.status as IntervenantStatus
  if (from === to || !canTransition(from, to)) return

  const patch: Record<string, unknown> = { status: to, status_note: note || null }
  if (to === 'validated') {
    patch.validated_at = new Date().toISOString()
    patch.validated_by = actor.userId
  }

  const { error } = await db.from('intervenants').update(patch).eq('id', id)
  if (error) {
    console.error('intervenant status', error)
    return
  }

  await db.from('intervenant_events').insert({
    intervenant_id: id,
    event_type: 'status_change',
    from_status: from,
    to_status: to,
    actor: actor.userId,
    note: note || null,
  })

  revalidatePath('/admin/reseau')
  revalidatePath(`/admin/reseau/${id}`)
  await savedRedirect('net_status')
}

/** ملاحظة داخلية على الملفّ */
export async function addIntervenantNoteAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return

  const id = String(formData.get('id') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  if (!id || !note) return

  await db.from('intervenant_events').insert({
    intervenant_id: id,
    event_type: 'note',
    actor: actor.userId,
    note,
  })

  revalidatePath('/admin/reseau')
  revalidatePath(`/admin/reseau/${id}`)
  await savedRedirect('note')
}

/** تحديث التوفّر من طرف الفريق (المتدخّل يحدّثه بنفسه لاحقاً من لوحته) */
export async function setAvailabilityAction(formData: FormData) {
  const actor = await staffWithPermission('network.manage')
  if (!actor) return

  const id = String(formData.get('id') ?? '')
  const availability = String(formData.get('availability') ?? '')
  const availableFrom = String(formData.get('available_from') ?? '').trim()
  if (!id || !isAvailability(availability)) return

  await db
    .from('intervenants')
    .update({
      availability,
      available_from: availability === 'available_from' && availableFrom ? availableFrom : null,
    })
    .eq('id', id)

  revalidatePath('/admin/reseau')
  revalidatePath(`/admin/reseau/${id}`)
  await savedRedirect('availability')
}
