/**
 * حالة بوّابة الحساب — أنواع وقيمة ابتدائية، بلا تشفير ولا قاعدة.
 *
 * منفصلة عن lib/account.ts لأنّ ذاك يستورد node:crypto، ومكوّن العميل
 * الذي يعرض البوّابة لا يُبنى معه: الحزمة تنكسر عند «node:» لا عند
 * التشغيل، فالخطأ يظهر صفحة 500 لا رسالة واضحة.
 */

export type PhoneProblem =
  | 'empty'
  | 'not_a_number'
  /** أقلّ من الحدّ الأدنى لرقم دولي */
  | 'too_short'
  | 'too_long'
  /** رقم محلّي غير تونسي: 06… لا يُعرف بلده بلا مفتاح دولي */
  | 'needs_country_code'

export type Phone =
  | { ok: true; phone: string; tn: boolean }
  | { ok: false; reason: PhoneProblem }

/**
 * الأفعال ترجع رموز أخطاء لا نصوصاً: الترجمة في lib/i18n.ts حيث تُراجَع،
 * لا مبعثرة في الخادم.
 */
export type GateError =
  | PhoneProblem
  | 'cooldown'
  | 'daily_cap'
  | 'not_found'
  | 'expired'
  | 'consumed'
  | 'too_many_attempts'
  | 'wrong_code'
  | 'blocked'
  | 'failed'

export type GateState = {
  step: 'phone' | 'code'
  /** الرقم موحَّداً — يُمرَّر في خانة مخفيّة إلى خطوة الرمز */
  phone: string
  error?: GateError
  /** الرمز لم يخرج برسالة: رقم غير تونسي، والفريق يتولّاه */
  notSent?: boolean
  /** ثوانٍ قبل السماح بإعادة الإرسال */
  retryAfter?: number
}

export const initialGateState: GateState = { step: 'phone', phone: '' }
