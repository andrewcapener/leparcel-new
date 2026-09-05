import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'
import { PAGES } from '@/lib/pages'
import { journal } from '@/lib/journal'

/**
 * Only the pages we navigate to. Anything marked 'unlisted' in the register
 * is deliberately absent: a sitemap is a published list, and the point of an
 * unlisted page is that it reaches people by the link we send them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const pages = PAGES.filter((p) => p.visibility === 'nav').map((p) => ({
    url: `${base}${p.path}`,
    changeFrequency: 'weekly' as const,
    priority: p.path === '/' ? 1 : 0.7,
  }))
  const posts = journal.map((p) => ({
    url: `${base}/journal/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'yearly' as const,
    priority: 0.4,
  }))
  return [...pages, ...posts]
}
