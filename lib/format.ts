import type { Locale } from './i18n'

/**
 * تنسيق الأرقام — قاعدة واحدة لكلّ المنصة.
 *
 * الفاصل بين الآلاف لازم يكون فراغاً ضيّقاً غير فاصل (U+202F) لا فراغاً عادياً:
 * الفراغ العادي محايد في خوارزمية الاتجاه ثنائي اللغة، فيقطع «91 733» إلى رقمين
 * منفصلين ويقلب ترتيبهما داخل نصّ عربي فيظهران «733 91». أمّا U+202F فمصنَّف
 * فاصل أرقام (CS) فيبقى الرقم كتلة واحدة في العربية والفرنسية معاً.
 */
export const THIN_NBSP = '\u202F'

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(value)
    .replace(/,/g, THIN_NBSP)
}

export const currencyLabel = (locale: Locale = 'ar') => (locale === 'fr' ? 'DT' : 'د.ت')

/** مبلغ بالدينار: «91 733 د.ت» / « 91 733 DT » */
export function formatMoney(value: number, locale: Locale = 'ar'): string {
  return `${formatNumber(Math.round(value))}${THIN_NBSP}${currencyLabel(locale)}`
}

/** سعر المتر المربّع: «1 200 د/م²» / « 1 200 DT/m² » */
export const perM2Label = (locale: Locale = 'ar') => (locale === 'fr' ? 'DT/m²' : 'د/م²')

/** وحدة المساحة حسب اللغة */
export const areaLabel = (locale: Locale = 'ar') => (locale === 'fr' ? 'm²' : 'م²')

/** مجال «من – إلى» — يُلفّ في <bdi dir="ltr"> عند العرض حتى لا ينقلب */
export function formatRange(min: number, max: number): string {
  return `${formatNumber(min)} – ${formatNumber(max)}`
}
