import type { IconName } from '@/components/Icon'
import type { Locale } from '@/lib/i18n'

/**
 * أنواع المطلب — الاسم والإيكونة، في موضع واحد.
 *
 * كانت القائمة مكتوبةً في صفحة اللوحة وحدها، فأيّ شاشة أخرى تحتاجها
 * تنسخها — ونسختان تفترقان بلا أن يُلاحَظ: تُضاف قيمة في القاعدة فتظهر
 * باسمها الخام في شاشة وباسمها العربي في أخرى.
 *
 * والقيمة المجهولة ترجع نفسها لا «أخرى»: نوعٌ جديد يُرى فيُسمّى، و«أخرى»
 * تبتلعه فيبقى مجهولاً.
 */
export const REQUEST_TYPES = [
  'build_on_land',
  'land_and_house',
  'apartment',
  'economic',
  'rent_to_own',
  'renovation',
  'other',
] as const

export type RequestType = (typeof REQUEST_TYPES)[number]

const AR: Record<RequestType, string> = {
  build_on_land: 'بناء فوق أرض',
  land_and_house: 'أرض وبناء',
  apartment: 'شقّة',
  economic: 'سكن اقتصادي',
  rent_to_own: 'إيجار منتهٍ بالتمليك',
  renovation: 'ترميم ولّا توسعة',
  other: 'مشروع آخر',
}

const FR: Record<RequestType, string> = {
  build_on_land: 'Construction sur terrain',
  land_and_house: 'Terrain et construction',
  apartment: 'Appartement',
  economic: 'Logement économique',
  rent_to_own: 'Location-vente',
  renovation: 'Rénovation ou extension',
  other: 'Autre projet',
}

export const REQUEST_TYPE_ICON: Record<RequestType, IconName> = {
  build_on_land: 'home',
  land_and_house: 'map',
  apartment: 'building',
  economic: 'home',
  rent_to_own: 'building',
  renovation: 'wrench',
  other: 'folder',
}

export const requestTypeName = (code: string, locale: Locale = 'ar'): string =>
  (locale === 'fr' ? FR : AR)[code as RequestType] ?? code

export const requestTypeIcon = (code: string): IconName =>
  REQUEST_TYPE_ICON[code as RequestType] ?? 'folder'
