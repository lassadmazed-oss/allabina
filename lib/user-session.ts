import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { db } from '@/lib/supabase/server'
import {
  DEFAULT_OTP_POLICY,
  USER_COOKIE,
  issueUserSession,
  readUserSession,
  type OtpPolicy,
} from '@/lib/account'

/**
 * جلسة الحريف في الخادم.
 *
 * الكوكي يحمل المعرّف وتاريخ الانتهاء وتوقيعاً — لا اسم ولا هاتف، فلا
 * يُقرأ من الجهاز ولا يبقى في تاريخ المتصفّح كما كان رابط `code+phone`.
 * وكلّ قراءة تمرّ على القاعدة: حساب مُوقَف لا يُفتح بكوكي قديم.
 */
export type CurrentUser = {
  id: string
  phone: string
  fullName: string
}

/** 180 يوماً: مشروع بناء يدوم أشهراً، وكلّ دخول جديد رسالة مدفوعة */
const SESSION_DAYS = 180

export async function startUserSession(userId: string, days = SESSION_DAYS) {
  const store = await cookies()
  store.set(USER_COOKIE, issueUserSession(userId, days), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 86400,
  })
}

export async function endUserSession() {
  const store = await cookies()
  store.delete(USER_COOKIE)
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(USER_COOKIE)?.value
  const id = readUserSession(token)
  if (!id) return null

  const { data } = await db
    .from('app_users')
    .select('id, phone, full_name, status')
    .eq('id', id)
    .maybeSingle()
  if (!data || data.status !== 'active') return null

  // أثر خفيف: يسمح بقياس الرجوع بلا تتبّع
  await db
    .from('app_users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => error && console.warn('last_seen_at', error.message))

  return { id: String(data.id), phone: String(data.phone), fullName: String(data.full_name ?? '') }
})

/**
 * سقوف الرموز من «المعطيات المرجعية» — تُبدَّل من اللوحة بلا نشر.
 * القيمة الغائبة أو المكسورة ترجع للافتراضي بدل أن توقف التسجيل.
 */
export const getOtpPolicy = cache(async (): Promise<OtpPolicy> => {
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'account.otp_ttl_seconds',
      'account.otp_max_attempts',
      'account.otp_resend_cooldown_seconds',
      'account.otp_max_per_day',
    ])

  const m = new Map((data ?? []).map((r) => [r.key as string, r.value]))
  const num = (k: string, fallback: number) => {
    const v = m.get(k)
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
  }

  return {
    ttlSeconds: num('account.otp_ttl_seconds', DEFAULT_OTP_POLICY.ttlSeconds),
    maxAttempts: num('account.otp_max_attempts', DEFAULT_OTP_POLICY.maxAttempts),
    resendCooldownSeconds: num(
      'account.otp_resend_cooldown_seconds',
      DEFAULT_OTP_POLICY.resendCooldownSeconds
    ),
    maxPerDay: num('account.otp_max_per_day', DEFAULT_OTP_POLICY.maxPerDay),
  }
})
