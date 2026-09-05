import type { NextConfig } from 'next'

/**
 * Redirects from the Shopify site this replaces.
 *
 * Every URL Google has indexed for mermademarket.com is a Shopify one:
 * thirteen `/pages/...` pages and a blog at `/blogs/journal/...`. None of
 * those paths exist here, so without this file the cutover would 404 the
 * entire indexed site at once. That loses the ranking each page has earned
 * since 2015, and it breaks every link pointing at them from outside: the
 * Instagram bio, press write-ups, other markets' vendor lists, and the emails
 * Mermade has already sent to a few hundred makers.
 *
 * 308 (permanent) rather than 307, because these moves are permanent and a
 * permanent redirect is what passes ranking to the new URL. `permanent: true`
 * is Next's spelling of that.
 *
 * Only paths that really existed are listed. A catch-all sending anything
 * under /pages to the home page would turn a typo into a soft 404, which
 * Google treats worse than an honest one.
 */

const PAGES: Array<[string, string]> = [
  ['faq', '/faq'],
  ['contact', '/contact'],
  ['schedule', '/schedule'],
  ['collaborate', '/collaborate'],
  ['sponsorships', '/sponsorships'],
  ['merchant-application', '/apply'],
  // The old form's confirmation page. Anyone reaching it now wants the form.
  ['thank-you', '/apply'],
  ['indoor-merchants', '/makers/indoor'],
  ['outdoor-merchants', '/makers/outdoor'],
  ['indoor-lookbook', '/lookbook/indoor'],
  ['outdoor-lookbook', '/lookbook/outdoor'],
  // A season-specific roster. The roster page is the living version of it.
  ['spring-2026-merchants', '/merchants'],
  // A one-off notice to shoppers about a venue change, long past.
  ['update-to-shopper', '/'],
]

const config: NextConfig = {
  async redirects() {
    return [
      ...PAGES.map(([from, destination]) => ({
        source: `/pages/${from}`,
        destination,
        permanent: true,
      })),
      // The journal kept its slugs, so every post redirects by name.
      { source: '/blogs/journal/:slug', destination: '/journal/:slug', permanent: true },
      { source: '/blogs/journal', destination: '/journal', permanent: true },
      { source: '/blogs/news/:slug', destination: '/journal/:slug', permanent: true },
      { source: '/blogs/:blog', destination: '/journal', permanent: true },
    ]
  },
}

export default config
