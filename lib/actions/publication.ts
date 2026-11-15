'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/server'
import { staffWithPermission } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-session'
import { canPublish, looksPrivate } from '@/lib/publication'

/**
 * موافقتا النشر.
 *
 * الحريف يملك قصّته، والشركة تملك ما يُنشر باسمها — فموافقتان لا
 * واحدة. وكلّ فعلٍ هنا يفحص صاحبه: الحريف على ورشته هو، والإدارة
 * بصلاحيتها.
 *
 * وسحب أيّ موافقة يُنزل المنشور في نفس الكتابة، لا في مهمّةٍ لاحقة:
 * القاعدة ترفض سطراً منشوراً بلا موافقتين، فتركُه للذاكرة يوقف
 * الكتابة كلّها.
 */
function refresh(code?: string, ref?: string) {
  revalidatePath('/admin/approbations')
  if (code) revalidatePath(`/admin/chantiers/${code}`)
  for (const l of ['ar', 'fr']) {
    revalidatePath(`/${l}/chantiers`)
    revalidatePath(`/${l}/compte`)
    if (ref) revalidatePath(`/${l}/compte/chantier/${ref}`)
  }
}

/** موافقة الحريف — على ورشته هو وحدها */
export async function setClientConsentAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  const ref = String(formData.get('ref') ?? '').trim()
  const give = formData.get('consent') === '1'
  if (!ref) return

  const { data: request } = await db
    .from('housing_requests')
    .select('id')
    .eq('ref_code', ref)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!request) return

  const { data: ch } = await db
    .from('chantiers')
    .select('id, code, publish_approved_at')
    .eq('request_id', request.id)
    .maybeSingle()
  if (!ch) return

  const next = {
    client_consent_at: give ? new Date().toISOString() : null,
    client_consent_by: give ? user.id : null,
    // السحب يُنزل المنشور في نفس الكتابة — القيد يرفض غير ذلك
    is_public: give
      ? canPublish({
          clientAt: 'now',
          directionAt: (ch.publish_approved_at as string) ?? null,
          isPublic: false,
        })
      : false,
  }
  const { error } = await db.from('chantiers').update(next).eq('id', ch.id)
  if (error) console.error('client consent', error.message)
  refresh(String(ch.code), ref)
}

/** اعتماد الإدارة — ومعه النصّ العمومي */
export async function setDirectionPublishAction(formData: FormData) {
  const actor = await staffWithPermission('docs.approve')
  if (!actor) return
  const code = String(formData.get('code') ?? '').trim()
  const approve = formData.get('approve') === '1'
  const title = String(formData.get('public_title') ?? '').trim().slice(0, 120) || null
  const summary = String(formData.get('public_summary') ?? '').trim().slice(0, 600) || null
  if (!code) return

  /*
   * نصّ فيه رقم هاتف أو بريد لا يُعتمد: من يكتب الملخّص قد يضعهما سهواً.
   *
   * والرفض كان صامتاً ويأكل ما كُتب: المسؤول يضغط، الصفحة ترجع كما هي
   * بخانتين فارغتين، فلا يعرف السبب ولا يستردّ نصّه. فالآن يُحفظ النصّ
   * مسوّدةً — ولا يبلغ أحداً، لأنّ is_public يبقى خطأً والصفحة العمومية
   * تقرأه وحده — وتقول الصفحة السبب بفحص المسوّدة نفسها.
   */
  if (approve && ((title && looksPrivate(title)) || (summary && looksPrivate(summary)))) {
    const { error } = await db
      .from('chantiers')
      .update({ public_title: title, public_summary: summary })
      .eq('code', code)
    if (error) console.error('publish draft', error.message)
    return refresh(code)
  }

  const { data: ch } = await db
    .from('chantiers')
    .select('id, client_consent_at')
    .eq('code', code)
    .maybeSingle()
  if (!ch) return

  await db
    .from('chantiers')
    .update({
      publish_approved_at: approve ? new Date().toISOString() : null,
      publish_approved_by: approve ? actor.userId : null,
      public_title: title,
      public_summary: summary,
      is_public: approve
        ? canPublish({
            clientAt: (ch.client_consent_at as string) ?? null,
            directionAt: 'now',
            isPublic: false,
          })
        : false,
    })
    .eq('id', ch.id)

  await db
    .from('staff_events')
    .insert({
      actor: actor.userId,
      event_type: 'settings.update',
      detail: { key: 'chantier.publish', code, approve },
    })
    .then(({ error: e }) => e && console.warn('staff_events', e.message))

  refresh(code)
}
