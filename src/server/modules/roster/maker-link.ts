/**
 * Where a maker's tile sends a shopper.
 *
 * Three answers in order: what staff set, then the website she gave us, then
 * her Instagram handle. Null means the tile is not a link at all, which is
 * better than a link that goes nowhere.
 *
 * Staff type these by hand into a field that ends up as an href on a public
 * page, so the cleaning here is not tidiness. A link is the one thing on this
 * page that takes a shopper somewhere, and "somewhere" must never be a
 * javascript: URL or a protocol nobody expected.
 */

/**
 * A URL safe to put in an href, or null.
 *
 * Only http and https. Everything else is refused rather than repaired:
 * javascript:, data:, vbscript: and file: all belong to attacks or accidents,
 * and none of them is what somebody meant to type.
 *
 * A bare domain is assumed to be https, because that is what a person means
 * when they type mermademarket.com, and refusing it would just teach them to
 * paste something worse.
 */
export function cleanLinkUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  /* Before anything else: a scheme we do not allow, however it is spelled.
     Whitespace and control characters inside a scheme are legal to a browser
     and are the classic way "java\nscript:" slips past a naive check. */
  const bare = t.replace(/[\s\u0000-\u001F\u007F]/g, '').toLowerCase()
  if (/^[a-z][a-z0-9+.-]*:/.test(bare) && !/^https?:/.test(bare)) return null
  /* Protocol relative. A browser reads //evil.com as a URL; a person almost
     never means one. */
  if (t.startsWith('//')) return null

  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let u: URL
  try { u = new URL(withScheme) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  /* A host with no dot is not a public site: localhost, an intranet name, or
     a typo. None of them belongs on a page shoppers read. */
  if (!u.hostname.includes('.')) return null
  return u.toString()
}

/** The Instagram handle as a URL, or null. Accepts it with or without the @. */
export function instagramUrl(handle: string | null | undefined): string | null {
  const h = (handle ?? '').trim().replace(/^@/, '')
  if (!h) return null
  /* Sometimes a whole URL is pasted into the handle field. Take it as one. */
  if (/^https?:\/\//i.test(h) || h.includes('instagram.com')) return cleanLinkUrl(h)
  if (!/^[A-Za-z0-9._]+$/.test(h)) return null
  return `https://instagram.com/${h}`
}

/**
 * The link for one maker's tile: the staff override, then her website, then
 * her Instagram, then nothing.
 */
export function makerLink(m: {
  linkUrl?: string | null
  website?: string | null
  instagram?: string | null
}): string | null {
  return cleanLinkUrl(m.linkUrl)
    ?? cleanLinkUrl(m.website)
    ?? instagramUrl(m.instagram)
}
