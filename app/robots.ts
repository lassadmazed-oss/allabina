import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // الـback-office ومسارات الخدمة خارج الفهرسة
        disallow: ['/admin', '/admin/'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
