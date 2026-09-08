import 'server-only'
import { db } from '@/lib/supabase/server'
import {
  normalizeTnPhone,
  parseWinSmsReply,
  propertyConfirmationText,
  requestConfirmationText,
  requestEditedText,
  segmentCount,
  networkConfirmationText,
  statusUpdateText,
  supportAcceptedText,
  type SmsTemplate,
} from '@/lib/sms'
import type { Locale } from '@/lib/i18n'

/**
 * WinSMS.tn — إرسال رسالة واحدة.
 *
 * المفتاح في WINSMS_API_KEY وهو بريد:كلمة سرّ الحساب بصيغة base64، فلا يُطبع
 * ولا يُسجَّل ولا يظهر في أيّ خطأ. المُرسِل «MAZED» مصادَق عليه لدى المزوّد.
 * الفشل هنا لا يوقف تسجيل المطلب أبداً: الرسالة خدمة، والمطلب هو الأصل.
 */

const API = 'https://www.winsmspro.com/sms/sms/api'

type SendResult =
  | { ok: true; providerRef: string | null; raw: string }
  | { ok: false; error: string; raw: string }

async function sendViaWinSms(to: string, text: string): Promise<SendResult> {
  const key = process.env.WINSMS_API_KEY
  const from = process.env.WINSMS_SENDER || 'MAZED'
  if (!key) return { ok: false, error: 'WINSMS_API_KEY غير معرّف', raw: '' }

  const url = new URL(API)
  url.searchParams.set('action', 'send-sms')
  url.searchParams.set('api_key', key)
  url.searchParams.set('to', to)
  url.searchParams.set('from', from)
  url.searchParams.set('sms', text)

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const raw = (await res.text()).slice(0, 500)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, raw: scrub(raw, key) }

    const reply = parseWinSmsReply(raw)
    if (!reply.ok) return { ok: false, error: reply.error, raw: scrub(raw, key) }
    return { ok: true, providerRef: reply.reference, raw: scrub(raw, key) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network', raw: '' }
  }
}

/** المفتاح لا يظهر في السجلّ حتى لو ردّه المزوّد صدىً */
const scrub = (s: string, key: string) => s.split(key).join('[api_key]')

async function smsEnabled(): Promise<boolean> {
  if (process.env.SMS_ENABLED === 'false') return false
  const { data } = await db.from('app_settings').select('value').eq('key', 'sms.enabled').maybeSingle()
  return data?.value !== false
}

type Target = { requestId?: string; propertyId?: string; intervenantId?: string }

/**
 * إرسال + تسجيل. الدالّة لا ترمي أبداً: تُسجّل النتيجة وتصمت.
 * مرجع واحد لكلّ (مطلب، قالب) عبر فهرس فريد — إعادة الإرسال قرار إداري.
 */
async function sendAndLog(target: Target, template: SmsTemplate, phone: string, text: string) {
  const to = normalizeTnPhone(phone)
  const base = {
    request_id: target.requestId ?? null,
    property_id: target.propertyId ?? null,
    intervenant_id: target.intervenantId ?? null,
    template,
    body: text,
    segments: segmentCount(text),
  }

  if (!to) {
    await db.from('sms_log').insert({ ...base, to_number: phone.slice(0, 20), status: 'skipped', error: 'رقم غير تونسي أو غير صالح' })
    return
  }
  if (!(await smsEnabled())) {
    await db.from('sms_log').insert({ ...base, to_number: to, status: 'skipped', error: 'الإرسال معطَّل (sms.enabled)' })
    return
  }

  // الصفّ أوّلاً بحالة queued: الفهرس الفريد يمنع رسالة ثانية لو تكرّر الاستدعاء
  const { data: row, error: insErr } = await db
    .from('sms_log')
    .insert({ ...base, to_number: to, status: 'queued' })
    .select('id')
    .maybeSingle()
  if (insErr || !row) {
    if (insErr) console.warn('sms_log insert skipped:', insErr.code ?? insErr.message)
    return
  }

  const result = await sendViaWinSms(to, text)
  await db
    .from('sms_log')
    .update(
      result.ok
        ? { status: 'sent', provider_ref: result.providerRef, response: result.raw, sent_at: new Date().toISOString() }
        : { status: 'failed', error: result.error, response: result.raw }
    )
    .eq('id', row.id)

  if (!result.ok) console.warn('sms failed:', result.error)
}

export async function sendRequestConfirmation(requestId: string, refCode: string, phone: string, locale: Locale) {
  try {
    await sendAndLog({ requestId }, 'request_confirmation', phone, requestConfirmationText(refCode, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

export async function sendPropertyConfirmation(propertyId: string, refCode: string, phone: string, locale: Locale) {
  try {
    await sendAndLog({ propertyId }, 'property_confirmation', phone, propertyConfirmationText(refCode, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** إعادة إرسال رمز المطلب — قرار إداري من صفحة المطلب، قالب مستقلّ فلا يصطدم بفهرس «مرّة واحدة» */
export async function resendRequestConfirmation(requestId: string, refCode: string, phone: string, locale: Locale) {
  try {
    await sendAndLog({ requestId }, 'request_confirmation_resend', phone, requestConfirmationText(refCode, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** تأكيد تعديل صاحب المطلب — لا فهرس فريد عليه: التعديل يتكرّر بطبعه */
export async function sendRequestEdited(requestId: string, refCode: string, phone: string, locale: Locale) {
  try {
    await sendAndLog({ requestId }, 'request_edited', phone, requestEditedText(refCode, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** إشعار بتغيّر الحالة — لا يُرسل إلّا للحالات المستحقّة (lib/sms.ts) */
export async function sendStatusUpdate(requestId: string, refCode: string, phone: string, locale: Locale, status: string) {
  const text = statusUpdateText(refCode, status, locale)
  if (!text) return
  try {
    await sendAndLog({ requestId }, `status_${status}`, phone, text)
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** قبول طلب المساندة — مرّة واحدة لكلّ مطلب بحكم القالب الثابت */
export async function sendSupportAccepted(requestId: string, refCode: string, phone: string, locale: Locale) {
  try {
    await sendAndLog({ requestId }, 'support_accepted', phone, supportAcceptedText(refCode, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** تأكيد تسجيل مهني في الشبكة */
export async function sendNetworkConfirmation(intervenantId: string, refCode: string, category: string | null, phone: string, locale: Locale) {
  try {
    await sendAndLog({ intervenantId }, 'network_confirmation', phone, networkConfirmationText(refCode, category, locale))
  } catch (e) {
    console.warn('sms unexpected:', e instanceof Error ? e.message : e)
  }
}

/** رصيد الحساب — للوحة القيادة؛ المزوّد يحدّه بطلب كلّ 30 ثانية */
export async function checkSmsBalance(): Promise<{ balance: number; licence: string } | null> {
  const key = process.env.WINSMS_API_KEY
  if (!key) return null
  try {
    const url = new URL(API)
    url.searchParams.set('action', 'check-balance')
    url.searchParams.set('api_key', key)
    url.searchParams.set('response', 'json')
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 60 } })
    if (!res.ok) return null
    const j = (await res.json()) as { balance?: number; licence?: string }
    return typeof j.balance === 'number' ? { balance: j.balance, licence: j.licence ?? '' } : null
  } catch {
    return null
  }
}
