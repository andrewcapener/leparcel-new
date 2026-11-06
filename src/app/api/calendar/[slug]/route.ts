import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { icsForShow } from '@/server/modules/calendar/ics'

/**
 * Add to calendar. One route, real attendance impact — the content audit ranks
 * it #2 of the things missing that cost money, because intent decays over the
 * twelve weeks between "I saw this on Instagram" and the show.
 *
 * The file itself is built in src/server/modules/calendar/ics.ts, where it can
 * be tested: it was written here as a template and shipped with unfolded lines
 * and half-escaped text, which some calendars accept and others drop on the
 * floor without a word. This handler is the thin part (CLAUDE.md rule 10).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const show = await db.query.shows.findFirst({ where: eq(shows.slug, slug) })
  if (!show) return new Response('Not found', { status: 404 })

  return new Response(icsForShow(show), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="mermade-${show.slug}.ics"`,
    },
  })
}
