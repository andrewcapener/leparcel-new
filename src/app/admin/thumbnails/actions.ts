'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { applications } from '@/db/schema'
import { photoUploads } from '@/server/modules/uploads/config'
import { isOwnPhotoUrl, parsePhotos } from '@/server/modules/roster/thumbnail'
import { logAudit } from './log'
import { backTo } from './back'

/**
 * Set the square a maker is shown by.
 *
 * The URL has to be one of ours. Staff paste things, and a column that takes
 * any URL is a way to hot-link somebody else's server, leak a referrer on
 * every page view, or point a maker's tile at something nobody here controls.
 * It must also be a real photograph we hold: either one the maker uploaded on
 * this application, or one just uploaded through the admin route, which is
 * the same bucket either way.
 */
export async function setThumbnail(fd: FormData): Promise<void> {
  const id = String(fd.get('applicationId') ?? '')
  const url = String(fd.get('url') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/thumbnails')

  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) redirect(backTo(back, 'missing'))

  if (!isOwnPhotoUrl(url, photoUploads()?.baseUrl)) {
    redirect(backTo(back, 'foreign'))
  }

  await db.update(applications).set({ thumbnailUrl: url })
    .where(eq(applications.id, id))

  await logAudit(id, app.thumbnailUrl, url, 'thumbnail set')

  revalidatePath('/admin/thumbnails')
  revalidatePath('/admin/roster')
  /* And the page the square actually appears on. */
  revalidatePath('/makers')
  redirect(backTo(back, 'set'))
}

/**
 * Put the maker's own photograph back.
 *
 * Nothing is deleted: `photos` was never written to, so clearing the override
 * restores whatever they uploaded. A maker who uploaded nothing goes back to
 * having no square, which is the truth rather than a blank we invented.
 */
export async function clearThumbnail(fd: FormData): Promise<void> {
  const id = String(fd.get('applicationId') ?? '')
  const back = String(fd.get('back') ?? '/admin/thumbnails')

  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) redirect(backTo(back, 'missing'))
  if (!app.thumbnailUrl) redirect(back)

  await db.update(applications).set({ thumbnailUrl: null })
    .where(eq(applications.id, id))

  await logAudit(id, app.thumbnailUrl, null,
    parsePhotos(app.photos).length > 0
      ? 'thumbnail cleared, back to the maker’s own photo'
      : 'thumbnail cleared, the maker has no photo of their own')

  revalidatePath('/admin/thumbnails')
  revalidatePath('/admin/roster')
  /* And the page the square actually appears on. */
  revalidatePath('/makers')
  redirect(backTo(back, 'cleared'))
}
