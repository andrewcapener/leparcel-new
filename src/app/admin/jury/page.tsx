import Link from 'next/link'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import {
  applications, vendors, spaceTypes, bookings,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'
import { bpsLabel } from '@/lib/money'
import { PageHead, Stats, Stat, Tabs, Tab } from '../ui'
import { Icon } from '../Icon'
import { ApplicationRow } from './ApplicationRow'

export const dynamic = 'force-dynamic'

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

/** Counts come back from postgres as bigint, which the driver hands over as a
 *  string. Anything we subtract from a capacity has to go through this. */
const num = (v: number | string | null | undefined) => Number(v ?? 0)

/**
 * The jury queue.
 *
 * A dense table, not a contact sheet. The season this is being built for
 * expects hundreds of applications, and a grid of cards at that volume is
 * several screens of scrolling before the first decision. The thumbnail
 * identifies the maker; the chevron expands the row in place when the work
 * itself needs looking at; the shop name opens the full review, which is
 * where deciding happens and where the photographs are full size.
 *
 * The counting questions are answered once above the table: how many spaces
 * are left on each track, and which categories are already carrying three
 * makers. The status filter is the tab strip, so the counts and the
 * navigation are one control rather than two that can disagree.
 */
export default async function Jury({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const active = status === 'all' || (APPLICATION_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as ApplicationStatus | 'all')
    : 'new'

  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const counts = await db
    .select({ status: applications.status, n: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.showId, show.id))
    .groupBy(applications.status)
  const countOf = (s: string) => num(counts.find((c) => c.status === s)?.n)
  const total = counts.reduce((a, c) => a + num(c.n), 0)

  const rows = await db
    .select({ app: applications, vendor: vendors, space: spaceTypes })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .leftJoin(spaceTypes, eq(applications.spaceTypeId, spaceTypes.id))
    .where(and(
      eq(applications.showId, show.id),
      ...(active === 'all' ? [] : [eq(applications.status, active)]),
    ))
    .orderBy(desc(applications.submittedAt))

  /* Category balance, which encodes the actual curation rule ("one to three
     makers per category") into the tool instead of leaving it to memory.
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

  /* Spaces remaining, per track, because they fill at different speeds and
     one combined number hides the track that is already full. A `both`
     acceptance holds a space on each side. Capacities live on the Show. */
  const acceptedByTrack = await db
    .select({ track: applications.track, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.track)
  const held = (track: 'indoor' | 'outdoor') =>
    acceptedByTrack.filter((r) => r.track === track || r.track === 'both')
      .reduce((a, r) => a + num(r.n), 0)
  const indoorLeft = show.indoorCapacity - held('indoor')
  const outdoorLeft = show.outdoorCapacity - held('outdoor')

  const undecided = countOf('new') + countOf('under_review') + countOf('shortlist')

  /* The next application still to decide, newest first, in the same order
     the tabs walk. It is the one action this screen has, so it is the one
     black button on it. */
  const [nextUp] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(
      eq(applications.showId, show.id),
      inArray(applications.status, ['new', 'under_review', 'shortlist']),
    ))
    .orderBy(desc(applications.submittedAt))
    .limit(1)

  const tab = (s: ApplicationStatus | 'all') => `/admin/jury?status=${s}`
  const heading = active === 'all' ? 'Every application' : LABEL[active]

  return (
    <>
      <PageHead
        title="Review queue"
        sub={`${total} ${total === 1 ? 'application' : 'applications'} to ${show.name} · applications close ${fmtDateTime(show.applicationsCloseAt)} · ${bpsLabel(show.commissionBps)} commission`}
      >
        {nextUp && (
          <Link className="adm-btn" href={`/admin/applications/${nextUp.id}?from=${active}`}>
            <Icon name="chevron" size={16} />
            Next to decide
          </Link>
        )}
      </PageHead>

      <Stats>
        <Stat
          label="Still to decide" icon="clock" value={undecided}
          note={`${countOf('new')} new, ${countOf('under_review')} under review, ${countOf('shortlist')} shortlisted.`}
        />
        <Stat
          label="Indoor left" icon="roster" value={indoorLeft} unit={`of ${show.indoorCapacity}`}
          warn={indoorLeft < 0}
          note="Consignment at the central register."
        />
        <Stat
          label="Outdoor left" icon="tent" value={outdoorLeft} unit={`of ${show.outdoorCapacity}`}
          warn={outdoorLeft < 0}
          note="Booth licence, no commission."
        />
        <Stat
          label="Spaces booked" icon="money" value={num(sold)}
          note="Bookings created on acceptance, paid or awaiting payment."
        />
      </Stats>

      <div className="adm-strip">
        <span className="g">
          <span className="k">Accepted by category</span>
          {balance.length === 0
            ? <span className="mono">nothing accepted yet</span>
            : balance.map((b) => (
                <span
                  key={b.category}
                  className="adm-tag"
                  data-warn={num(b.n) > 3 ? '1' : undefined}
                  title={num(b.n) > 3 ? 'Over the one to three per category rule' : undefined}
                >
                  {b.category} {b.n}
                </span>
              ))}
        </span>
      </div>

      <Tabs label="Filter the queue by state">
        <Tab href={tab('all')} label="All" count={total} on={active === 'all'} />
        {APPLICATION_STATUSES.map((s) => (
          <Tab key={s} href={tab(s)} label={LABEL[s]} count={countOf(s)} on={active === s} />
        ))}
      </Tabs>

      {rows.length === 0 ? (
        <p className="adm-empty">Nothing in {heading.toLowerCase()}.</p>
      ) : (
        <table className="adm-tbl" style={{ marginTop: 4 }}>
          <caption className="adm-sr">
            {heading}, {rows.length} {rows.length === 1 ? 'application' : 'applications'} to{' '}
            {show.name}, newest first. Each row expands to show the work.
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className="adm-sr">Photograph</span></th>
              <th scope="col">Maker</th>
              <th scope="col" className="c-1">Category</th>
              <th scope="col" className="c-2">Track</th>
              <th scope="col" className="r c-2">Price band</th>
              <th scope="col" className="c-3">Flags</th>
              <th scope="col" className="c-1">Status</th>
              <th scope="col" className="r"><span className="adm-sr">Triage</span></th>
              <th scope="col" className="r"><span className="adm-sr">Expand</span></th>
            </tr>
          </thead>
          {rows.map(({ app, vendor }) => (
            <ApplicationRow key={app.id} app={app} vendor={vendor} from={active} />
          ))}
        </table>
      )}

      <div className="adm-foot">
        <p className="adm-note">
          <strong>The chevron expands a row in place</strong> with the rest of the photographs and
          the maker&rsquo;s own words, so the work can be looked at without losing your place.
          Opening the shop name goes to the full review, where the decision is made.
        </p>
        <p className="adm-note">
          <strong>There is no scoring.</strong> The team judges the work and says so. Notes and the
          decision live on the review screen, and every move is audit-logged.
        </p>
        <p className="adm-note">
          <strong>Paperwork is not shown here.</strong> A seller&rsquo;s permit has no bearing on
          whether the work is good, so compliance is enforced on the roster after acceptance,
          where the duty actually attaches.
        </p>
      </div>
    </>
  )
}
