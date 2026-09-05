import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * Staff pages and the API are never crawled. Unlisted vendor pages keep
 * themselves out of the index with a noindex tag rather than by being named
 * here, because robots.txt is public and listing a path advertises it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
