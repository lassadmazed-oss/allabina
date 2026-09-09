import { describe, expect, it } from 'vitest'
import {
  MAX_BYTES,
  MAX_SECONDS,
  baseMime,
  draftVoicePath,
  finalVoicePath,
  formatDuration,
  isVoiceSubject,
  voiceRejection,
} from '@/lib/voice-note'

describe('نوع التسجيل', () => {
  it('MediaRecorder يعيد النوع بمعاملاته — نقصّها قبل المقارنة', () => {
    expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm')
    expect(baseMime(' AUDIO/MP4 ')).toBe('audio/mp4')
  })

  it('الأنواع الأربعة التي تعطيها المتصفّحات مقبولة', () => {
    for (const m of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg']) {
      expect(voiceRejection(m, 1000)).toBeNull()
    }
  })

  it('نوع غير صوتي يُرفض ولو كان حجمه سليماً', () => {
    expect(voiceRejection('video/mp4', 1000)).toBe('type')
    expect(voiceRejection('image/png', 1000)).toBe('type')
  })

  it('الملفّ الفارغ يُرفض قبل نوعه', () => {
    expect(voiceRejection('audio/webm', 0)).toBe('empty')
  })

  it('الحجم والزمن لهما حدّان', () => {
    expect(voiceRejection('audio/webm', MAX_BYTES + 1)).toBe('size')
    expect(voiceRejection('audio/webm', 1000, MAX_SECONDS + 30)).toBe('tooLong')
  })

  it('تجاوز ثانيتين يُحتمَل: القياس في المتصفّح ليس دقيقاً', () => {
    expect(voiceRejection('audio/webm', 1000, MAX_SECONDS + 1)).toBeNull()
  })
})

describe('المسارات', () => {
  it('المسوّدة تحمل الرمز والامتداد المشتقّ من النوع', () => {
    const p = draftVoicePath('a'.repeat(24), 'audio/webm;codecs=opus', 'xyz123', new Date('2026-09-09T14:30:12Z'))
    expect(p).toBe(`drafts/${'a'.repeat(24)}/20260909143012-xyz123.webm`)
  })

  it('النقل يضع الملفّ تحت صاحبه ويحتفظ باسمه', () => {
    const draft = 'drafts/abc/20260909143012-xyz.m4a'
    expect(finalVoicePath('request', 'r-1', draft)).toBe('requests/r-1/20260909143012-xyz.m4a')
    expect(finalVoicePath('intervenant', 'i-9', draft)).toBe('intervenants/i-9/20260909143012-xyz.m4a')
  })

  it('نوع مجهول لا يعطي امتداداً مخترَعاً', () => {
    expect(draftVoicePath('b'.repeat(24), 'audio/flac', 'q', new Date(0))).toMatch(/\.bin$/)
  })
})

describe('الموضوع والمدّة', () => {
  it('المواضيع الثلاثة وحدها مقبولة', () => {
    expect(isVoiceSubject('request')).toBe(true)
    expect(isVoiceSubject('support_case')).toBe(false)
  })

  it('المدّة تُقرأ بالدقائق لا بالثواني', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7)).toBe('0:07')
    expect(formatDuration(127)).toBe('2:07')
    expect(formatDuration(-3)).toBe('0:00')
  })
})
