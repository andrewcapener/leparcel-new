/**
 * Which square a maker is shown by, and where it came from.
 *
 * Three sources, in order:
 *
 *   chosen    staff picked or uploaded one. Always wins.
 *   uploaded  the first photograph the maker sent with their application.
 *   none      nothing yet. The directory draws initials instead.
 *
 * The maker's own photographs are never written over. Choosing a thumbnail
 * sets a separate column, so clearing it hands the maker's first photo back
 * and nothing a maker sent us is ever lost to a staff edit.
 *
 * Pure, so the rule is the same on the public page, the admin grid and any
 * export, and so it can be tested without a database (CLAUDE.md rule 10).
 */

export type ThumbSource = 'chosen' | 'uploaded' | 'none'
export type Thumb = { url: string | null; source: ThumbSource }

/**
 * `applications.photos` is a JSON array of public URLs, and it is read from a
 * text column, so it can be anything: valid JSON, empty, a legacy shape, or
 * corrupt. Nothing here throws, because one bad row must never take down a
 * grid of ninety two makers.
 */
export function parsePhotos(raw: string | null | undefined): string[] {
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

export function thumbnailFor(
  input: { thumbnailUrl?: string | null; photos?: string | null },
): Thumb {
  const chosen = (input.thumbnailUrl ?? '').trim()
  if (chosen) return { url: chosen, source: 'chosen' }
  const [first] = parsePhotos(input.photos)
  return first ? { url: first, source: 'uploaded' } : { url: null, source: 'none' }
}

/** True when nobody has a square for this maker yet, staff or otherwise. */
export function needsThumbnail(
  input: { thumbnailUrl?: string | null; photos?: string | null },
): boolean {
  return thumbnailFor(input).source === 'none'
}

/**
 * Is this a URL we are willing to store and put in an <img src> on our own
 * pages?
 *
 * Only our own storage. Staff paste things, and a thumbnail column that
 * accepts any URL becomes a way to hot-link somebody else's server, to leak
 * a referrer to a third party on every page view, or to point a maker's tile
 * at something nobody here controls. `javascript:` and `data:` are refused
 * for the obvious reason.
 *
 * `base` is the Supabase project URL. Without it configured nothing is
 * accepted, which fails closed rather than open.
 */
export function isOwnPhotoUrl(url: string, base: string | null | undefined): boolean {
  const u = (url ?? '').trim()
  const b = (base ?? '').trim().replace(/\/+$/, '')
  if (!u || !b) return false
  if (!/^https:\/\//i.test(u)) return false
  return u.startsWith(`${b}/storage/v1/object/public/`)
}
