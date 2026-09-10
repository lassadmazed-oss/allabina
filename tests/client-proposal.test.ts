import { describe, expect, it } from 'vitest'
import { buildClientProposal, proposalText } from '@/lib/client-proposal'
import { isPlain, proposalNoticeText, segmentCount } from '@/lib/sms'
import { mouna } from './fixtures/mouna'

const ctx = { refCode: 'LB-2026-000109', locale: 'ar' as const, trackUrl: 'https://www.allabina.site/ar/suivi' }
const all = (p: ReturnType<typeof buildClientProposal>) => p.options.map((o) => o.key)

describe('buildClientProposal', () => {
  it('يبني حلولاً بالعربية من نفس أرقام الحوصلة', () => {
    const p = buildClientProposal(mouna, ctx)
    expect(all(p)).toEqual(expect.arrayContaining(['shrink', 'phased', 'topup', 'permit', 'loan', 'social']))
    expect(p.options.find((o) => o.key === 'shrink')?.text).toContain('104')
    expect(p.greeting).toBe('عسلامة Mouna zoiri،')
    expect(p.intro).toContain('LB-2026-000109')
    expect(p.intro).toContain('صفاقس الجنوبية')
  })

  it('العناوين بلا أرقام ولا مبالغ — صفحة المتابعة تعرضها وحدها', () => {
    for (const locale of ['ar', 'fr'] as const) {
      const p = buildClientProposal(mouna, { ...ctx, locale })
      for (const o of p.options) expect(o.title).not.toMatch(/[\d٠-٩]/)
    }
  })

  it('لا يَعِد ولا يكشف لغة الفريق الداخلية', () => {
    const p = buildClientProposal(mouna, ctx)
    const text = proposalText(p, all(p))
    expect(text).toContain('موش التزام')
    expect(text).toContain('التمويل يرجع للبنك')
    for (const internal of ['A · 87', 'تنقيط', 'صنف', 'مرهون', 'لن يقبله', 'سقف الاستدانة']) {
      expect(text).not.toContain(internal)
    }
  })

  it('يكتب الحلول المختارة وحدها ويعيد ترقيمها بترتيب المقترح', () => {
    const p = buildClientProposal(mouna, ctx)
    const text = proposalText(p, ['loan', 'shrink'])
    expect(text).toContain('1- تصغير المساحة شويّة')
    expect(text).toContain('2- ملفّ القرض')
    expect(text).not.toContain('البناء على مرحلتين')
    expect(text).toContain('هاذي الحلول الممكنة:')
  })

  it('بلا حلول مختارة: لا جملة «هاذي الحلول» معلّقة', () => {
    const p = buildClientProposal(mouna, ctx)
    expect(proposalText(p, [])).not.toContain('هاذي الحلول الممكنة')
  })

  it('الواتساب: العناوين بخطّ غليظ', () => {
    const p = buildClientProposal(mouna, ctx)
    expect(proposalText(p, ['shrink'], { whatsapp: true })).toContain('*1- تصغير المساحة شويّة*')
  })

  it('مطلب بالفرنسية: نصّ فرنسي كامل بلا حرف عربي', () => {
    const p = buildClientProposal(mouna, {
      ...ctx,
      locale: 'fr',
      trackUrl: 'https://www.allabina.site/fr/suivi',
      docsMissing: ['Plans d’architecte', 'Permis de bâtir', 'Attestation de non-propriété'],
    })
    const text = proposalText(p, all(p))
    expect(text.startsWith('Bonjour Mouna zoiri,')).toBe(true)
    expect(text).toContain('Réduire un peu la surface')
    expect(text).not.toMatch(/[؀-ۿ]/)
  })

  it('المرحلتان لا تُقترحان للحريف إن تجاوزت المرحلة الأولى وحدها الميزانية', () => {
    const heavy = { ...mouna, devis: { ...mouna.devis!, lots: [{ code: 4, name: 'الهيكل', total: 130000 }, { code: 14, name: 'الدهن', total: 10395 }] } }
    expect(all(buildClientProposal(heavy, ctx))).not.toContain('phased')
  })

  it('بلا ملفّ مالي ولا عرض: عرض تقديري أوّلاً، بلا قرض ولا ميزانية', () => {
    const p = buildClientProposal({ ...mouna, fin: null, score: null, devis: null }, ctx)
    expect(all(p)).toContain('devis')
    expect(all(p)).not.toContain('loan')
    expect(p.intro).not.toContain('الميزانية')
  })

  it('ملفّ عند البنك: لا نقترح تحضير ملفّ القرض من جديد', () => {
    expect(all(buildClientProposal({ ...mouna, financingState: 'bank_submitted' }, ctx))).not.toContain('loan')
  })
})

describe('proposalNoticeText', () => {
  it('العربية في جزء واحد والفرنسية نصّ بسيط في جزء واحد', () => {
    expect(segmentCount(proposalNoticeText('LB-2026-000109', 'ar'))).toBe(1)
    const frText = proposalNoticeText('LB-2026-000109', 'fr')
    expect(isPlain(frText)).toBe(true)
    expect(segmentCount(frText)).toBe(1)
  })
})
