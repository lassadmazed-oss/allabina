import { describe, expect, it } from 'vitest'
import {
  PROGRESS_STAGES,
  isProgressStage,
  progressSummary,
  requestPhotoPath,
  sortProgress,
  type ProgressStage,
} from '@/lib/request-photos'

const photo = (stage: ProgressStage, taken_at: string | null, created_at = '2026-09-01T10:00:00Z', sort_order = 0) => ({
  stage,
  taken_at,
  created_at,
  sort_order,
})

describe('صور تقدّم الأشغال', () => {
  it('المراحل من الأرض إلى المفتاح', () => {
    expect(PROGRESS_STAGES[0]).toBe('site')
    expect(PROGRESS_STAGES.at(-1)).toBe('handover')
    expect(isProgressStage('roof')).toBe(true)
    expect(isProgressStage('after')).toBe(false)
  })

  it('مسار الملفّ: المطلب/المرحلة/الوقت-عشوائي.امتداد', () => {
    const p = requestPhotoPath('req-1', 'foundations', 'image/webp', 'abc123', new Date('2026-09-11T08:30:15Z'))
    expect(p).toBe('req-1/foundations/20260911083015-abc123.webp')
  })

  it('الترتيب: المرحلة ثمّ الترتيب اليدوي ثمّ التاريخ', () => {
    const sorted = sortProgress([
      photo('roof', '2026-09-10'),
      photo('site', '2026-08-01'),
      photo('foundations', '2026-08-20'),
      photo('foundations', '2026-08-15'),
    ])
    expect(sorted.map((p) => `${p.stage}:${p.taken_at}`)).toEqual([
      'site:2026-08-01',
      'foundations:2026-08-15',
      'foundations:2026-08-20',
      'roof:2026-09-10',
    ])
  })

  it('الغلاف: الأحدث في أبعد مرحلة، والعدّ لكلّ مرحلة', () => {
    const s = progressSummary([
      photo('site', '2026-08-01'),
      photo('structure', '2026-09-01'),
      photo('structure', '2026-09-05'),
      photo('foundations', '2026-09-20'),
    ])
    expect(s.count).toBe(4)
    expect(s.latestStage).toBe('structure')
    expect(s.cover?.taken_at).toBe('2026-09-05')
    expect(s.byStage.structure).toBe(2)
    expect(s.byStage.roof).toBe(0)
  })

  it('بلا صور: لا غلاف ولا مرحلة', () => {
    expect(progressSummary([])).toMatchObject({ count: 0, latestStage: null, cover: null })
  })

  it('صورة بلا تاريخ لقطة تُرتَّب بتاريخ رفعها', () => {
    const s = progressSummary([photo('roof', null, '2026-09-09T12:00:00Z'), photo('roof', '2026-09-01')])
    expect(s.cover?.taken_at).toBeNull()
  })
})
