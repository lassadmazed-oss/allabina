import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  afterWithdraw,
  canPublish,
  looksPrivate,
  missingConsents,
  publicationState,
  type Consents,
} from '@/lib/publication'

/**
 * نشر المشروع بموافقتين.
 *
 * الخطأ هنا لا يُحدث عطباً: ينشر دار إنسانٍ بلا إذنه. ولا يُسترجَع
 * بحذف الصفحة — ما خرج خرج.
 */
const c = (over: Partial<Consents> = {}): Consents => ({
  clientAt: null,
  directionAt: null,
  isPublic: false,
  ...over,
})

describe('الموافقتان شرطان لا واحد', () => {
  it('بلا موافقة: خاصّ', () => {
    expect(publicationState(c())).toBe('private')
    expect(canPublish(c())).toBe(false)
  })

  it('موافقة الحريف وحدها لا تكفي', () => {
    const one = c({ clientAt: '2026-11-15' })
    expect(publicationState(one)).toBe('needs_direction')
    expect(canPublish(one)).toBe(false)
    expect(missingConsents(one)).toEqual(['direction'])
  })

  it('واعتماد الإدارة وحده لا يكفي', () => {
    const one = c({ directionAt: '2026-11-15' })
    expect(publicationState(one)).toBe('needs_client')
    expect(canPublish(one)).toBe(false)
    expect(missingConsents(one)).toEqual(['client'])
  })

  it('والاثنان معاً: جاهز', () => {
    const both = c({ clientAt: '2026-11-15', directionAt: '2026-11-15' })
    expect(publicationState(both)).toBe('ready')
    expect(canPublish(both)).toBe(true)
    expect(missingConsents(both)).toEqual([])
  })
})

describe('سحب الموافقة ينزّل المنشور فورًا', () => {
  const live = c({ clientAt: '2026-11-15', directionAt: '2026-11-15', isPublic: true })

  it('سحب الحريف يُنزله', () => {
    const after = afterWithdraw(live, 'client')
    expect(after.isPublic).toBe(false)
    expect(after.clientAt).toBeNull()
    expect(after.directionAt).toBe('2026-11-15')
  })

  it('وسحب الإدارة كذلك', () => {
    expect(afterWithdraw(live, 'direction').isPublic).toBe(false)
  })

  it('«إمكانية إيقاف النشر» أثرٌ يقع لا طلبٌ يُدرَس', () => {
    expect(publicationState(afterWithdraw(live, 'client'))).toBe('needs_client')
  })
})

describe('ما لا يخرج للعموم', () => {
  it('رقم هاتف في الملخّص يُكتشف', () => {
    expect(looksPrivate('اتصل بالحريف على 98120630')).toBe(true)
    expect(looksPrivate('98 120 630')).toBe(true)
  })

  it('وبريد كذلك', () => {
    expect(looksPrivate('راسلو على ahmed@example.com')).toBe(true)
  })

  it('ونصّ نظيف يمرّ', () => {
    expect(looksPrivate('دار من 140 م² في صفاقس، هيكل وتشطيب.')).toBe(false)
  })
})

/**
 * الشرط في القاعدة لا في الشاشة: شاشةٌ تُنسى، وزرٌّ يُضاف غداً في
 * مكان آخر ينشر بلا أن يمرّ على الفحص.
 */
describe('ما تحرسه القاعدة', () => {
  const sql = readFileSync('supabase/migrations/0071_publication.sql', 'utf8')

  it('قيدٌ يمنع النشر بلا الموافقتين', () => {
    expect(sql).toMatch(/check \(\s*\n?\s*not is_public\s*\n?\s*or \(client_consent_at is not null and publish_approved_at is not null\)/)
  })

  it('والمشروع خاصّ افتراضياً', () => {
    expect(sql).toMatch(/is_public\s+boolean not null default false/)
  })
})
