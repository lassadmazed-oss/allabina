'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { TRACK_SEGMENTS, parseHidden, type TrackSegment } from '@/lib/site-tracks'

export type SettingsState = { ok: boolean; error?: string }



/** قنوات اتّصال المنصّة التي تظهر في الذيل وصفحات الشكر — فارغة = لا تُعرض */
export async function saveContactSettingsAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const str = (k: string) => String(formData.get(k) ?? '').trim().slice(0, 120)
  const rows = [
    { key: 'contact.phone', value: str('phone') },
    { key: 'contact.whatsapp', value: str('whatsapp').replace(/[^\d+]/g, '') },
    { key: 'contact.email', value: str('email') },
    { key: 'contact.hours', value: str('hours') },
  ]
  const { error } = await db.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) console.error('save contact settings', error)
  revalidatePath('/admin/reference')
  revalidateSite()
}

/**
 * الهويّة القانونية للشركة — تظهر في ذيل كلّ صفحة وفي «المعطيات القانونية».
 *
 * الخانة الفارغة تُحفظ فارغة ولا تُعرض: شركة بمعطى ناقص أحسن من شركة
 * بمعطى مخترع. ورأس المال رقم لا نصّ حتّى يُنسَّق حسب اللغة.
 */
export async function saveLegalSettingsAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const str = (k: string, max = 200) => String(formData.get(k) ?? '').trim().slice(0, max)
  const capitalRaw = str('capital_tnd', 20).replace(/[^\d.]/g, '')
  const capital = capitalRaw ? Number(capitalRaw) : null

  const rows = [
    { key: 'legal.name_ar', value: str('name_ar') },
    { key: 'legal.name_fr', value: str('name_fr') },
    { key: 'legal.form_ar', value: str('form_ar', 80) },
    { key: 'legal.form_fr', value: str('form_fr', 80) },
    { key: 'legal.unique_id', value: str('unique_id', 40) },
    { key: 'legal.register_no', value: str('register_no', 40) },
    { key: 'legal.capital_tnd', value: Number.isFinite(capital) ? capital : null },
    { key: 'legal.activity_code', value: str('activity_code', 20) },
    { key: 'legal.activity_ar', value: str('activity_ar') },
    { key: 'legal.activity_fr', value: str('activity_fr') },
    { key: 'legal.address_ar', value: str('address_ar', 300) },
    { key: 'legal.address_fr', value: str('address_fr', 300) },
    { key: 'legal.published_on', value: str('published_on', 10) },
    { key: 'legal.activity_since', value: str('activity_since', 10) },
    { key: 'legal.manager_ar', value: str('manager_ar', 120) },
    { key: 'legal.manager_fr', value: str('manager_fr', 120) },
    { key: 'legal.rne_verify_url', value: str('rne_verify_url', 200) },
  ]
  const { error } = await db.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) {
    console.error('save legal settings', error)
    return
  }
  await db
    .from('staff_events')
    .insert({ actor: actor.userId, event_type: 'settings.update', detail: { key: 'legal' } })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  revalidatePath('/admin/reference')
  revalidateSite()
}

/** الذيل يظهر في كلّ صفحة، فتبديل رقم أو عنوان يستوجب تحيين الموقع كلّه */
function revalidateSite() {
  revalidatePath('/[locale]', 'layout')
  for (const l of ['ar', 'fr']) {
    revalidatePath(`/${l}/mentions-legales`)
    revalidatePath(`/${l}/reseau/merci`)
  }
}

/**
 * شروط تقديرية لبنك: نسبة، أقصى مدّة، أقصى نسبة تمويل، ومصدرها.
 * خانة فارغة = «لا نعرف» — لا صفر. ما يُحفظ هنا يدخل تقدير الاستمارة
 * والمحاكي لكلّ من يختار البنك، ويُسجَّل في سجلّ الفريق.
 */
export async function saveBankTermsAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const code = String(formData.get('code') ?? '')
  if (!/^[a-z0-9_]{2,20}$/.test(code)) return

  const num = (k: string, min: number, max: number) => {
    const raw = String(formData.get(k) ?? '').trim().replace(',', '.')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= min && n <= max ? n : null
  }
  const years = num('max_years', 1, 30)
  const date = String(formData.get('verified_at') ?? '').trim()
  const row = {
    indicative_rate_pct: num('rate', 0, 30),
    max_years: years == null ? null : Math.round(years),
    max_share_pct: num('max_share', 0, 100),
    terms_source: String(formData.get('source') ?? '').trim().slice(0, 300) || null,
    terms_verified_at: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    is_active: formData.get('active') === 'on',
    updated_by: actor.userId,
    updated_at: new Date().toISOString(),
  }

  const { error } = await db.from('banks').update(row).eq('code', code)
  if (error) {
    console.error('save bank terms', error)
    return
  }
  await db
    .from('staff_events')
    .insert({ actor: actor.userId, event_type: 'settings.update', detail: { key: 'banks', code, ...row } })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  revalidatePath('/admin/reference')
  for (const p of ['/ar/demande', '/fr/demande', '/ar/projet', '/fr/projet']) revalidatePath(p)
}

/**
 * تخبئة مسار من الموقع العمومي أو إرجاعه.
 *
 * قرار «شنوّة يشوف الزائر» قرار صاحب الشركة، يُقلب من هنا بلا نشر.
 * والمخبّأ يردّ 404 ويخرج من القائمة ومن خريطة الموقع — لا يُخفى من
 * القائمة ويبقى يفتح لمن يعرف العنوان.
 */
export async function setTrackHiddenAction(formData: FormData) {
  const actor = await staffWithPermission('reference.manage')
  if (!actor) return
  const segment = String(formData.get('segment') ?? '')
  const hide = formData.get('hide') === '1'
  if (!TRACK_SEGMENTS.includes(segment as TrackSegment)) return

  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'site.hidden_paths')
    .maybeSingle()
  const current = new Set(parseHidden(data?.value))
  if (hide) current.add(segment as TrackSegment)
  else current.delete(segment as TrackSegment)

  await db
    .from('app_settings')
    .upsert(
      [
        {
          key: 'site.hidden_paths',
          value: [...current],
          description:
            'مسارات الموقع العمومي المخبّأة. القيم الممكنة: standing · systemes.',
        },
      ],
      { onConflict: 'key' }
    )
    .then(({ error }) => error && console.error('hidden paths', error.message))

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'site.hidden_paths', segment, hide },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  revalidatePath('/admin/reference')
  revalidatePath('/', 'layout')
}
