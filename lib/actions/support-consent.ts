'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { OWNER_COOKIE, readOwnerToken } from '@/lib/owner-session'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n'

export type SupportCaseView = {
  id: string
  consentGiven: boolean
  published: boolean
  titleAr: string
}

/** حالة المساندة المرتبطة بمطلب صاحب الجلسة، إن وُجدت. */
export async function loadOwnSupportCase(requestId: string): Promise<SupportCaseView | null> {
  const { data } = await db
    .from('support_cases')
    .select('id, consent_given, published, title_ar')
    .eq('request_id', requestId)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    consentGiven: Boolean(data.consent_given),
    published: Boolean(data.published),
    titleAr: String(data.title_ar),
  }
}

/**
 * موافقة النشر — من صاحبها لا من الفريق.
 *
 * كانت خانة يؤشّرها المستشار في اللوحة. موافقة على نشر حكاية عائلة
 * تُؤخذ ممّن يعيشها، لا ممّن يكتب عنها: هذا شرط قانوني قبل أن يكون
 * تصميماً.
 *
 * السحب يُنزل النشر معه. موافقة تُسحب وتبقى الحالة معروضة ليست سحباً.
 */
export async function setPublicationConsent(formData: FormData) {
  const id = readOwnerToken((await cookies()).get(OWNER_COOKIE)?.value)
  const rawLocale = String(formData.get('locale') ?? '')
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  if (!id) redirect(`/${locale}/suivi`)

  const give = formData.get('give') === '1'

  // القيد على request_id: لا نثق بمعرّف الحالة القادم من الاستمارة
  const { data: existing } = await db
    .from('support_cases')
    .select('id')
    .eq('request_id', id)
    .maybeSingle()
  if (!existing) redirect(`/${locale}/suivi/modifier`)

  const now = new Date().toISOString()
  const { error } = await db
    .from('support_cases')
    .update(
      give
        ? { consent_given: true, consent_at: now, updated_at: now }
        : { consent_given: false, consent_at: null, published: false, updated_at: now }
    )
    .eq('id', existing.id)

  if (error) {
    console.error('publication consent', error)
    redirect(`/${locale}/suivi/modifier`)
  }

  // خطّ زمن الملفّ: الفريق يلزمو يشوف من أعطى الموافقة ومتى
  await db.from('request_events').insert({
    request_id: id,
    event_type: 'owner_consent',
    note: give ? 'صاحب الحالة أعطى موافقة النشر' : 'صاحب الحالة سحب موافقة النشر — أُلغي النشر',
  })

  redirect(`/${locale}/suivi/modifier?consent=${give ? 'on' : 'off'}`)
}
