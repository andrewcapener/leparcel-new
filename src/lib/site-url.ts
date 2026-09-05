/**
 * The canonical origin for absolute URLs (sitemap, robots, email links).
 *
 * Order: an explicit SITE_URL wins, then the domain Vercel says this
 * deployment serves, then localhost. Never hardcode the production domain
 * in a page — pointing mermademarket.com at Vercel should not need a code
 * change.
 */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}

/**
 * Whether this deployment is the real site, or a Vercel URL standing in for it.
 *
 * SITE_URL is set by hand, once, when the domain is pointed here. Until then
 * every absolute URL we emit names a *.vercel.app host, and that is a problem
 * with teeth: a canonical tag is an assertion that the URL inside it is the
 * real one. Let Google index this deployment now and mermade.vercel.app
 * becomes an indexed duplicate that competes with mermademarket.com from the
 * day the domain moves, with our own canonicals vouching for the wrong host.
 *
 * So indexing is tied to the same switch as the URLs. No SITE_URL means a
 * stand-in, which is noindex; setting SITE_URL makes the canonicals right and
 * opens the site to crawlers in the same move. One thing to remember instead
 * of two, and the two cannot get out of step.
 */
export function isCanonicalHost(): boolean {
  return Boolean(process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)
}
