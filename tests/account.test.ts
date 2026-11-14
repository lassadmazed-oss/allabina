import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OTP_POLICY,
  canReceiveSms,
  canSendOtp,
  canVerifyOtp,
  hashOtp,
  isTunisian,
  issueUserSession,
  newOtpCode,
  normalizePhone,
  otpMatches,
  readUserSession,
} from '@/lib/account'

/**
 * حساب الحريف.
 *
 * كلّ ما هنا خطؤه صامت: رقم يُقبل بصيغة ويُرفض بأخرى فيصير للشخص
 * حسابان، رمز يُقبل بعد انتهائه، سقف إرسال يُعدّ غلطاً فيُحرق رصيد
 * الرسائل، جلسة تُقرأ بمقارنة عادية فتُخمَّن بالتوقيت. لا شاشة تُظهر
 * واحداً من هذه.
 */
const SECRET = 'secret-for-tests-only-32-characters'

describe('توحيد الرقم', () => {
  it('كلّ أشكال الرقم التونسي تعطي رقماً واحداً', () => {
    for (const raw of [
      '98120630',
      '98 12 06 30',
      '98-120-630',
      '+216 98120630',
      '0021698120630',
      '21698120630',
      '(216) 98.120.630',
    ]) {
      const r = normalizePhone(raw)
      expect(r.ok, raw).toBe(true)
      if (r.ok) {
        expect(r.phone, raw).toBe('21698120630')
        expect(r.tn, raw).toBe(true)
      }
    }
  })

  it('الدولي يُقبل بمفتاحه — تونسيّ المهجر شريحة حقيقية', () => {
    const r = normalizePhone('+33 6 12 34 56 78')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.phone).toBe('33612345678')
      expect(r.tn).toBe(false)
    }
  })

  it('المحلّي غير التونسي يُرفض برسالة تطلب المفتاح، ولا يُخمَّن بلده', () => {
    const r = normalizePhone('0612345678')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('needs_country_code')
  })

  it('بادئات الشبكات التونسية الأربع تمرّ، والثابت لا', () => {
    for (const p of ['20123456', '44123456', '52790481', '98123456']) {
      expect(normalizePhone(p).ok, p).toBe(true)
    }
    // 71 ثابت: ثمانية أعداد لكن ليس بادئة جوّال — يُطلب منه المفتاح الدولي
    const fixed = normalizePhone('71123456')
    expect(fixed.ok).toBe(false)
  })

  it('الفارغ والمكسور لهما سببان مختلفان', () => {
    expect(normalizePhone('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizePhone('   ')).toEqual({ ok: false, reason: 'empty' })
    const bad = normalizePhone('أهلا')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.reason).toBe('not_a_number')
  })

  it('القصير جدّاً والطويل جدّاً يُرفضان', () => {
    const short = normalizePhone('+1234')
    expect(short.ok).toBe(false)
    if (!short.ok) expect(short.reason).toBe('too_short')
    const long = normalizePhone('+1234567890123456')
    expect(long.ok).toBe(false)
    if (!long.ok) expect(long.reason).toBe('too_long')
  })
})

describe('من يبلغه الرمز', () => {
  it('التونسي يبلغه، والدولي لا — المزوّد تونسي', () => {
    expect(isTunisian('21698120630')).toBe(true)
    expect(canReceiveSms('21698120630')).toBe(true)
    expect(canReceiveSms('33612345678')).toBe(false)
  })
})

describe('الرمز', () => {
  it('ستّة أعداد دائماً، والصفر البادئ محفوظ', () => {
    expect(newOtpCode(() => 42)).toBe('000042')
    expect(newOtpCode(() => 999999)).toBe('999999')
    expect(newOtpCode()).toMatch(/^\d{6}$/)
  })

  it('البصمة تُخزَّن لا الرمز، والرقم داخلها', () => {
    const h = hashOtp('21698120630', '123456', SECRET)
    expect(h).not.toContain('123456')
    expect(hashOtp('21698120630', '123456', SECRET)).toBe(h)
    // رمز سُرّب لرقم لا يصلح لرقم آخر
    expect(hashOtp('21655000000', '123456', SECRET)).not.toBe(h)
  })

  it('المطابقة تقبل الصحيح وترفض ما عداه', () => {
    const h = hashOtp('21698120630', '123456', SECRET)
    expect(otpMatches(h, '21698120630', '123456', SECRET)).toBe(true)
    expect(otpMatches(h, '21698120630', '123457', SECRET)).toBe(false)
    expect(otpMatches(h, '21655000000', '123456', SECRET)).toBe(false)
    expect(otpMatches(h, '21698120630', '12345', SECRET)).toBe(false)
    expect(otpMatches(h, '21698120630', 'abcdef', SECRET)).toBe(false)
  })
})

describe('سقوف الإرسال — كلّ رمز رسالة مدفوعة', () => {
  const now = new Date('2026-11-14T10:00:00Z')

  it('أوّل رمز يمرّ', () => {
    expect(canSendOtp({ lastSentAt: null, sentLastDay: 0 }, DEFAULT_OTP_POLICY, now)).toEqual({ ok: true })
  })

  it('الضغط المتكرّر على «أعد الإرسال» يصطدم بفاصل زمني', () => {
    const d = canSendOtp(
      { lastSentAt: new Date(now.getTime() - 20_000), sentLastDay: 1 },
      DEFAULT_OTP_POLICY,
      now
    )
    expect(d.ok).toBe(false)
    if (!d.ok) {
      expect(d.reason).toBe('cooldown')
      expect(d.retryAfterMs).toBe(40_000)
    }
  })

  it('بعد انقضاء الفاصل يمرّ', () => {
    expect(
      canSendOtp({ lastSentAt: new Date(now.getTime() - 61_000), sentLastDay: 1 }, DEFAULT_OTP_POLICY, now)
    ).toEqual({ ok: true })
  })

  it('السقف اليومي يسبق الفاصل: لا يُفتح بالانتظار دقيقة', () => {
    const d = canSendOtp(
      { lastSentAt: new Date(now.getTime() - 3600_000), sentLastDay: 8 },
      DEFAULT_OTP_POLICY,
      now
    )
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('daily_cap')
  })
})

describe('قبول الرمز', () => {
  const now = new Date('2026-11-14T10:00:00Z')
  const row = (over: Record<string, unknown> = {}) => ({
    attempts: 0,
    expires_at: new Date(now.getTime() + 60_000).toISOString(),
    consumed_at: null,
    ...over,
  })

  it('الصالح يمرّ', () => {
    expect(canVerifyOtp(row(), DEFAULT_OTP_POLICY, now)).toEqual({ ok: true })
  })

  it('المنتهي يُرفض ولو كان صحيحاً', () => {
    const d = canVerifyOtp(row({ expires_at: new Date(now.getTime() - 1).toISOString() }), DEFAULT_OTP_POLICY, now)
    expect(d).toEqual({ ok: false, reason: 'expired' })
  })

  it('المستعمَل مرّة لا يُستعمل مرّتين', () => {
    expect(canVerifyOtp(row({ consumed_at: now.toISOString() }), DEFAULT_OTP_POLICY, now)).toEqual({
      ok: false,
      reason: 'consumed',
    })
  })

  it('خمس محاولات تكفي: السادسة ترفض قبل المقارنة', () => {
    expect(canVerifyOtp(row({ attempts: 5 }), DEFAULT_OTP_POLICY, now)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    })
  })

  it('لا سطر = لا رمز', () => {
    expect(canVerifyOtp(null, DEFAULT_OTP_POLICY, now)).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('جلسة الحريف', () => {
  const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
  const now = 1_700_000_000_000

  it('تُكتب وتُقرأ، ولا تحمل اسماً ولا هاتفاً', () => {
    const t = issueUserSession(id, 30, now, SECRET)
    expect(readUserSession(t, now + 1000, SECRET)).toBe(id)
    expect(t).not.toMatch(/\+?216/)
  })

  it('تنتهي في وقتها', () => {
    const t = issueUserSession(id, 1, now, SECRET)
    expect(readUserSession(t, now + 86400_000 + 1, SECRET)).toBeNull()
  })

  it('تبديل المعرّف يكسر التوقيع', () => {
    const t = issueUserSession(id, 30, now, SECRET)
    const other = t.replace(id, '00000000-0000-0000-0000-000000000000')
    expect(readUserSession(other, now, SECRET)).toBeNull()
  })

  it('تمديد المدّة باليد يكسر التوقيع', () => {
    const [i, exp, mac] = issueUserSession(id, 1, now, SECRET).split('.')
    expect(readUserSession(`${i}.${Number(exp) + 86400_000}.${mac}`, now, SECRET)).toBeNull()
  })

  it('سرّ آخر لا يفتحها', () => {
    const t = issueUserSession(id, 30, now, SECRET)
    expect(readUserSession(t, now, 'another-secret-entirely-32-chars!!')).toBeNull()
  })

  it('المكسور شكلاً يُرفض بلا رمي', () => {
    for (const t of [undefined, '', 'a', 'a.b', 'a.b.c.d']) {
      expect(readUserSession(t, now, SECRET)).toBeNull()
    }
  })
})
