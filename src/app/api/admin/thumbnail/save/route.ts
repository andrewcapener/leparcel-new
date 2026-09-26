import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/db'
import { applications } from '@/db/schema'
import { ADMIN_COOKIE, isValidSession } from '@/lib/adminAuth'
import { photoUploads } from '@/server/modules/uploads/config'
import { isOwnPhotoUrl } from '@/server/modules/roster/thumbnail'
import { logAudit } from '@/app/admin/thumbnails/log'

/**
 * Store a maker's square, without leaving the page.
 *
 * The same write /admin/thumbnails does through a Server Action, as a route
 * instead, because the lineup board is one large form and a Server Action
 * needs a form of its own. Nested forms are not a thing, and splitting the
 * board into eighty eight forms to allow it would be a worse page.
 *
 * So the board uploads and saves each square on its own, the moment it is
 * picked, and the Save button stays about the order and who is shown.
 *
 * Every rule setThumbnail applies, applies here: staff session only, and the
 * URL has to be one of ours. A column that takes any URL is a way to hot-link
 * somebody else's server or point a maker's tile at something nobody here
 * controls.
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  }

  let body: { applicationId?: unknown; url?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const id = String(body.applicationId ?? '')
  const url = String(body.url ?? '').trim()

  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) return NextResponse.json({ error: 'That maker is no longer there.' }, { status: 404 })

  if (!isOwnPhotoUrl(url, photoUploads()?.baseUrl)) {
    return NextResponse.json(
      { error: 'That picture is not one of ours, so it was not saved.' }, { status: 422 },
    )
  }

  await db.update(applications).set({ thumbnailUrl: url }).where(eq(applications.id, id))
  await logAudit(id, app.thumbnailUrl, url, 'thumbnail set from the lineup board')

  /* The page the square actually appears on, and the two staff screens that
     show it. */
  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/thumbnails')

  return NextResponse.json({ url })
}
