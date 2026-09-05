import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import {
  applications, vendors, spaceTypes, bookings,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { fmtDate } from '@/lib/dates'
import Link from 'next/link'
import { ApplicationCard } from './ApplicationCard'

export const dynamic = 'force-dynamic'

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

/** Counts come back from postgres as bigint, which the driver hands over as a
 *  string. Anything we subtract from a capacity has to go through this. */
const num = (v: number | string | null | undefined) => Number(v ?? 0)

/**
 * The jury queue, as a contact sheet.
 *
 * A juror works through roughly a hundred applications in a sitting and is
 * judging one thing: the work. So the work is what the page is made of. The
 * counting questions are answered once at the top (tiles, spaces left,
 * category balance) and then the screen is photographs.
 *
 * What used to be here was a seven-column table carrying five decision pills
 * on every row: five hundred identical buttons down the page, with the work
 * itself reduced to two 52px thumbnails in the first column. Nothing led,
 * nothing receded. Deciding now happens on the review screen, where the work
 * is full size and the sticky rail already holds the decision.
 */
export default async function Jury({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const active = (APPLICATION_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as ApplicationStatus)
    : 'new'

  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const counts = await db
    .select({ status: applications.status, n: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.showId, show.id))
    .groupBy(applications.status)
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0

  const rows = await db
    .select({
      app: applications,
      vendor: vendors,
      space: spaceTypes,
    })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .leftJoin(spaceTypes, eq(applications.spaceTypeId, spaceTypes.id))
    .where(and(eq(applications.showId, show.id), eq(applications.status, active)))
    .orderBy(desc(applications.submittedAt))

  /* Category balance — encodes the actual curation rule ("one to three makers
     per category") into the tool instead of leaving it to memory.
     docs/01-PRODUCT-SPEC.md §3.2 */
  const balance = await db
    .select({ category: applications.category, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.category)
    .orderBy(desc(sql`count(*)`))

  const [{ sold }] = await db
    .select({ sold: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.showId, show.id))

  /* Spaces remaining, per track, because they fill at different speeds and one
     combined number hides the track that is already full. A `both` acceptance
     holds a space on each side. Capacities live on the Show record. */
  const acceptedByTrack = await db
    .select({ track: applications.track, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.track)
  const held = (track: 'indoor' | 'outdoor') =>
    acceptedByTrack
      .filter((r) => r.track === track || r.track === 'both')
      .reduce((a, r) => a + num(r.n), 0)
  const indoorLeft = show.indoorCapacity - held('indoor')
  const outdoorLeft = show.outdoorCapacity - held('outdoor')

  const undecided = num(countOf('new')) + num(countOf('under_review')) + num(countOf('shortlist'))

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header className="jr-h">
        <h1>Jury · {show.name}</h1>
        <span className="meta">
          Applications close {fmtDate(show.applicationsCloseAt)} ·{' '}
          {show.commissionBps / 100}% commission · {show.paymentWindowHours}h payment window
        </span>
      </header>

      {/* The counting questions, answered before the reviewer scrolls: how many
          sit in each state, and which one to open next. Every tile is the
          filter for its own column, so the counts and the navigation are one
          control rather than a tab strip repeating the numbers. */}
      <nav className="jr-stats" aria-label="Filter the queue by state">
        {APPLICATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/jury?status=${s}`}
            className="jr-stat"
            aria-current={s === active ? 'page' : undefined}
          >
            <span className="k">{LABEL[s]}</span>
            <div className="v">{countOf(s)}</div>
          </Link>
        ))}
        <div className="jr-stat" data-warn={indoorLeft < 0 ? '1' : undefined}>
          <span className="k">Indoor left</span>
          <div className="v">{indoorLeft}<small> of {show.indoorCapacity}</small></div>
        </div>
        <div className="jr-stat" data-warn={outdoorLeft < 0 ? '1' : undefined}>
          <span className="k">Outdoor left</span>
          <div className="v">{outdoorLeft}<small> of {show.outdoorCapacity}</small></div>
        </div>
        <div className="jr-stat">
          <span className="k">Booked spaces</span>
          <div className="v">{sold}</div>
        </div>
      </nav>

      <div className="jr-strip">
        <span className="g">
          <span className="k">Still to decide</span>
          <span className="num">{undecided}</span>
        </span>
        <span className="g">
          <span className="k">Accepted by category</span>
          {balance.length === 0
            ? <span style={{ color: 'var(--ink-3)', fontSize: 'var(--t-lbl)' }}>nothing accepted yet</span>
            : balance.map((b) => (
                <span
                  key={b.category}
                  className="chip"
                  data-warn={num(b.n) > 3 ? '1' : undefined}
                  title={num(b.n) > 3 ? 'Over the one-to-three-per-category rule' : undefined}
                >
                  {b.category} {b.n}
                </span>
              ))}
        </span>
      </div>

      <h2 className="jr-h2" id="jr-sheet-h">
        {LABEL[active]} · {rows.length} {rows.length === 1 ? 'application' : 'applications'}, newest first
      </h2>

      {rows.length === 0 ? (
        <p className="jr-empty">Nothing in {LABEL[active]}.</p>
      ) : (
        <ul className="jr-sheet" aria-labelledby="jr-sheet-h">
          {rows.map(({ app, vendor }) => (
            <ApplicationCard key={app.id} app={app} vendor={vendor} from={active} />
          ))}
        </ul>
      )}
    </div>
  )
}
