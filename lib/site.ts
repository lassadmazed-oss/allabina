import { LOCALES, type Locale } from './i18n'

/**
 * العنوان الأساسي للموقع. يُضبط في NEXT_PUBLIC_SITE_URL عند النشر
 * (مثال: https://allabina.tn) ويرجع للتطوير المحلّي عند غيابه.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3100')
  return raw.replace(/\/+$/, '')
}

/** روابط اللغات لوسم hreflang */
export function languageAlternates(pathname = ''): Record<string, string> {
  const base = siteUrl()
  return Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${pathname}`]))
}

export const canonicalUrl = (locale: Locale, pathname = '') =>
  `${siteUrl()}/${locale}${pathname}`
