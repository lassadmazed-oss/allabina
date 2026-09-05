import { describe, expect, it } from 'vitest'
import {
  CONTRIBUTION_KINDS,
  LEDGER_EVENTS,
  PUBLIC_PLEDGE_KINDS,
  isPublicPledgeKind,
  needsProgress,
} from '@/lib/support'
import { dictionaries } from '@/lib/i18n'

const { ar, fr } = dictionaries

describe('أنواع المساهمة المفتوحة للعموم', () => {
  it('لا تقبل تعهّداً مالياً — المنصة لا تجمع أموالاً', () => {
    expect(isPublicPledgeKind('funding')).toBe(false)
    expect(PUBLIC_PLEDGE_KINDS).not.toContain('funding')
  })

  it('تقبل المساهمات العينية', () => {
    for (const k of ['materials', 'labour', 'study', 'land', 'admin_support', 'other']) {
      expect(isPublicPledgeKind(k)).toBe(true)
    }
  })

  it('ترفض ما ليس في القائمة أصلاً', () => {
    expect(isPublicPledgeKind('')).toBe(false)
    expect(isPublicPledgeKind('cash')).toBe(false)
    expect(isPublicPledgeKind('FUNDING')).toBe(false)
  })

  it('هي كلّ الأنواع ناقص التمويل', () => {
    expect(PUBLIC_PLEDGE_KINDS.length).toBe(CONTRIBUTION_KINDS.length - 1)
  })
})

describe('تقدّم الحاجيات بالأعداد لا بالدنانير', () => {
  it('يحسب النسبة من عدد الحاجيات', () => {
    expect(needsProgress(5, 3)).toEqual({ total: 5, done: 3, percent: 60 })
    expect(needsProgress(4, 4)).toEqual({ total: 4, done: 4, percent: 100 })
  })

  it('لا يتجاوز المجموع مهما جاءت الأرقام', () => {
    expect(needsProgress(2, 7)).toEqual({ total: 2, done: 2, percent: 100 })
  })

  it('حالة بلا حاجيات لا تُقسّم على صفر', () => {
    expect(needsProgress(0, 0)).toEqual({ total: 0, done: 0, percent: 0 })
    expect(needsProgress(0, 3)).toEqual({ total: 0, done: 0, percent: 0 })
  })

  it('يعامل الأرقام السالبة كصفر', () => {
    expect(needsProgress(-3, -1)).toEqual({ total: 0, done: 0, percent: 0 })
  })
})

describe('ترجمة وحدة المساندة', () => {
  it('لكلّ حدث في القاعدة تسمية في اللغتين', () => {
    for (const e of LEDGER_EVENTS) {
      expect(ar.soutien.events[e], `ar:${e}`).toBeTruthy()
      expect(fr.soutien.events[e], `fr:${e}`).toBeTruthy()
    }
  })

  it('لكلّ نوع مساهمة تسمية في اللغتين', () => {
    for (const k of CONTRIBUTION_KINDS) {
      expect(ar.soutien.kinds[k], `ar:${k}`).toBeTruthy()
      expect(fr.soutien.kinds[k], `fr:${k}`).toBeTruthy()
    }
  })

  it('نصّ التقدّم يحمل المتغيّرين في اللغتين', () => {
    for (const d of [ar, fr]) {
      expect(d.soutien.progressLabel).toContain('{done}')
      expect(d.soutien.progressLabel).toContain('{total}')
    }
  })

  it('الصفحة العمومية تعلن أنّ المنصة لا تجمع أموالاً', () => {
    expect(ar.soutien.noMoneyNote).toBeTruthy()
    expect(fr.soutien.noMoneyNote).toBeTruthy()
  })
})
