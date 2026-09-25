import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, bookings, spaceTypes, vendors } from '@/db/schema'
import { boardNotice } from '@/server/modules/roster/lineup-board'
import { PageHead } from '../ui'
import { LineupBoard, type BoardCard } from './LineupBoard'
import { saveLineup } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'The lineup' }

/**
 * The public grid, as a thing staff can arrange.
 *
 * Elise, 25 Sept: reorder the grid, and show or hide a maker, "there's a
 * handful where all we have are bad images". Both were possible one maker at
 * a time from her roster page, which is the wrong shape for a decision about
 * how a grid looks. This is the grid.
 *
 * It shows exactly what /makers shows, in the same groups and the same order,
 * including the squares, so the thing being arranged looks like the thing
 * that gets published.
 */
export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<{ moved?: string; hid?: string; lit?: string }>
}) {
  const sp = await searchParams
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const rows = await db
    .select({
      id: bookings.id,
      shopName: vendors.shopName,
      track: spaceTypes.track,
      space: spaceTypes.label,
      thumbnailUrl: applications.thumbnailUrl,
      hidden: bookings.lineupHiddenAt,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(and(
      eq(bookings.showId, show.id),
      inArray(bookings.status, ['confirmed', 'payment_processing', 'awaiting_payment']),
    ))
    /* The same order the public page uses, so the board is not a different
       arrangement of the same people. */
    .orderBy(asc(bookings.lineupOrder), asc(spaceTypes.sortOrder), asc(vendors.shopName))

  /* The same rule /makers uses, so a card that looks empty here looks empty
     there: ONLY the staff chosen square, never the maker's own application
     photograph. That rule exists because publishing what a maker uploaded
     put a wedding photo on the public page once already. */
  const cards: BoardCard[] = rows.map((r) => ({
    id: r.id,
    name: r.shopName,
    group: r.track === 'indoor'
      ? (r.space === 'JR Space' ? 'junior' : 'indoor')
      : r.space.replace(/^Outdoor\s+/i, '').toLowerCase(),
    photo: r.thumbnailUrl?.trim() || null,
    shown: !r.hidden,
  }))

  const said = sp.moved !== undefined
    ? boardNotice(Number(sp.moved) || 0, Number(sp.hid) || 0, Number(sp.lit) || 0)
    : null

  return (
    <>
      {said && <p className="adm-note" role="status">{said}</p>}
      <PageHead
        title="The lineup"
        sub={`What /makers shows, in the order it shows it. ${cards.length} makers.`}
      />
      <p className="adm-note">
        Drag a card to move it, or use the arrows. A maker only moves within her own
        group, because her group is the space she booked. Untick a maker to keep her
        off the page: she keeps her space and her pay link, and ticking her puts her
        back. Nothing changes until you press Save.
      </p>
      <LineupBoard cards={cards} action={saveLineup} />
    </>
  )
}
