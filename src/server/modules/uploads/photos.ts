/**
 * Application photographs: the rules, and the pure functions that enforce
 * them. No network, no environment, no database, so all of it is testable
 * (photos.test.ts) and importable from a route handler, a server action, or
 * a script without dragging Supabase in behind it.
 *
 * Why the jury needs this at all: /admin/jury is a contact sheet and
 * ApplicationCard renders `photos[0]` as the plate. An application with no
 * photographs is a card with no work on it, which is a maker being judged on
 * a paragraph. The old path was a line of copy asking makers to email images
 * to one of two addresses, which is not a path at all.
 */

/* ─────────────────────────── the rules ─────────────────────────── */

/**
 * How many. Three is what we ask for, one is what we require.
 *
 * docs/01-PRODUCT-SPEC.md §3.1 asks for five to eight. That is the right
 * number for a maker with a finished catalogue and the wrong number for one
 * shooting on a phone the night applications close, and a form that refuses
 * the second maker loses an application rather than a photograph. So: ask
 * for three to six, take one.
 */
export const MIN_PHOTOS = 1
export const ASK_PHOTOS = 3
export const MAX_PHOTOS = 6

/** Per file. Spec §3.1: "max 10MB each". A modern phone shot is 2-5MB. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/**
 * What a photograph may be. HEIC is on the list because it is what an iPhone
 * produces by default and a maker should not have to convert anything; both
 * of its media types are in the wild, so both are named.
 */
export const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

/** The `accept` attribute for the file input, from the same list. */
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',')

const EXTENSION: Record<PhotoType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export function isPhotoType(value: string): value is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(value)
}

/** Human bytes for a message a maker reads. Whole megabytes, plain hyphen. */
export function mb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/* ───────────────────────── storage keys ─────────────────────────
 *
 * The key carries no personal data and nothing a stranger could guess:
 * no email, no shop name, and never the maker's own filename, which is
 * routinely their legal name or their address. Two random segments, an
 * extension derived from the type we verified, and the show id so a season's
 * uploads can be swept in one prefix.
 */

const KEY = /^applications\/[a-z0-9][a-z0-9-]{0,63}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|heif)$/

export function photoKey(showId: string, batchId: string, fileId: string, type: PhotoType): string {
  return `applications/${showId}/${batchId}/${fileId}.${EXTENSION[type]}`
}

/**
 * Is this a key this application minted? Everything that comes back from a
 * browser goes through here before it is used to build a URL or fetch an
 * object, so a hand-built POST cannot walk out of the prefix, cannot reach a
 * second bucket, and cannot smuggle a `..` past the storage API.
 */
export function isPhotoKey(key: string): boolean {
  return key.length <= 200 && !key.includes('..') && KEY.test(key)
}

/**
 * The `photos` hidden field, as posted by the form: a JSON array of storage
 * keys. Anything that is not a string, not a key we could have minted, or a
 * duplicate is dropped rather than argued with; the count check that follows
 * is what the maker actually sees.
 */
export function parsePhotoKeys(raw: string): string[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw || '[]') } catch { return [] }
  if (!Array.isArray(parsed)) return []
  const out: string[] = []
  for (const item of parsed) {
    if (typeof item !== 'string') continue
    if (!isPhotoKey(item)) continue
    if (out.includes(item)) continue
    out.push(item)
    if (out.length >= MAX_PHOTOS) break
  }
  return out
}

/* ──────────────────────── what is in the file ────────────────────────
 *
 * The client's declared content type is a hint, never a fact: it is set by
 * whichever browser is asking and by anything pretending to be one. The only
 * honest answer comes from the bytes, so every uploaded object is read a few
 * bytes deep on the server before its key is written to an application.
 */

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...b.subarray(at, at + len))

/** HEIF brands that carry a still photograph. */
const HEIF_BRANDS = new Set([
  'heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1',
])

/**
 * The media type of a file, from its leading bytes. Returns null for
 * anything that is not one of the four families we accept, which includes
 * every PDF, zip, script and video somebody might try to park in the bucket.
 * Twenty-four bytes is enough for all of them.
 */
export function sniffPhotoType(head: Uint8Array): PhotoType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e
    && head[3] === 0x47 && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a
    && head[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    return 'image/webp'
  }
  // ISO base media: a 4-byte box length, then 'ftyp', then the brand.
  if (head.length >= 12 && ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4)
    if (HEIF_BRANDS.has(brand)) return brand === 'mif1' || brand === 'msf1' ? 'image/heif' : 'image/heic'
  }
  return null
}

/** How many bytes sniffPhotoType needs. */
export const SNIFF_BYTES = 24
