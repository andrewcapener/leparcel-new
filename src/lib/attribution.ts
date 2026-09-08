/**
 * Where an applicant came from, recorded by us rather than by the ad platform.
 *
 * Meta reports the conversions it believes it caused, and that number is
 * generous by construction: it counts a view-through a week earlier as its
 * doing. When the question is "was the $20 a day worth it", the answer has to
 * come from a count nobody is selling us.
 *
 * So the apply page reads its own query string and the application carries the
 * answer. Three signals, in order of how much they can be trusted:
 *
 *   fbclid    Meta's click id. Present on every click from a Meta ad and on
 *             nothing else, so it is the one signal that cannot be faked by
 *             accident. It is not stored, only the fact that it was there.
 *   utm_*     What we put on the ad link ourselves.
 *   referrer  A last resort for links we did not tag.
 *
 * Everything here is attacker-controlled: it arrives in a url anybody can
 * type. It is length capped and stripped to a small character set before it is
 * stored, because it lands in a database column and renders in the admin.
 */

/** Letters, digits and a few separators. Nothing that could be markup. */
const SAFE = /[^a-zA-Z0-9._\-/| ]/g

function clean(v: string | null | undefined, max = 40): string {
  return (v ?? '').replace(SAFE, '').trim().slice(0, max)
}

/**
 * Read the query string into one compact, storable string.
 *
 * Shaped `source/medium/campaign/content`, empty segments dropped, so
 * "meta/paid/fall26_applications/warm" reads at a glance in a table and still
 * splits on a slash when somebody wants to group by it.
 */
export function attributionFrom(search: string, referrer = ''): string {
  const q = new URLSearchParams(search)

  const utm = [
    clean(q.get('utm_source')),
    clean(q.get('utm_medium')),
    clean(q.get('utm_campaign'), 60),
    clean(q.get('utm_content')),
  ].filter(Boolean)

  if (utm.length) return utm.join('/').slice(0, 160)

  /* A Meta click with no tags on it. Worth catching: it is exactly what
     happens when somebody shares the ad's link onward, or when a placement
     strips the query we set. */
  if (q.get('fbclid')) return 'meta/paid/untagged'

  /* Nothing in the url. Fall back to who sent them, host only: a full referrer
     can carry a search query, which is somebody else's private text. */
  if (referrer) {
    try {
      const h = new URL(referrer).hostname.replace(/^www\./, '')
      if (h && !h.endsWith('mermademarket.com')) return `referral/${clean(h, 60)}`
    } catch { /* not a url we can read */ }
  }

  return ''
}

/** How it reads in the admin. */
export function attributionLabel(value: string): string {
  if (!value) return 'Direct'
  const [source, , , content] = value.split('/')
  if (source === 'meta') return content ? `Meta ad (${content})` : 'Meta ad'
  if (source === 'referral') return `Link from ${value.split('/')[1]}`
  return value
}

/**
 * Re-clean a value that has already been through attributionFrom once.
 *
 * The browser posts it back in a hidden field, and a posted value is a posted
 * value: somebody can put anything there. Same character set and same caps as
 * the original parse, applied to the whole string.
 */
export function cleanAttribution(value: string): string {
  return value.replace(SAFE, '').trim().slice(0, 160)
}
