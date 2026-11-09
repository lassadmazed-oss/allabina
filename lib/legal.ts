import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/supabase/server'
import { EMPTY_IDENTITY, type LegalIdentity, type PlatformContact } from '@/lib/contact'

export { legalInLocale, telHref, waHref } from '@/lib/contact'
export type { LegalIdentity, PlatformContact } from '@/lib/contact'

/**
 * هويّة الشركة القانونية وقنوات الاتّصال — مصدر واحد لكلّ الموقع.
 *
 * القاعدة لا الشفرة: العنوان يتبدّل، والرقم يتبدّل، ورأس المال يتبدّل،
 * وكلّها تتبدّل من «المعطيات المرجعية» بلا إعادة نشر. والشفرة ما تعرفش
 * القيم، تعرف كيفاش تعرضها.
 *
 * `cache` من React: الذيل يظهر في كلّ صفحة، فبلا تخزين تصير قراءة لكلّ
 * مكوّن يطلبها في نفس الطلب.
 */
const LEGAL_KEYS = [
  'legal.name_ar',
  'legal.name_fr',
  'legal.form_ar',
  'legal.form_fr',
  'legal.unique_id',
  'legal.register_no',
  'legal.capital_tnd',
  'legal.activity_code',
  'legal.activity_ar',
  'legal.activity_fr',
  'legal.address_ar',
  'legal.address_fr',
  'legal.published_on',
  'legal.activity_since',
  'legal.manager',
  'legal.rne_verify_url',
] as const

const CONTACT_KEYS = ['contact.phone', 'contact.whatsapp', 'contact.email', 'contact.hours'] as const

async function readSettings(keys: readonly string[]): Promise<Map<string, unknown>> {
  const { data, error } = await db.from('app_settings').select('key, value').in('key', [...keys])
  if (error) {
    console.error('app_settings read', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((r) => [r.key as string, r.value]))
}

const str = (m: Map<string, unknown>, k: string) => {
  const v = m.get(k)
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

export const getLegalIdentity = cache(async (): Promise<LegalIdentity> => {
  const m = await readSettings(LEGAL_KEYS)
  if (m.size === 0) return EMPTY_IDENTITY
  const capital = m.get('legal.capital_tnd')
  return {
    nameAr: str(m, 'legal.name_ar'),
    nameFr: str(m, 'legal.name_fr'),
    formAr: str(m, 'legal.form_ar'),
    formFr: str(m, 'legal.form_fr'),
    uniqueId: str(m, 'legal.unique_id'),
    registerNo: str(m, 'legal.register_no'),
    capitalTnd: typeof capital === 'number' && Number.isFinite(capital) ? capital : null,
    activityCode: str(m, 'legal.activity_code'),
    activityAr: str(m, 'legal.activity_ar'),
    activityFr: str(m, 'legal.activity_fr'),
    addressAr: str(m, 'legal.address_ar'),
    addressFr: str(m, 'legal.address_fr'),
    publishedOn: str(m, 'legal.published_on'),
    activitySince: str(m, 'legal.activity_since'),
    manager: str(m, 'legal.manager'),
    verifyUrl: str(m, 'legal.rne_verify_url'),
  }
})

export const getPlatformContact = cache(async (): Promise<PlatformContact> => {
  const m = await readSettings(CONTACT_KEYS)
  return {
    phone: str(m, 'contact.phone'),
    whatsapp: str(m, 'contact.whatsapp'),
    email: str(m, 'contact.email'),
    hours: str(m, 'contact.hours'),
  }
})
