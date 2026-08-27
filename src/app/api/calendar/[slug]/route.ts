import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'

/**
 * Add to calendar. One route, real attendance impact — the content audit ranks
 * it #2 of the things missing that cost money, because intent decays over the
 * twelve weeks between "I saw this on Instagram" and the show.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const show = await db.query.shows.findFirst({ where: eq(shows.slug, slug) })
  if (!show) return new Response('Not found', { status: 404 })

  const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, '')
  // DTEND is exclusive for all-day events, so add a day to the last show day.
  const end = new Date(show.endsOn)
  end.setUTCDate(end.getUTCDate() + 1)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mermade Market//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${show.slug}@mermademarket.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;VALUE=DATE:${ymd(show.startsOn)}`,
    `DTEND;VALUE=DATE:${ymd(end.toISOString())}`,
    `SUMMARY:Mermade Market — ${show.name}`,
    `LOCATION:${show.venueAddress.replace(/,/g, '\\,')}`,
    `DESCRIPTION:${`A juried market of independent makers. Free admission. ${show.hoursNote}`.replace(/,/g, '\\,')}`,
    'URL:https://mermademarket.com',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="mermade-${show.slug}.ics"`,
    },
  })
}
