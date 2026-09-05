import type { Metadata } from 'next'

/**
 * The public page register.
 *
 * Three visibilities, and the difference is deliberate:
 *
 *   'nav'      linked from the masthead or footer, and in the sitemap.
 *   'unlisted' reachable by URL and nothing else. Not in the sitemap, not in
 *              any nav, and marked noindex so it does not turn up in a search
 *              for "mermade market". This is the shape for a page we hand to
 *              accepted vendors as a link.
 *   'private'  behind the admin gate.
 *
 * Unlisted is not security. Anyone with the link can read it, and links get
 * forwarded, so nothing sensitive to one vendor belongs on one. Per-vendor
 * material belongs behind the login (see the maker portal work).
 */
export type Visibility = 'nav' | 'unlisted' | 'private'

export const PAGES: Array<{ path: string; visibility: Visibility; note: string }> = [
  { path: '/',                visibility: 'nav',      note: 'Home' },
  { path: '/apply',           visibility: 'nav',      note: 'Application' },
  { path: '/schedule',        visibility: 'nav',      note: 'Hours and planning a visit' },
  { path: '/faq',             visibility: 'nav',      note: 'Shopper and maker questions' },
  { path: '/journal',         visibility: 'nav',      note: 'Journal index' },
  { path: '/contact',         visibility: 'nav',      note: 'Contact' },
  { path: '/collaborate',     visibility: 'nav',      note: 'Sponsorships' },
  { path: '/makers/indoor',   visibility: 'nav',      note: 'Indoor maker rules' },
  { path: '/makers/outdoor',  visibility: 'nav',      note: 'Outdoor maker rules' },
]

/** Spread into a page's `metadata` to keep it out of search results. */
export const unlisted: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}
