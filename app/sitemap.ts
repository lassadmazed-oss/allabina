import type { MetadataRoute } from 'next'
import { LOCALES } from '@/lib/i18n'
import { siteUrl } from '@/lib/site'
import { catalogOpen, getPublicArticleCodes } from '@/lib/catalog-server'
import { getHiddenPaths } from '@/lib/site-tracks-server'
import { isHidden } from '@/lib/site-tracks'

/**
 * الخريطة تُبنى عند الطلب لا عند البناء: المقال يُنشر ويُسحب من اللوحة،
 * وخريطةٌ مجمَّدة في البناء تَعِد بصفحاتٍ سُحبت أو تُخفي ما نُشر.
 */
export const dynamic = 'force-dynamic'

/** الصفحات العلنية فقط — merci و admin خارج الخريطة */
const PAGES = [
  '',
  '/catalogue',
  '/chantiers',
  '/demande',
  '/projet',
  '/simulateur',
  '/standing',
  '/systemes',
  '/suivi',
  '/a-propos',
  '/proprietaire',
  '/reseau',
  '/realisations',
  '/soutien',
  '/soutien/demande',
  '/confidentialite',
  '/mentions-legales',
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const now = new Date()

  const entry = (path: string, priority: number) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${base}/${l}${path.replace(/^\/[a-z]{2}/, '')}`])
      ),
    },
  })

  // المخبّأ لا يدخل الخريطة: لا نَعِد محرّكات البحث بصفحات تردّ 404
  const hidden = await getHiddenPaths()
  const pages = LOCALES.flatMap((locale) =>
    PAGES.filter((page) => !isHidden(page, hidden)).map((page) =>
      entry(`/${locale}${page}`, page === '' ? 1 : 0.7)
    )
  )

  // بطاقات المقالات: لا تدخل الخريطة إلّا والكاتالوج مفتوح — وإلّا
  // وعدنا محرّكات البحث بصفحات تردّ 404
  if (!(await catalogOpen())) return pages

  const codes = await getPublicArticleCodes()
  const articles = LOCALES.flatMap((locale) =>
    codes.map((code) => entry(`/${locale}/catalogue/${encodeURIComponent(code)}`, 0.5))
  )

  return [...pages, ...articles]
}
