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

/**
 * جزيرة اتّجاه يسار→يمين بمحارف يونيكود: LRI … PDI.
 * تُستعمل حيث لا نملك عنصر HTML (داخل قوالب الترجمة مثلاً).
 */
export const LRI = '⁦'
export const PDI = '⁩'

/** يعزل ما بداخله في جزيرة LTR مهما كان اتّجاه ما حوله */
export const ltr = (text: string) => `${LRI}${text}${PDI}`

/**
 * مجال «من – إلى».
 *
 * الشرطة بين رقمين محايدة في خوارزمية الاتجاه، والأرقام تؤثّر فيها
 * كأنّها يمين→يسار — فتنقلب الكتلة كلّها داخل نصّ عربي ويُقرأ المجال
 * «2 000 – 1 200»: الحدّ الأعلى يظهر أدنى. الخطأ لا يُرى في الكود ولا
 * في القاعدة، والرقمان صحيحان — المقلوب هو المعنى.
 *
 * العزل هنا لا عند نقطة الاستعمال: من ينسى <bdi> مرّة يشحن مجالاً
 * مقلوباً، والدالّة لا تُنسى.
 */
export function formatRange(min: number, max: number): string {
  return ltr(`${formatNumber(min)} – ${formatNumber(max)}`)
}

/**
 * نسبة مئوية: «92%».
 *
 * علامة % محايدة الاتجاه، وداخل فقرة عربية تنزل يسار الرقم فتُقرأ
 * «%92». قِسنا ذلك فعلاً على شاشة اللوحة: الرقم عند 273 والعلامة عند
 * 262. العزل يثبّتها على يمين الرقم في كلّ سياق، فلا تتبدّل النسبة
 * حسب ما قبلها وما بعدها.
 *
 * تُستعمل للعرض وحده — لا في `style={{ width: '50%' }}`، فتلك CSS
 * لا نصّ، ومحارف العزل تفسدها.
 */
export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—'
  return ltr(`${formatNumber(value, decimals)}%`)
}

/**
 * مبلغ بإشارة: «−12 000 د.ت» / «+3 900 د.ت».
 *
 * في اتّجاه RTL تُعامَل علامة «−» كمحرف محايد، فتلتحق بالسياق العربي وتنزل
 * يمين الأرقام فتُقرأ «12 000−». الحلّ ليس تبديل مكان العلامة بل عزل
 * «الإشارة + الرقم» في جزيرة LTR، ثمّ العملة خارجها بحسب لغة الصفحة.
 */
export function formatSignedMoney(value: number, locale: Locale = 'ar'): string {
  const sign = value < 0 ? '−' : value > 0 ? '+' : ''
  const number = formatNumber(Math.abs(Math.round(value)))
  return `${LRI}${sign}${number}${PDI}${THIN_NBSP}${currencyLabel(locale)}`
}
