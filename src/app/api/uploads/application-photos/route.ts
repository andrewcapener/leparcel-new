import { randomUUID } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { activeShow } from '@/db/queries'
import { applicationWindow } from '@/lib/dates'
import { previewingOpenWindow } from '@/lib/preview'
import {
  MAX_PHOTOS, MAX_PHOTO_BYTES, isPhotoType, mb, photoKey,
} from '@/server/modules/uploads/photos'
import { noteUploadFailure, photoUploadsEnabled } from '@/server/modules/uploads/config'
import { signPhotoUpload } from '@/server/modules/uploads/storage'

/**
 * Mints one short-lived signed upload URL, so the browser can send a
 * photograph straight to Supabase Storage. The bytes never touch this server.
 *
 * What this route decides, and the browser does not:
 *
 *  - the storage key. The client never names the object. It gets a key under
 *    this show's prefix with two random segments and an extension derived
 *    from the type, so nothing a maker typed and nothing about who they are
 *    ends up in a public URL.
 *  - whether uploads are open at all. Same window as the application itself,
 *    plus the staff launch-preview cookie, so a rehearsal is possible and a
 *    stranger cannot use the bucket as free file hosting out of season.
 *  - the declared size and type, as a cheap early no. The real check is on
 *    the bytes, at submit, in src/app/actions.ts. A declared content type is
 *    a claim by whatever is asking, and this route treats it as one.
 *
 * The response carries no secret. A signed upload token is bound to the one
 * key it names and expires by itself.
 */

export const dynamic = 'force-dynamic'

/** Best-effort, per instance, and deliberately blunt: this is an unauthenticated
 *  endpoint and a maker uploading six photographs needs six calls. */
const WINDOW_MS = 10 * 60_000
const PER_WINDOW = 90
const seen = new Map<string, { n: number; until: number }>()

function overLimit(ip: string): boolean {
  const now = Date.now()
  if (seen.size > 5_000) {
    for (const [k, v] of seen) if (v.until <= now) seen.delete(k)
  }
  const hit = seen.get(ip)
  if (!hit || hit.until <= now) {
    seen.set(ip, { n: 1, until: now + WINDOW_MS })
    return false
  }
  hit.n += 1
  return hit.n > PER_WINDOW
}

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest) {
  if (!photoUploadsEnabled()) {
    return bad(503, 'Photo uploads are not set up on this deployment.')
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (overLimit(ip)) return bad(429, 'That is a lot of uploads. Give it a minute and try again.')

  let body: { contentType?: unknown; size?: unknown; batchId?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return bad(400, 'Malformed request.')
  }

  const contentType = String(body.contentType ?? '').split(';')[0]!.trim().toLowerCase()
  if (!isPhotoType(contentType)) {
    return bad(415, 'We can take JPEG, PNG, WEBP and HEIC.')
  }

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) return bad(400, 'That file looks empty.')
  if (size > MAX_PHOTO_BYTES) {
    return bad(413, `That photograph is ${mb(size)}. The limit is ${mb(MAX_PHOTO_BYTES)}.`)
  }

  const show = await activeShow()
  if (!show) return bad(503, 'No active show.')
  const open = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt) === 'open'
    || await previewingOpenWindow()
  if (!open) return bad(409, 'Applications are not open for this show.')

  // One folder per form session, so a season's uploads sweep by prefix and
  // an abandoned application's photographs are easy to find. A client-sent
  // value is only ever a folder name, and it is validated as a UUID.
  const batch = String(body.batchId ?? '')
  const batchId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(batch)
    ? batch
    : randomUUID()

  const key = photoKey(show.id, batchId, randomUUID(), contentType)
  try {
    const signed = await signPhotoUpload(key)
    return NextResponse.json({
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
      batchId,
      max: MAX_PHOTOS,
    })
  } catch (err) {
    // Never the key material, never the token, never the maker's filename.
    const why = err instanceof Error ? err.message : String(err)
    console.error('[uploads] could not sign an upload URL:', why)
    // And where an operator will actually look: /api/health.
    noteUploadFailure(why)
    return bad(502, 'We could not start that upload. Try again in a moment.')
  }
}
