/**
 * الرسائل القصيرة — القواعد النقيّة (بلا شبكة).
 *
 * المزوّد WinSMS.tn يحسب الرسالة العربية 70 محرفاً للجزء الأوّل، واللاتينية
 * بلا حروف مُشكَّلة 160. رسالة تأكيد تتعدّى جزءاً تكلّف ضعف السعر لنفس
 * الفائدة، فنقيس قبل أن نرسل.
 */

import type { Locale } from '@/lib/i18n'

/** أرقام تونس: 8 أرقام محلّياً، وتبدأ بـ2 أو 4 أو 5 أو 9 */
const TN_LOCAL = /^[2459]\d{7}$/

/**
 * «20 123 456» · «+216 20123456» · «0021620123456» · «21620123456» → 21620123456
 * يرجّع null لما لا يشبه رقماً تونسياً: لا نحرق رصيداً على رقم غالط.
 */
export function normalizeTnPhone(input: string): string | null {
  let d = (input ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('216')) d = d.slice(3)
  if (!TN_LOCAL.test(d)) return null
  return `216${d}`
}

/** الحروف التي يقبلها المزوّد في الصيغة PLAIN؛ ما عداها يحوّل الرسالة إلى UNICODE */
const PLAIN_CHARS = /^[A-Za-z0-9èéàù%@"'()_\-./:,;<=>?!&$ \n]*$/

export const isPlain = (text: string) => PLAIN_CHARS.test(text)

/** كم جزءاً يكلّف النصّ عند المزوّد */
export function segmentCount(text: string): number {
  const len = [...text].length
  if (len === 0) return 0
  if (isPlain(text)) {
    const accented = /[èéàù]/.test(text)
    const first = accented ? 155 : 160
    const next = accented ? 149 : 153
    return len <= first ? 1 : 1 + Math.ceil((len - first) / next)
  }
  return len <= 70 ? 1 : 1 + Math.ceil((len - 70) / 67)
}

export const ONE_SEGMENT_AR = 70
export const ONE_SEGMENT_PLAIN = 160

/**
 * نصّ التأكيد. بالعربية يلزم يدخل في 70 محرفاً — جزء واحد.
 * لا نضع الهاتف (صاحبه يعرفه) ولا أيّ معطى شخصي آخر: الرمز فقط.
 */
export function requestConfirmationText(refCode: string, locale: Locale): string {
  if (locale === 'fr') {
    // PLAIN بلا حروف مُشكَّلة: 160 محرفاً للجزء الواحد
    return `AL-LUBNA: demande ${refCode} enregistree. Gardez ce code pour suivre votre dossier sur allabina.tn/suivi`
  }
  return `اللبنة: مطلبك ${refCode} تسجّل. احفظ الرمز لمتابعة ملفّك.`
}

export function propertyConfirmationText(refCode: string, locale: Locale): string {
  if (locale === 'fr') {
    return `AL-LUBNA: bien ${refCode} enregistre. Notre equipe vous contactera apres verification.`
  }
  return `اللبنة: عرض عقارك ${refCode} تسجّل. الفريق يتّصل بيك بعد المراجعة.`
}

export type SmsTemplate = 'request_confirmation' | 'property_confirmation'

/**
 * ردّ WinSMS كما شوهد فعلاً عند الإرسال:
 *   {"code":"ok","message":"Successfully Send","balance":584,"reference":"4583526",...}
 * code غير "ok" = فشل، ورسالته هي رسالة المزوّد. ردّ غير JSON = فشل صريح
 * لا تخمين: نفضّل «فشل» غالطاً على «أُرسل» غالطاً — الأوّل يُعاد، الثاني يُنسى.
 */
export type ProviderReply =
  | { ok: true; reference: string | null; balance: number | null }
  | { ok: false; error: string }

export function parseWinSmsReply(raw: string): ProviderReply {
  let j: Record<string, unknown>
  try {
    j = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { ok: false, error: `ردّ غير مقروء: ${raw.slice(0, 80)}` }
  }
  const code = String(j.code ?? '').toLowerCase()
  if (code !== 'ok') {
    return { ok: false, error: String(j.message ?? j.error ?? `code=${code || '?'}`) }
  }
  return {
    ok: true,
    reference: j.reference != null ? String(j.reference) : null,
    balance: typeof j.balance === 'number' ? j.balance : null,
  }
}
