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
