import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import nextConfig, { PUBLIC_SEGMENTS } from '../next.config.mjs'
import { requestConfirmationText, statusUpdateText, segmentCount, isPlain, ONE_SEGMENT_PLAIN } from '@/lib/sms'

/**
 * الروابط التي تخرج من المنصّة إلى الناس.
 *
 * عطب حقيقي وُجد يوم 2026-11-09: كلّ رسالة فرنسية كانت تبعث الحريف إلى
 * `allabina.tn/suivi` — نطاق لا وجود له في DNS أصلاً. الرسالة تُرسَل،
 * ويُدفع ثمنها، والحريف يضغط فلا يلقى شيئاً. ولا اختبار يمسك هذا لأنّ
 * النصّ صحيح نحوياً وطوله مقبول.
 *
 * فنختبر الوجهة لا الصياغة: الرابط يلزم يشير إلى مسار موجود فعلاً،
 * وكلّ صفحة عمومية يلزم تُفتح بلا بادئة لغة كما يكتبها الناس.
 */
const SITE_DIR = 'app/(site)/[locale]'

function routeDirs(): string[] {
  return readdirSync(SITE_DIR)
    .filter((n) => statSync(join(SITE_DIR, n)).isDirectory())
    .filter((n) => !n.startsWith('_'))
    .sort()
}

describe('الروابط بلا بادئة لغة', () => {
  it('كلّ صفحة عمومية تُفتح بلا /ar ولا /fr', async () => {
    const sources = (await nextConfig.redirects()).map((r) => r.source)
    const missing = routeDirs().filter(
      (d) => !sources.includes(`/${d}`) || !sources.includes(`/${d}/:rest+`)
    )
    expect(missing, 'زِد المسار في PUBLIC_SEGMENTS داخل next.config.mjs').toEqual([])
  })

  it('كلّ تحويل يذهب إلى اللغة الافتراضية ويحافظ على بقيّة المسار', async () => {
    for (const r of await nextConfig.redirects()) {
      expect(r.destination).toBe(`/ar${r.source}`)
      expect(r.permanent, 'اللغة الافتراضية قد تتبدّل — لا تحويل دائم').toBe(false)
      expect(r.destination.endsWith('/'), 'شرطة أخيرة = قفزة زائدة').toBe(false)
    }
  })

  it('القائمة ما فيهاش مسار ميّت', () => {
    const dirs = routeDirs()
    expect(PUBLIC_SEGMENTS.filter((s) => !dirs.includes(s))).toEqual([])
  })
})

describe('رابط المتابعة في الرسائل القصيرة', () => {
  afterEach(() => vi.unstubAllEnvs())

  const prod = () => vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.allabina.site')

  it('ما عاد يذكر نطاقاً لا وجود له', () => {
    prod()
    for (const t of [requestConfirmationText('LB-2026-000123', 'fr'), statusUpdateText('LB-2026-000123', 'matched', 'fr')!]) {
      expect(t).not.toContain('allabina.tn')
      expect(t).toContain('allabina.site/fr/suivi')
    }
  })

  it('بلا بروتوكول ولا www — محارف الرسالة معدودة', () => {
    prod()
    const t = requestConfirmationText('LB-2026-000123', 'fr')
    expect(t).not.toContain('https://')
    expect(t).not.toContain('www.')
  })

  it('يشير إلى مسار موجود في الشجرة', () => {
    expect(routeDirs()).toContain('suivi')
  })

  it('يتبع النطاق ولا يُكتب بالحرف', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://exemple.test')
    expect(requestConfirmationText('LB-2026-000123', 'fr')).toContain('exemple.test/fr/suivi')
  })

  it('يبقى جزءاً واحداً بالنطاق الحقيقي — الأطول حالةً كذلك', () => {
    prod()
    for (const t of [
      requestConfirmationText('LB-2026-000123', 'fr'),
      statusUpdateText('LB-2026-000123', 'matched', 'fr')!,
      statusUpdateText('LB-2026-000123', 'on_hold', 'fr')!,
    ]) {
      expect(isPlain(t)).toBe(true)
      expect([...t].length).toBeLessThanOrEqual(ONE_SEGMENT_PLAIN)
      expect(segmentCount(t)).toBe(1)
    }
  })

  it('العربية تبقى بلا رابط — 70 محرفاً لا تتحمّل', () => {
    prod()
    const ar = requestConfirmationText('LB-2026-000123', 'ar')
    expect(ar).not.toContain('allabina')
    expect(segmentCount(ar)).toBe(1)
  })
})
