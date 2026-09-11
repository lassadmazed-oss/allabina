import { describe, expect, it } from 'vitest'
import {
  NETWORK_PHOTO_KINDS,
  coverSortOrder,
  defaultPhotoKind,
  groupByKind,
  isNetworkPhotoKind,
  networkPhotoPath,
  nextSortOrder,
  photoStrip,
  sortNetworkPhotos,
} from '@/lib/network-photos'

const ph = (id: string, kind: 'work' | 'product', sort_order: number, created_at = '2026-09-01T10:00:00Z') => ({
  id,
  kind,
  sort_order,
  created_at,
})

describe('نوع الصورة', () => {
  it('المزوّد يُعرف بمنتوجاته، والبقيّة بأعمالهم', () => {
    expect(defaultPhotoKind('supplier')).toBe('product')
    for (const family of ['craft', 'technical', 'company', null, undefined]) {
      expect(defaultPhotoKind(family)).toBe('work')
    }
  })

  it('لا يقبل إلّا النوعين', () => {
    for (const k of NETWORK_PHOTO_KINDS) expect(isNetworkPhotoKind(k)).toBe(true)
    expect(isNetworkPhotoKind('video')).toBe(false)
    expect(isNetworkPhotoKind(null)).toBe(false)
  })
})

describe('مسار الملفّ', () => {
  it('<المتدخّل>/<النوع>/<الوقت>-<عشوائي>.<الامتداد>', () => {
    const at = new Date('2026-09-11T08:05:09.123Z')
    expect(networkPhotoPath('abc', 'product', 'image/webp', 'x1y2z3', at)).toBe('abc/product/20260911080509-x1y2z3.webp')
    expect(networkPhotoPath('abc', 'work', 'image/jpeg', 'r', at)).toBe('abc/work/20260911080509-r.jpg')
  })
})

describe('الترتيب والغلاف', () => {
  it('ترتيب الفريق أوّلاً ثمّ الأقدم رفعاً', () => {
    const out = sortNetworkPhotos([
      ph('b', 'work', 1),
      ph('c', 'work', 0, '2026-09-02T00:00:00Z'),
      ph('a', 'work', 0, '2026-09-01T00:00:00Z'),
    ])
    expect(out.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('الغلاف الجديد يسبق الجميع، والصورة الجديدة تلحق بهم', () => {
    expect(coverSortOrder([3, 0, 5])).toBe(-1)
    expect(coverSortOrder([])).toBe(-1)
    expect(nextSortOrder([3, 0, 5])).toBe(6)
    expect(nextSortOrder([])).toBe(0)
  })
})

describe('شريط البطاقة', () => {
  it('الغلاف لا يتكرّر في المصغّرات، والباقي «+N»', () => {
    const photos = [
      ph('p6', 'work', 5),
      ph('p1', 'work', 0),
      ph('p2', 'product', 1),
      ph('p3', 'work', 2),
      ph('p4', 'work', 3),
      ph('p5', 'product', 4),
    ]
    const s = photoStrip(photos)
    expect(s.cover?.id).toBe('p1')
    expect(s.thumbs.map((p) => p.id)).toEqual(['p2', 'p3', 'p4'])
    expect(s.more).toBe(2)
    expect([s.works, s.products]).toEqual([4, 2])
  })

  it('ملفّ بلا صور: لا غلاف ولا مصغّرات', () => {
    expect(photoStrip([])).toEqual({ cover: null, thumbs: [], more: 0, works: 0, products: 0 })
  })
})

describe('التجميع حسب النوع', () => {
  it('نوع العائلة أوّلاً، والنوع الفارغ يُحذف', () => {
    const photos = [ph('w', 'work', 0), ph('p', 'product', 1)]
    expect(groupByKind(photos, 'supplier').map((g) => g.kind)).toEqual(['product', 'work'])
    expect(groupByKind(photos, 'craft').map((g) => g.kind)).toEqual(['work', 'product'])
    expect(groupByKind([ph('w', 'work', 0)], 'supplier').map((g) => g.kind)).toEqual(['work'])
  })
})
