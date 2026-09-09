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

/**
 * تأكيد وصول تعديل صاحب المطلب.
 *
 * لا تذكر ما تبدّل: الرسالة تمرّ على شبكة الهاتف وتبقى في شاشة قد
 * يراها غيره. «تعديلك تسجّل» يكفي — التفاصيل في صفحة المتابعة.
 */
export function requestEditedText(refCode: string, locale: Locale): string {
  if (locale === 'fr') {
    return `AL-LUBNA ${refCode}: modification enregistree, dossier mis a jour.`
  }
  return `اللبنة ${refCode}: تعديلك تسجّل والملفّ تحيّن.`
}

export type SmsTemplate =
  | 'request_confirmation'
  | 'request_confirmation_resend'
  | 'request_edited'
  | 'property_confirmation'
  | 'support_accepted'
  | 'network_confirmation'
  | `status_${string}`

/**
 * الحالات التي تستحقّ رسالة. «جديد» و«تمّ الاتصال» لا: الحريف يعرفهما.
 * «مرفوض» لا تُرسل آلياً أبداً — خبر كهذا يُقال في مكالمة لا في 70 محرفاً.
 */
export const NOTIFIABLE_STATUSES = ['qualified', 'matched', 'appointment', 'contract', 'on_hold'] as const

const STATUS_SMS_AR: Record<string, string> = {
  qualified: 'ملفّك مؤهّل وبدينا نلقاو لك حلّ',
  matched: 'فمّا عرض يناسبك، الفريق يتّصل بيك',
  appointment: 'موعدك تحدّد، الفريق يأكّدو معاك',
  contract: 'ملفّك وصل مرحلة العقد',
  on_hold: 'ملفّك موقوف مؤقّتاً، نرجعولك',
}
const STATUS_SMS_FR: Record<string, string> = {
  qualified: 'dossier qualifie, recherche en cours',
  matched: 'une offre vous correspond, on vous appelle',
  appointment: 'rendez-vous fixe, on vous confirme',
  contract: 'votre dossier est au stade du contrat',
  on_hold: 'dossier en attente, on revient vers vous',
}

/**
 * قبول في مسار المساندة. الرفض والتحويل لا يُرسلان أبداً — يُقالان في مكالمة.
 * لا وعد بحلّ: «دخل المسار» و«الفريق يتّصل بيك» فقط.
 */
export function supportAcceptedText(refCode: string, locale: Locale): string {
  if (locale === 'fr') {
    return `AL-LUBNA ${refCode}: votre demande d'aide est prise en charge, l'equipe vous appelle.`
  }
  return `اللبنة ${refCode}: طلب مساندتك دخل الدراسة، الفريق يتّصل بيك.`
}

/**
 * تأكيد تسجيل مهني في الشبكة. يحمل ما سجّله: الاختصاص، إن دخل في جزء واحد —
 * وإلّا الرمز وحده. التسجيل ليس اعتماداً، والرسالة تقول ذلك.
 */
export function networkConfirmationText(refCode: string, category: string | null, locale: Locale): string {
  if (locale === 'fr') {
    const withCat = `AL-LUBNA ${refCode}: inscription recue (${category ?? ''}). Validation par l'equipe avant tout contact.`
    return category && isPlain(withCat) && [...withCat].length <= ONE_SEGMENT_PLAIN
      ? withCat
      : `AL-LUBNA ${refCode}: inscription recue. Validation par l'equipe avant tout contact.`
  }
  const withCat = `اللبنة ${refCode}: تسجيلك (${category ?? ''}) وصل. المراجعة قبل الاعتماد.`
  return category && [...withCat].length <= ONE_SEGMENT_AR
    ? withCat
    : `اللبنة ${refCode}: تسجيلك في الشبكة وصل. المراجعة قبل الاعتماد.`
}

export const isNotifiableStatus = (s: string) =>
  (NOTIFIABLE_STATUSES as readonly string[]).includes(s)

/**
 * رسالة تغيّر الحالة. تقول «شنوّة صار» وتحيل على صفحة المتابعة —
 * لا تفاصيل مالية ولا أسماء. العربية في جزء واحد (≤ 70).
 */
export function statusUpdateText(refCode: string, status: string, locale: Locale): string | null {
  if (!isNotifiableStatus(status)) return null
  if (locale === 'fr') {
    return `AL-LUBNA ${refCode}: ${STATUS_SMS_FR[status]}. Suivi: allabina.tn/suivi`
  }
  return `اللبنة ${refCode}: ${STATUS_SMS_AR[status]}.`
}

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

/**
 * هل يُسمح بالإرسال الفعلي في هذه البيئة؟
 *
 * كلّ رسالة تُكلّف رصيداً حقيقياً. وكان الإرسال مفتوحاً افتراضياً في كلّ
 * بيئة، فكلّ استمارة تجريبية على الحاسوب — وكلّ سكربت — تبعث رسالة
 * وتحرق رصيداً. سبعة عشر رسالة خرجت من التجريب وحده.
 *
 * فالقاعدة انقلبت: **الإرسال مغلق ما لم يُفتح صراحةً**، ويُفتح وحده على
 * موقع الإنتاج. من أراد تجربة الإرسال محلّياً يضع `SMS_ENABLED=true`
 * في `.env` — قرار واعٍ لا افتراض صامت.
 *
 * المنع لا يُخفي شيئاً: الرسالة تُسجَّل في `sms_log` بحالة `skipped`
 * وبسببها، فيرى الفريق ما كان سيُرسَل.
 */
export function smsEnvAllows(env: {
  SMS_ENABLED?: string
  VERCEL_ENV?: string
}): boolean {
  const flag = (env.SMS_ENABLED ?? '').trim().toLowerCase()
  // قرار صريح يسبق كلّ شيء — في الاتّجاهين
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  // بلا قرار: الإنتاج وحده يرسل
  return env.VERCEL_ENV === 'production'
}
