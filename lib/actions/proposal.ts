'use server'

import { revalidatePath } from 'next/cache'
import { staffWithPermission } from '@/lib/auth'
import { db } from '@/lib/supabase/server'
import { sendProposalNotice, type SmsOutcome } from '@/lib/sms/winsms'
import { PROPOSAL_CHANNELS, type ProposalChannel } from '@/lib/client-proposal'
import type { Locale } from '@/lib/i18n'

const CHANNEL_AR: Record<ProposalChannel, string> = {
  tracking: 'نُشرت عناوينها في صفحة المتابعة',
  whatsapp: 'فُتحت للإرسال بالواتساب',
  copy: 'نُسخ نصّها',
}

export type ProposalResult = { ok: true; sms?: SmsOutcome } | { ok: false; error: string }

/**
 * يسجّل مقترحات أُرسلت للحريف.
 *
 * الواتساب والنسخ يُرسلان من هاتف المستشار؛ هنا نحفظ ماذا اختير وبأيّ قناة،
 * فيبقى أثره في سجلّ الملفّ. قناة «صفحة المتابعة» تنشر العناوين للحريف،
 * ومعها — بطلب صريح — رسالة قصيرة تقول إنّ في ملفّه مقترحات (تكلّف رسالة).
 */
export async function recordProposalAction(input: {
  requestId: string
  keys: string[]
  titles: string[]
  message: string
  channel: ProposalChannel
  notifySms?: boolean
}): Promise<ProposalResult> {
  const actor = await staffWithPermission('requests.update')
  if (!actor) return { ok: false, error: 'ما عندكش صلاحية تحيين المطالب' }
  if (!PROPOSAL_CHANNELS.includes(input.channel)) return { ok: false, error: 'قناة غير معروفة' }

  const keys = (input.keys ?? []).map(String).slice(0, 20)
  const titles = (input.titles ?? []).map((t) => String(t).trim().slice(0, 120)).filter(Boolean).slice(0, 20)
  const message = String(input.message ?? '').slice(0, 8000)
  if (!titles.length || titles.length !== keys.length) return { ok: false, error: 'اختر حلّاً واحداً على الأقلّ' }
  if (!message.trim()) return { ok: false, error: 'النصّ فارغ' }

  const { data: r } = await db
    .from('housing_requests')
    .select('id, ref_code, phone, lang')
    .eq('id', input.requestId)
    .maybeSingle()
  if (!r) return { ok: false, error: 'المطلب غير موجود' }
  const lang = (r.lang === 'fr' ? 'fr' : 'ar') as Locale

  const { error } = await db.from('client_proposals').insert({
    request_id: r.id,
    option_keys: keys,
    titles,
    message,
    channel: input.channel,
    lang,
    created_by: actor.userId,
  })
  if (error) {
    console.error('record proposal', error)
    return { ok: false, error: 'تعذّر الحفظ — أعد المحاولة' }
  }

  // الرسالة تُنتظر هنا لا في الخلفية: المستشار يعرف فوراً إن خرجت، أو علاش لا
  const sms: SmsOutcome | undefined =
    input.channel === 'tracking' && input.notifySms
      ? await sendProposalNotice(String(r.id), String(r.ref_code), String(r.phone), lang)
      : undefined
  const smsNote = !sms ? '' : sms.status === 'sent' ? '، مع رسالة قصيرة خرجت' : `، رسالة قصيرة لم تُرسل: ${sms.reason}`
  await db.from('request_events').insert({
    request_id: r.id,
    event_type: 'note',
    actor: actor.userId,
    note: `مقترحات للحريف (${CHANNEL_AR[input.channel]}${smsNote}): ${titles.join('، ')}`,
  })

  revalidatePath(`/admin/${r.id}`)
  if (input.channel === 'tracking') {
    revalidatePath('/ar/suivi')
    revalidatePath('/fr/suivi')
  }
  return { ok: true, sms }
}
