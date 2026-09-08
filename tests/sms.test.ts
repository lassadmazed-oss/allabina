import { describe, expect, it } from 'vitest'
import {
  ONE_SEGMENT_AR,
  ONE_SEGMENT_PLAIN,
  isPlain,
  NOTIFIABLE_STATUSES,
  isNotifiableStatus,
  networkConfirmationText,
  normalizeTnPhone,
  parseWinSmsReply,
  statusUpdateText,
  supportAcceptedText,
  propertyConfirmationText,
  requestConfirmationText,
  requestEditedText,
  segmentCount,
} from '@/lib/sms'

describe('تطبيع الرقم التونسي', () => {
  it('كلّ الأشكال المتداولة تصير 216XXXXXXXX', () => {
    for (const raw of ['20123456', '20 123 456', '+216 20123456', '0021620123456', '21620123456', '20-123-456']) {
      expect(normalizeTnPhone(raw)).toBe('21620123456')
    }
  })

  it('يقبل بادئات الشبكات التونسية 2 · 4 · 5 · 9 ويرفض غيرها', () => {
    expect(normalizeTnPhone('44123456')).toBe('21644123456')
    expect(normalizeTnPhone('52790481')).toBe('21652790481')
    expect(normalizeTnPhone('98123456')).toBe('21698123456')
    expect(normalizeTnPhone('71123456')).toBeNull() // ثابت
    expect(normalizeTnPhone('+33612345678')).toBeNull() // فرنسا: لا نحرق رصيداً
    expect(normalizeTnPhone('2012345')).toBeNull()
    expect(normalizeTnPhone('')).toBeNull()
  })
})

describe('حساب الأجزاء كما يحسبها المزوّد', () => {
  it('عربي: 70 محرفاً للجزء الأوّل', () => {
    expect(segmentCount('ا'.repeat(70))).toBe(1)
    expect(segmentCount('ا'.repeat(71))).toBe(2)
  })

  it('لاتيني بلا تشكيل: 160، وبتشكيل: 155', () => {
    expect(segmentCount('a'.repeat(160))).toBe(1)
    expect(segmentCount('a'.repeat(161))).toBe(2)
    expect(segmentCount('é' + 'a'.repeat(154))).toBe(1)
    expect(segmentCount('é' + 'a'.repeat(155))).toBe(2)
  })

  it('محرف واحد خارج القائمة يحوّل الرسالة إلى Unicode', () => {
    expect(isPlain('Demande LB-2026-000001 enregistree.')).toBe(true)
    expect(isPlain('Demande enregistrée — merci')).toBe(false) // الشرطة الطويلة
    expect(isPlain('ok ✓')).toBe(false)
  })
})

describe('نصوص التأكيد', () => {
  const ref = 'LB-2026-000123'

  it('العربية تدخل في جزء واحد وتحمل الرمز ولا الهاتف', () => {
    const t = requestConfirmationText(ref, 'ar')
    expect([...t].length).toBeLessThanOrEqual(ONE_SEGMENT_AR)
    expect(segmentCount(t)).toBe(1)
    expect(t).toContain(ref)
    expect(t).not.toMatch(/\d{8}/) // لا رقم هاتف
  })

  it('الفرنسية PLAIN صرفة في جزء واحد', () => {
    const t = requestConfirmationText(ref, 'fr')
    expect(isPlain(t)).toBe(true)
    expect([...t].length).toBeLessThanOrEqual(ONE_SEGMENT_PLAIN)
    expect(segmentCount(t)).toBe(1)
    expect(t).toContain(ref)
  })

  it('تأكيد التعديل في جزء واحد، ويقول إنّه تسجّل بلا ما يقول شنوّة تبدّل', () => {
    const ar = requestEditedText(ref, 'ar')
    expect([...ar].length).toBeLessThanOrEqual(ONE_SEGMENT_AR)
    expect(segmentCount(ar)).toBe(1)
    expect(ar).toContain(ref)
    const fr = requestEditedText(ref, 'fr')
    expect(isPlain(fr)).toBe(true)
    expect(segmentCount(fr)).toBe(1)
    expect(fr).toContain(ref)
  })

  it('تأكيد العقار كذلك في جزء واحد باللغتين', () => {
    expect(segmentCount(propertyConfirmationText('PR-2026-000045', 'ar'))).toBe(1)
    const fr = propertyConfirmationText('PR-2026-000045', 'fr')
    expect(isPlain(fr)).toBe(true)
    expect(segmentCount(fr)).toBe(1)
  })
})

describe('قراءة ردّ WinSMS', () => {
  it('الردّ الحقيقي المشاهَد: ok + مرجع + رصيد', () => {
    const r = parseWinSmsReply(
      '{"code":"ok","message":"Successfully Send","balance":584,"user":"Mr X","licence":"2026-12-14","reference":"4583526"}'
    )
    expect(r).toEqual({ ok: true, reference: '4583526', balance: 584 })
  })

  it('code غير ok = فشل برسالة المزوّد نفسها', () => {
    const r = parseWinSmsReply('{"code":"ko","message":"Insufficient balance"}')
    expect(r).toEqual({ ok: false, error: 'Insufficient balance' })
  })

  it('ردّ غير JSON = فشل صريح لا «أُرسل» بالتخمين', () => {
    const r = parseWinSmsReply('<html>Bad Gateway</html>')
    expect(r.ok).toBe(false)
  })
})

describe('إشعار تغيّر الحالة', () => {
  it('كلّ حالة مستحقّة تدخل في جزء واحد بالعربية، وPLAIN بالفرنسية', () => {
    for (const st of NOTIFIABLE_STATUSES) {
      const ar = statusUpdateText('LB-2026-000089', st, 'ar')!
      expect(segmentCount(ar)).toBe(1)
      expect(ar).toContain('LB-2026-000089')
      const fr = statusUpdateText('LB-2026-000089', st, 'fr')!
      expect(isPlain(fr)).toBe(true)
      expect(segmentCount(fr)).toBe(1)
    }
  })

  it('«مرفوض» و«جديد» و«تمّ الاتصال» لا تُرسل آلياً', () => {
    for (const st of ['rejected', 'new', 'contacted', 'nonsense']) {
      expect(isNotifiableStatus(st)).toBe(false)
      expect(statusUpdateText('LB-1', st, 'ar')).toBeNull()
    }
  })
})

describe('رسالة قبول طلب المساندة', () => {
  it('جزء واحد باللغتين، تحمل الرمز، ولا تعد بحلّ', () => {
    const ar = supportAcceptedText('LB-2026-000078', 'ar')
    expect(segmentCount(ar)).toBe(1)
    expect(ar).toContain('LB-2026-000078')
    expect(ar).not.toMatch(/حلّ|نضمن|وعد/)
    const fr = supportAcceptedText('LB-2026-000078', 'fr')
    expect(isPlain(fr)).toBe(true)
    expect(segmentCount(fr)).toBe(1)
  })
})

describe('تأكيد تسجيل مهني', () => {
  it('يحمل الاختصاص إن دخل في جزء واحد، وإلّا الرمز وحده', () => {
    const short = networkConfirmationText('IN-2026-000012', 'كهرباء', 'ar')
    expect(short).toContain('كهرباء')
    expect(segmentCount(short)).toBe(1)
    const long = networkConfirmationText('IN-2026-000012', 'أشغال الخرسانة المسلّحة والهياكل الحديدية الكبرى', 'ar')
    expect(segmentCount(long)).toBe(1)
    expect(long).not.toContain('الهياكل')
    expect(long).toContain('IN-2026-000012')
  })

  it('بالفرنسية PLAIN في جزء واحد ولا يعد بالاعتماد', () => {
    const fr = networkConfirmationText('IN-2026-000012', 'Electricite', 'fr')
    expect(isPlain(fr)).toBe(true)
    expect(segmentCount(fr)).toBe(1)
    expect(fr).toMatch(/Validation/)
  })
})
