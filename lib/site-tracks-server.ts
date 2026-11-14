import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import { getCurrentStaff } from '@/lib/auth'
import { DEFAULT_HIDDEN, isHidden, parseHidden, type TrackSegment } from '@/lib/site-tracks'

/** المسارات المخبّأة كما في المعطيات المرجعية */
export const getHiddenPaths = cache(async (): Promise<TrackSegment[]> => {
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'site.hidden_paths')
    .maybeSingle()
  // القاعدة لا تجيب؟ نرجع للافتراضي لا نفتح كلّ شيء
  if (error || !data) return DEFAULT_HIDDEN
  return parseHidden(data.value)
})

/**
 * حارس الصفحة المخبّأة.
 *
 * يُستدعى في أعلى كلّ صفحة قابلة للتخبئة. المخبّأ يردّ 404 للزائر —
 * وصفحةٌ تُحذف من القائمة وتبقى تفتح بالعنوان ليست مخبّأة.
 *
 * والفريق يراها: من يقرّر التخبئة يحتاج أن يرى ما خبّأ قبل أن يرجعه.
 */
export async function guardTrack(segment: TrackSegment): Promise<{ preview: boolean }> {
  const hidden = await getHiddenPaths()
  if (!isHidden(segment, hidden)) return { preview: false }
  const staff = await getCurrentStaff()
  if (staff) return { preview: true }
  notFound()
}
