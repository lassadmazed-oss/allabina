import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { DEFAULT_PROFILE, INTAKE_PROFILES, type IntakeProfile } from '@/lib/request-flow'

/**
 * صورة الاستمارة كما تضبطها الإدارة.
 *
 * في القاعدة لا في الشفرة: «نحبّو نظهرو من الأوّل مقاولات» قرارُ صاحب
 * الشركة، ويوم يرجع المسار الاجتماعي يُقلب المفتاح بلا نشر.
 *
 * وقيمة غريبة ترجع للمقاولات لا للكاملة: الانفتاح لا يقع بالغلط.
 */
export const getIntakeProfile = cache(async (): Promise<IntakeProfile> => {
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'intake.profile')
    .maybeSingle()
  if (error || !data) return DEFAULT_PROFILE
  const v = typeof data.value === 'string' ? data.value : ''
  return (INTAKE_PROFILES as string[]).includes(v) ? (v as IntakeProfile) : DEFAULT_PROFILE
})
