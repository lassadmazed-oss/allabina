import type { MetadataRoute } from 'next'
import { LOCALES } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'

/** الصفحات العلنية فقط — merci و admin خارج الخريطة */
const PAGES = [
  '',
  '/demande',
  '/simulateur',
  '/suivi',
  '/proprietaire',
  '/realisations',
  '/soutien',
  '/confidentialite',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const now = new Date()

  return LOCALES.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${base}/${locale}${page}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${page}`])),
      },
    }))
  )
}
