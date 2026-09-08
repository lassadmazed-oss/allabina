import { describe, expect, it } from 'vitest'
import {
  INTERVENANT_STATUSES,
  canTransition,
  isActiveInNetwork,
  isStatus,
  nextStatuses,
} from '@/lib/network'
import { intervenantSchema } from '@/lib/network-schema'

describe('مسار اعتماد المتدخّل', () => {
  it('التسجيل لا يعني الاعتماد: لا قفز من «جديد» إلى «معتمَد»', () => {
    expect(canTransition('new', 'validated')).toBe(false)
    expect(canTransition('to_verify', 'validated')).toBe(false)
    expect(canTransition('docs_missing', 'validated')).toBe(false)
  })

  it('الاعتماد لا يأتي إلّا بعد تحقّق', () => {
    expect(canTransition('verified', 'validated')).toBe(true)
    // والمسار الكامل من التسجيل إلى الشبكة يمرّ بكلّ محطّة
    expect(canTransition('new', 'to_verify')).toBe(true)
    expect(canTransition('to_verify', 'verified')).toBe(true)
  })

  it('الملفّ المعلَّق يعود أو يُرفض، ولا يقفز إلى «تمّ التحقّق»', () => {
    expect(canTransition('suspended', 'validated')).toBe(true)
    expect(canTransition('suspended', 'rejected')).toBe(true)
    expect(canTransition('suspended', 'verified')).toBe(false)
  })

  it('لا انتقال من حالة إلى نفسها', () => {
    for (const s of INTERVENANT_STATUSES) expect(canTransition(s, s)).toBe(false)
  })

  it('كلّ حالة لها مخرج — لا ملفّ يعلق بلا إجراء', () => {
    for (const s of INTERVENANT_STATUSES) expect(nextStatuses(s).length).toBeGreaterThan(0)
  })

  it('المعتمَد وحده في الشبكة', () => {
    expect(isActiveInNetwork('validated')).toBe(true)
    for (const s of INTERVENANT_STATUSES.filter((x) => x !== 'validated')) {
      expect(isActiveInNetwork(s)).toBe(false)
    }
  })

  it('isStatus يرفض ما ليس حالة', () => {
    expect(isStatus('validated')).toBe(true)
    expect(isStatus('approved')).toBe(false)
    expect(isStatus(null)).toBe(false)
  })
})

const base = {
  fullName: 'محمد التريكي',
  phone: '98 123 456',
  categoryId: '4',
  legalStatus: 'patente',
  govCode: 'SFX',
  consent: true,
}

describe('استمارة الانضمام إلى الشبكة', () => {
  it('تقبل الحدّ الأدنى وتنظّف الهاتف', () => {
    const r = intervenantSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.phone).toBe('98123456')
      expect(r.data.categoryId).toBe(4)
      expect(r.data.availability).toBe('available')
    }
  })

  it('ترفض بلا موافقة — الموافقة شرط لا خانة زينة', () => {
    expect(intervenantSchema.safeParse({ ...base, consent: false }).success).toBe(false)
  })

  it('ترفض بلا اختصاص: الشبكة لا معنى لها بلا مهنة', () => {
    const { categoryId, ...noCat } = base
    expect(intervenantSchema.safeParse(noCat).success).toBe(false)
  })

  it('ترفض هاتفاً غير صالح', () => {
    expect(intervenantSchema.safeParse({ ...base, phone: '12' }).success).toBe(false)
    expect(intervenantSchema.safeParse({ ...base, phone: 'تسعين' }).success).toBe(false)
  })

  it('لا وضعية مهنية تُقصي صاحبها — كلّها مقبولة', () => {
    for (const s of ['independent', 'worker', 'patente', 'company', 'engineer', 'other']) {
      expect(intervenantSchema.safeParse({ ...base, legalStatus: s }).success).toBe(true)
    }
  })

  it('تقرأ قوائم المهارات والمناطق وتزيل التكرار وما ليس رقماً', () => {
    const r = intervenantSchema.safeParse({
      ...base,
      skillIds: ['3', '7', '3', 'x', ''],
      zoneDelegationIds: ['1', '2'],
      extraCategoryIds: ['9'],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.skillIds).toEqual([3, 7])
      expect(r.data.zoneDelegationIds).toEqual([1, 2])
      expect(r.data.extraCategoryIds).toEqual([9])
    }
  })

  it('سنوات الخبرة ونصف القطر اختياريان ويتسامحان مع طريقة الكتابة', () => {
    const r = intervenantSchema.safeParse({ ...base, yearsExperience: '١٢', radiusKm: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.yearsExperience).toBe(12)
      expect(r.data.radiusKm).toBeNull()
    }
  })

  it('ترفض خبرة خارج المعقول', () => {
    expect(intervenantSchema.safeParse({ ...base, yearsExperience: '120' }).success).toBe(false)
  })

  it('«متوفّر ابتداءً من» بتاريخ صالح فقط', () => {
    const ok = intervenantSchema.safeParse({
      ...base,
      availability: 'available_from',
      availableFrom: '2026-11-01',
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.availableFrom).toBe('2026-11-01')

    expect(
      intervenantSchema.safeParse({ ...base, availableFrom: '01/11/2026' }).success
    ).toBe(false)
  })
})
