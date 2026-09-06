import type { MetadataRoute } from 'next'
import { isCanonicalHost, siteUrl } from '@/lib/site-url'

/**
 * Staff pages and the API are never crawled. Unlisted maker pages keep
 * themselves out of the index with a noindex tag rather than by being named
 * here, because robots.txt is public and listing a path advertises it.
 */
export default function robots(): MetadataRoute.Robots {
  // A deployment that is not yet the real domain is closed to crawlers
  // entirely, so the *.vercel.app host never becomes an indexed duplicate of
  // mermademarket.com. Setting SITE_URL opens it. See lib/site-url.ts.
  if (!isCanonicalHost()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
