import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * حساب الحريف: الرقم، الرمز، الجلسة — المنطق الخالص.
 *
 * منفصل عن الأفعال التي تمسّ القاعدة حتّى يُختبر: خطأ هنا لا يظهر في
 * شاشة. رمز يُقبل بعد انتهائه، أو سقف محاولات يُعدّ غلطاً، أو جلسة
 * تُقرأ بمقارنة عادية تسرّب طول البادئة الصحيحة — كلّها أعطاب صامتة.
 *
 * ولا كلمة سرّ في هذا المسار: الحريف التونسي يفقدها، والاسترجاع يحتاج
 * بريداً أكثرهم لا يستعمله. الهاتف هو الهويّة، والرمز هو الإثبات.
 */

// ─────────────────────────────────────────────────────────── الرقم

/** تونس: ثمانية أعداد محلّياً، تبدأ بـ2 أو 4 أو 5 أو 9 */
const TN_LOCAL = /^[2459]\d{7}$/
export const TN_CODE = '216'

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
 * يوحّد الرقم إلى E.164 بلا علامة زائد: 21698120630.
 *
 * الكرّاس يطلب «الأرقام التونسية والدولية بصيغة موحدة»، لأنّ تونسيّ
 * المهجر شريحة حقيقية (expat في أنواع التشغيل). فالتونسي بثمانية أعداد
 * يُسبَق بـ216، والدولي يُقبل بمفتاحه، والمحلّي غير التونسي (0612…)
 * يُرفض برسالة تطلب المفتاح — لا يُخمَّن بلده.
 */
export function normalizePhone(input: string): Phone {
  const raw = (input ?? '').trim()
  if (!raw) return { ok: false, reason: 'empty' }
  if (/[^\d\s+()./-]/.test(raw)) return { ok: false, reason: 'not_a_number' }

  let d = raw.replace(/[^\d+]/g, '')
  const hadPlus = d.startsWith('+') || d.startsWith('00')
  d = d.replace(/^\+/, '').replace(/^00/, '')
  if (!d) return { ok: false, reason: 'empty' }

  if (TN_LOCAL.test(d)) return { ok: true, phone: `${TN_CODE}${d}`, tn: true }
  if (d.startsWith(TN_CODE) && TN_LOCAL.test(d.slice(3))) {
    return { ok: true, phone: d, tn: true }
  }

  if (!hadPlus && d.startsWith('0')) return { ok: false, reason: 'needs_country_code' }
  if (d.length < 8) return { ok: false, reason: 'too_short' }
  if (d.length > 15) return { ok: false, reason: 'too_long' }
  if (!hadPlus) return { ok: false, reason: 'needs_country_code' }
  return { ok: true, phone: d, tn: false }
}

export const isTunisian = (phone: string) => phone.startsWith(TN_CODE) && phone.length === 11

/**
 * هل يبلغ الرمز صاحب هذا الرقم اليوم؟
 * المزوّد WinSMS تونسي، والإرسال الدولي ليس مفعّلاً عنده عندنا. فحساب
 * تونسيّ مهجر يُنشأ، ورمزه لا يخرج — يتولّاه الفريق يدوياً حتّى يُعتمد
 * مسار دولي بتكلفته.
 */
export const canReceiveSms = (phone: string) => isTunisian(phone)

// ─────────────────────────────────────────────────────────── الرمز

export const OTP_LENGTH = 6

/** ستّة أعداد من مولّد تشفيري — Math.random يُتنبّأ به */
export function newOtpCode(rand: (max: number) => number = (m) => randomInt(m)): string {
  return String(rand(10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

export const isOtpShape = (code: string) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)

function hmacKey(secret = process.env.SUPABASE_SECRET_KEY): Buffer {
  if (!secret) throw new Error('SUPABASE_SECRET_KEY غير معرّف — لا يمكن توقيع رموز الحساب')
  return createHmac('sha256', secret).update('allabina/account/v1').digest()
}

/**
 * بصمة الرمز لا الرمز. والهاتف داخل البصمة: رمز سُرّب لرقم لا يصلح لرقم آخر.
 */
export function hashOtp(phone: string, code: string, secret?: string): string {
  return createHmac('sha256', hmacKey(secret)).update(`${phone}.${code}`).digest('base64url')
}

export function otpMatches(hash: string, phone: string, code: string, secret?: string): boolean {
  if (!isOtpShape(code)) return false
  const a = Buffer.from(hash)
  const b = Buffer.from(hashOtp(phone, code, secret))
  return a.length === b.length && timingSafeEqual(a, b)
}

// ───────────────────────────────────────────────────── سقوف الإرسال

export type OtpPolicy = {
  ttlSeconds: number
  maxAttempts: number
  resendCooldownSeconds: number
  maxPerDay: number
}

/** القيم الافتراضية — تُبدَّل من «المعطيات المرجعية» بمفاتيح account.* */
export const DEFAULT_OTP_POLICY: OtpPolicy = {
  ttlSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxPerDay: 8,
}

export type SendDecision =
  | { ok: true }
  | { ok: false; reason: 'cooldown' | 'daily_cap'; retryAfterMs: number }

/**
 * هل نرسل رمزاً الآن؟
 * كلّ رمز رسالة مدفوعة من رصيد الشركة، فالسقفان هنا ليسا أماناً فقط:
 * زرّ «أعد الإرسال» يُضغط عشرات المرّات بلا تبرّم.
 */
export function canSendOtp(
  state: { lastSentAt: Date | string | null; sentLastDay: number },
  policy: OtpPolicy = DEFAULT_OTP_POLICY,
  now: Date = new Date()
): SendDecision {
  if (state.sentLastDay >= policy.maxPerDay) {
    return { ok: false, reason: 'daily_cap', retryAfterMs: 24 * 3600_000 }
  }
  if (state.lastSentAt) {
    const since = now.getTime() - new Date(state.lastSentAt).getTime()
    const wait = policy.resendCooldownSeconds * 1000 - since
    if (wait > 0) return { ok: false, reason: 'cooldown', retryAfterMs: wait }
  }
  return { ok: true }
}

export type VerifyDecision =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'consumed' | 'too_many_attempts' }

export function canVerifyOtp(
  row: { attempts: number; expires_at: string | Date; consumed_at: string | Date | null } | null,
  policy: OtpPolicy = DEFAULT_OTP_POLICY,
  now: Date = new Date()
): VerifyDecision {
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.consumed_at) return { ok: false, reason: 'consumed' }
  if (row.attempts >= policy.maxAttempts) return { ok: false, reason: 'too_many_attempts' }
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true }
}

export const otpExpiryFrom = (policy: OtpPolicy, now: Date = new Date()) =>
  new Date(now.getTime() + policy.ttlSeconds * 1000)

// ──────────────────────────────────────────────────────── الجلسة

export const USER_COOKIE = 'allabina_user'
const SESSION_DOMAIN = 'allabina/user-session/v1'

function sessionKey(secret = process.env.SUPABASE_SECRET_KEY): Buffer {
  if (!secret) throw new Error('SUPABASE_SECRET_KEY غير معرّف — لا يمكن توقيع جلسة الحريف')
  return createHmac('sha256', secret).update(SESSION_DOMAIN).digest()
}

const sign = (payload: string, secret?: string) =>
  createHmac('sha256', sessionKey(secret)).update(payload).digest('base64url')

/** «معرّف.انتهاء.توقيع» — لا اسم ولا هاتف داخل الكوكي */
export function issueUserSession(
  userId: string,
  days = 30,
  now: number = Date.now(),
  secret?: string
): string {
  const payload = `${userId}.${now + days * 86400_000}`
  return `${payload}.${sign(payload, secret)}`
}

export function readUserSession(
  token: string | undefined,
  now: number = Date.now(),
  secret?: string
): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [id, expRaw, mac] = parts

  // المقارنة بزمن ثابت: المقارنة العادية تسرّب طول البادئة الصحيحة
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(`${id}.${expRaw}`, secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return id
}
