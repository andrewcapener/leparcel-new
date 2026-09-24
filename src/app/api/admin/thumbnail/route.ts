import { randomUUID } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidSession } from '@/lib/adminAuth'
import { activeShow } from '@/db/queries'
import {
  MAX_PHOTO_BYTES, isPhotoType, mb, photoKey,
} from '@/server/modules/uploads/photos'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { signPhotoUpload } from '@/server/modules/uploads/storage'

/**
 * A signed upload URL for a staff member replacing a maker's square.
 *
 * Deliberately separate from /api/uploads/application-photos. That route is
 * open to the public and is gated on the application window being open, which
 * is exactly right for a maker applying and exactly wrong here: Elise fixes
 * thumbnails months after applications close, and widening the public route's
 * window to let her would reopen the bucket to strangers out of season.
 *
 * So this one is gated on the admin session instead, and on nothing else.
 *
 * The key is named here, never by the browser, same as the public route: two
 * random segments under this show's prefix, with the extension derived from
 * the declared type. Nothing a person typed reaches a public URL.
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  }
  if (!photoUploadsEnabled()) {
    return NextResponse.json(
      { error: 'Photo uploads are not configured on this deployment.' }, { status: 503 },
    )
  }

  const show = await activeShow()
  if (!show) return NextResponse.json({ error: 'No active show.' }, { status: 409 })

  let body: { contentType?: unknown; size?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }) }

  const contentType = String(body.contentType ?? '')
  const size = Number(body.size ?? 0)

  /* Both are claims by whatever is asking, and are treated as claims: this is
     a cheap early no, not the real check. */
  if (!isPhotoType(contentType)) {
    return NextResponse.json({ error: 'We can take JPEG, PNG, WebP or HEIC.' }, { status: 415 })
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: `Keep it under ${mb(MAX_PHOTO_BYTES)}.` }, { status: 413 },
    )
  }

  try {
    const key = photoKey(show.id, randomUUID(), randomUUID(), contentType)
    const { uploadUrl, publicUrl } = await signPhotoUpload(key)
    return NextResponse.json({ uploadUrl, publicUrl })
  } catch {
    /* Never the exception text: it carries storage detail and, on some paths,
       a signed token (CLAUDE.md rule 9). */
    return NextResponse.json({ error: 'We could not start that upload.' }, { status: 502 })
  }
}
