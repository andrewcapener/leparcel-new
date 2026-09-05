/**
 * The two things this server does with Supabase Storage: mint a short-lived
 * signed upload URL, and read back enough of an uploaded object to know what
 * it actually is.
 *
 * The bytes never pass through us. A phone photograph is several megabytes
 * and a Server Action that carried six of them would be a request body in the
 * tens of megabytes on a mobile connection, which is slow, hits platform body
 * limits, and fails as one unrecoverable lump rather than one photograph at a
 * time. So the browser uploads straight to Supabase with a URL this server
 * signs, and the server's part of the deal is validation at both ends.
 *
 * Written against the Storage REST API with fetch rather than
 * @supabase/supabase-js: two endpoints, no new dependency, and nothing that
 * needs to reach the browser bundle.
 */
import {
  SNIFF_BYTES, PHOTO_TYPES, isPhotoKey, isPhotoType, sniffPhotoType,
  MAX_PHOTO_BYTES, type PhotoType,
} from './photos'
import { photoUploads, redactUpload, type PhotoUploads } from './config'

/** Signed upload URLs are minted per file and used within minutes. */
const SIGN_TIMEOUT_MS = 8_000
const READ_TIMEOUT_MS = 8_000

function headers(cfg: PhotoUploads): Record<string, string> {
  return { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }
}

/** Percent-encode each path segment; the slashes stay slashes. */
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

/**
 * The stable, cacheable URL for an uploaded photograph. This is what goes in
 * `applications.photos`, because that is what the jury card and the review
 * screen put straight into an `<img src>`. See config.ts for why the bucket
 * is public.
 */
export function publicPhotoUrl(key: string, cfg = photoUploads()): string | null {
  if (!cfg || !isPhotoKey(key)) return null
  return `${cfg.baseUrl}/storage/v1/object/public/${cfg.bucket}/${encodeKey(key)}`
}

/**
 * Create the bucket, once, if it is not there.
 *
 * Setting up uploads used to be two steps in two different places: paste the
 * service role key into Vercel, then remember to make a bucket in Supabase
 * with the right name and the right visibility. The key half is a secret and
 * has to be done by a person. The bucket half is not: the name is ours, the
 * settings are ours, and getting either wrong fails at the moment a maker
 * tries to upload rather than at the moment somebody could fix it. So we make
 * it ourselves, with the limits already applied.
 *
 * Public, because config.ts explains at length why these particular objects
 * are public. Capped at MAX_PHOTO_BYTES and restricted to the image types we
 * accept, so the bucket enforces at the edge what the route and the submit
 * check enforce in code.
 *
 * A 409 means somebody else created it first, which is success. Anything else
 * is reported by the caller that asked for it.
 */
let bucketEnsured = false

async function ensureBucket(cfg: PhotoUploads): Promise<void> {
  if (bucketEnsured) return
  const res = await fetch(`${cfg.baseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: cfg.bucket,
      name: cfg.bucket,
      public: true,
      file_size_limit: MAX_PHOTO_BYTES,
      allowed_mime_types: [...PHOTO_TYPES],
    }),
    signal: AbortSignal.timeout(SIGN_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (res.ok || res.status === 409) {
    bucketEnsured = true
    if (res.ok) console.log(`[uploads] created storage bucket "${cfg.bucket}"`)
    return
  }
  throw new Error(
    redactUpload(`could not create bucket: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`),
  )
}

export type SignedUpload = { key: string; uploadUrl: string; publicUrl: string }

/**
 * A one-shot URL the browser may PUT a single object to. Supabase's signed
 * upload token is bound to this exact key, expires on its own, and cannot be
 * turned into a token for anything else, so handing it to a browser gives
 * away nothing beyond the right to write the object we just named.
 *
 * Throws on failure. Callers turn that into a message a maker can act on and
 * never into a stack trace on screen.
 */
export async function signPhotoUpload(key: string): Promise<SignedUpload> {
  const cfg = photoUploads()
  if (!cfg) throw new Error('Photo uploads are not configured')
  if (!isPhotoKey(key)) throw new Error('Refusing to sign an unrecognised key')

  const sign = () => fetch(
    `${cfg.baseUrl}/storage/v1/object/upload/sign/${cfg.bucket}/${encodeKey(key)}`,
    {
      method: 'POST',
      headers: { ...headers(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(SIGN_TIMEOUT_MS),
      cache: 'no-store',
    },
  )

  let res = await sign()
  // The bucket is created on the first upload of a deployment rather than up
  // front, so that a project which already has one never pays for the call.
  if (res.status === 400 || res.status === 404) {
    const why = await res.clone().text()
    if (/bucket not found/i.test(why)) {
      await ensureBucket(cfg)
      res = await sign()
    }
  }
  if (!res.ok) {
    throw new Error(redactUpload(`sign failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`))
  }
  // { "url": "/object/upload/sign/<bucket>/<key>?token=..." }
  const body = (await res.json()) as { url?: string }
  if (!body.url) throw new Error('sign failed: no url in response')
  const uploadUrl = `${cfg.baseUrl}/storage/v1${body.url.startsWith('/') ? '' : '/'}${body.url}`
  return { key, uploadUrl, publicUrl: publicPhotoUrl(key, cfg)! }
}

export type PhotoCheck =
  | { ok: true; key: string; type: PhotoType; bytes: number }
  | { ok: false; key: string; reason: string }

/**
 * What is actually in the object at `key`.
 *
 * One ranged GET answers both questions at once: `content-range` carries the
 * object's real size, and the first two dozen bytes carry its real format.
 * The content type Supabase stored is the one the uploader declared, so it is
 * checked but never believed on its own.
 */
export async function inspectPhoto(key: string): Promise<PhotoCheck> {
  const cfg = photoUploads()
  if (!cfg) return { ok: false, key, reason: 'uploads not configured' }
  if (!isPhotoKey(key)) return { ok: false, key, reason: 'unrecognised key' }

  let res: Response
  try {
    res = await fetch(`${cfg.baseUrl}/storage/v1/object/${cfg.bucket}/${encodeKey(key)}`, {
      headers: { ...headers(cfg), Range: `bytes=0-${SNIFF_BYTES - 1}` },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (err) {
    return {
      ok: false, key,
      reason: redactUpload(err instanceof Error ? err.message : String(err)),
    }
  }
  if (res.status === 404) return { ok: false, key, reason: 'not uploaded' }
  if (!res.ok && res.status !== 206) return { ok: false, key, reason: `HTTP ${res.status}` }

  // "bytes 0-23/4192304" when the range was honoured; content-length is the
  // whole object when it was not.
  const range = res.headers.get('content-range')
  const total = range?.split('/')[1]
  const bytes = Number(total ?? res.headers.get('content-length') ?? NaN)
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, key, reason: 'no size' }
  }
  if (bytes > MAX_PHOTO_BYTES) return { ok: false, key, reason: 'too large' }

  const head = new Uint8Array(await res.arrayBuffer()).subarray(0, SNIFF_BYTES)
  const type = sniffPhotoType(head)
  if (!type) return { ok: false, key, reason: 'not a photograph' }

  // The stored type only has to agree; the bytes decide. A HEIC saved as
  // image/heif (and the reverse) is the same file, so those two agree.
  const stored = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  const family = (t: string) => (t === 'image/heif' ? 'image/heic' : t)
  if (stored && isPhotoType(stored) && family(stored) !== family(type)) {
    return { ok: false, key, reason: 'not a photograph' }
  }

  return { ok: true, key, type, bytes }
}

/**
 * Every key a maker submitted, checked against what is really in the bucket,
 * in parallel. Returns the keys that hold a real photograph, in the order
 * they were given, because the first one is the lead image on the jury's
 * contact sheet.
 */
export async function verifyPhotoKeys(keys: string[]): Promise<{
  good: string[]
  bad: Array<{ key: string; reason: string }>
}> {
  const checks = await Promise.all(keys.map(inspectPhoto))
  return {
    good: checks.filter((c): c is Extract<PhotoCheck, { ok: true }> => c.ok).map((c) => c.key),
    bad: checks.filter((c): c is Extract<PhotoCheck, { ok: false }> => !c.ok)
      .map(({ key, reason }) => ({ key, reason })),
  }
}
