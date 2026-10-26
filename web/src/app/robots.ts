import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/** Bet slips under /vaktin/<slug> are private links, so only the landing page is indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/vaktin/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
