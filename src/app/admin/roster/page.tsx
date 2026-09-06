import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { markPaid } from '@/app/actions'
import { usd, splitCommission, bpsLabel } from '@/lib/money'
import { fmtDateTime, fmtRange } from '@/lib/dates'
import { PageHead, Stats, Stat, Progress } from '../ui'

export const dynamic = 'force-dynamic'

/**
 * The run-up screen. Between acceptance and load-in the only questions are
 * who has paid, whose paperwork is missing, and who cannot be let in the
 * door yet. So the page leads with those answers, then sorts every row that
 * needs a human above every row that does not.
 */

/* PII (CLAUDE.md rule 9). A seller's permit number is a taxpayer identifier
   and this screen is read at a table on load-in day with makers standing at
   it. Staff only ever need the last four to match a row against a document,
   so that is all that renders until someone asks for the rest. The dot group
   is a fixed four so the mask does not publish the length of the number. */
const maskPermit = (permit: string) => `•••• ${permit.trim().slice(-4)}`

const COLS = 7

export default async function Roster() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const rows = await db
    .select({ booking: bookings, vendor: vendors, app: applications, space: spaceTypes })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, show.id))
    .orderBy(asc(bookings.vendorCode))

  const confirmed = rows.filter((r) => r.booking.status === 'confirmed')
  const awaiting = rows.filter((r) => r.booking.status === 'awaiting_payment')
  const collected = confirmed.reduce((a, r) => a + r.booking.priceCents, 0)
  const outstanding = awaiting.reduce((a, r) => a + r.booking.priceCents, 0)

  /* ── the compliance gate ──
     CDTFA Publication 111: "You may not rent space to sellers unless they give
     you the written documentation described in this publication," and the
     operator "may be required to pay a penalty of up to $1,000 for each seller
     for which you did not keep records if that person is required to hold a
     seller's permit and does not hold a valid permit."

     The obligation attaches to RENTING SPACE, which is why this lives here and
     not on the application form. A maker who never gets accepted never rents
     space, so their paperwork was never Mermade's problem. A confirmed booking
     without documentation is. Retain for four years. */
  const documented = (a: typeof rows[number]['app']) =>
    Boolean(a.sellerPermit.trim()) || a.occasionalSeller
  const undocumented = rows.filter((r) => !documented(r.app))
  const noCoi = rows.filter((r) => !r.app.hasCoi)

  // The show's booth-fee picture: expected counts every live booking
  // (confirmed and awaiting); collected counts only the paid ones.
  const expected = rows
    .filter((r) => ['confirmed', 'awaiting_payment'].includes(r.booking.status))
    .reduce((sum, r) => sum + r.booking.priceCents, 0)

  // What the register will do to a $100 indoor sale, at the rate each booking
  // snapshotted. Never recompute from the show: the snapshot is the promise.
  const example = confirmed[0]
    ? splitCommission(10_000, confirmed[0].booking.commissionBps)
    : null

  /* Sort order is the whole point of the screen. Blocked before unpaid,
     unpaid before a missing COI, everything else last, and Mermade ID
     inside each band so a row stays where you last saw it. */
  const rank = (r: typeof rows[number]) => {
    if (!documented(r.app)) return 0
    if (r.booking.status === 'awaiting_payment') return 1
    if (!r.app.hasCoi) return 2
    return 3
  }
  const ordered = [...rows].sort(
    (a, b) => rank(a) - rank(b) || a.booking.vendorCode.localeCompare(b.booking.vendorCode),
  )
  const needsAction = ordered.filter((r) => rank(r) < 3)
  const clear = ordered.filter((r) => rank(r) === 3)

  const row = ({ booking, vendor, app, space }: typeof rows[number]) => {
    const paid = booking.status === 'confirmed'
    const permit = app.sellerPermit.trim()
    return (
      <tr key={booking.id}>
        <td><span className="adm-code">{booking.vendorCode}</span></td>

        <td>
          <span className="adm-nm">{vendor.shopName}</span>
          <span className="adm-sub2">{vendor.email}<br />{app.category}</span>
        </td>

        <td className="c-1">
          {space.label}
          <span className="adm-sub2">{app.track}</span>
        </td>

        <td className="r">
          <span className="adm-money">{usd(booking.priceCents)}</span>
          <span className="adm-sub2">
            {app.track === 'outdoor' ? 'no commission' : `${bpsLabel(booking.commissionBps)} commission`}
          </span>
        </td>

        <td className="c-2">
          <span className="adm-st" data-warn={paid ? undefined : '1'}>{paid ? 'Paid' : 'Awaiting'}</span>
          <span className="adm-sub2">
            {booking.paidAt ? fmtDateTime(booking.paidAt) : `due ${fmtDateTime(booking.paymentDueAt)}`}
          </span>
        </td>

        <td className="c-1">
          <span className="adm-tags">
            {!documented(app) && <span className="adm-tag" data-warn="1">Blocks load-in</span>}
            {app.occasionalSeller && !permit && <span className="adm-tag">410-D claimed</span>}
            {permit && <span className="adm-tag">Permit on file</span>}
            {!app.hasCoi && <span className="adm-tag">COI due</span>}
          </span>
          {permit && (
            /* Revealed one row at a time, by an explicit click, and never
               opened by default. See maskPermit above. */
            <details className="adm-mask" style={{ marginTop: 8 }}>
              <summary>
                <span className="mk">{maskPermit(permit)}</span>
                <span className="adm-sr">
                  Reveal the seller&rsquo;s permit number for {vendor.shopName}
                </span>
              </summary>
              <span className="fu">{permit}</span>
            </details>
          )}
        </td>

        <td className="r">
          {!paid && (
            <form action={markPaid}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="adm-btn-q" type="submit">
                Mark paid
                <span className="adm-sr"> for {vendor.shopName}</span>
              </button>
            </form>
          )}
        </td>
      </tr>
    )
  }

  return (
    <>
      <PageHead
        title="Roster"
        sub={`${rows.length} ${rows.length === 1 ? 'space held' : 'spaces held'} for ${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${show.venueName}`}
      />

      <Stats>
        <Stat
          label="Need a person" icon="clock" value={needsAction.length} unit={`of ${rows.length}`}
          warn={needsAction.length > 0}
          note={needsAction.length === 0
            ? 'Every space is paid for and documented.'
            : 'Listed first below, blocked before unpaid.'}
        />
        <Stat
          label="Blocks load-in" icon="shield" value={undocumented.length}
          warn={undocumented.length > 0}
          note="No seller's permit and no CDTFA-410-D on file."
        />
        <Stat
          label="Booth fee unpaid" icon="money" value={awaiting.length}
          note={`${usd(outstanding)} still to come in, ${show.paymentWindowHours} hour window.`}
        />
        <Stat
          label="Certificate due" icon="roster" value={noCoi.length}
          note="Liability insurance not yet on file."
        />
      </Stats>

      <div className="adm-stats">
        <Progress
          label="Booth fees collected"
          figure={usd(collected)}
          unit={`of ${usd(expected)} expected`}
          pct={expected > 0 ? (collected / expected) * 100 : 0}
          status={example
            ? `${confirmed.length} of ${rows.length} spaces confirmed. At the snapshotted rate, a $100 indoor sale splits ${usd(example.commissionCents)} to Mermade and ${usd(example.netCents)} to the maker.`
            : `${confirmed.length} of ${rows.length} spaces confirmed.`}
          link={{ href: '/admin/show', label: 'Prices' }}
        />
      </div>

      <div className="adm-sec">
        <h2>The roster</h2>
        <span className="c">{needsAction.length} need a person</span>
      </div>

      {rows.length === 0 ? (
        <p className="adm-empty">
          Nothing here yet. When you accept an application in the review queue, the booking lands
          on this roster with its fee and paperwork status.
        </p>
      ) : (
        <table className="adm-tbl">
          <caption className="adm-sr">
            Accepted makers for {show.name}, rows needing action first.
          </caption>
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Maker</th>
              <th scope="col" className="c-1">Space</th>
              <th scope="col" className="r">Booth fee</th>
              <th scope="col" className="c-2">Fee status</th>
              <th scope="col" className="c-1">Paperwork</th>
              <th scope="col" className="r"><span className="adm-sr">Action</span></th>
            </tr>
          </thead>

          {needsAction.length > 0 && (
            <tbody>
              <tr className="grp">
                <th scope="colgroup" colSpan={COLS}>
                  Needs a person <span className="c">{needsAction.length}</span>
                </th>
              </tr>
              {needsAction.map(row)}
            </tbody>
          )}

          {clear.length > 0 && (
            <tbody>
              <tr className="grp">
                <th scope="colgroup" colSpan={COLS}>
                  Clear for load-in <span className="c">{clear.length}</span>
                </th>
              </tr>
              {clear.map(row)}
            </tbody>
          )}
        </table>
      )}

      <div className="adm-foot">
        <p className="adm-note">
          <strong>Blocks load-in</strong> means no seller&rsquo;s permit number and no CDTFA-410-D
          on file. Publication 111 puts the record-keeping duty on the market, not the maker: up to
          $1,000 per undocumented seller who should have held a permit, and the records have to be
          kept four years. It is deliberately <em>not</em> a gate on the application, because the
          duty attaches to renting space, and a maker who isn&rsquo;t accepted never rents any.
        </p>
        <p className="adm-note">
          <strong>Permit numbers are masked.</strong> The last four are enough to match a row
          against a document. Reveal one when you need the whole number.
        </p>
        <p className="adm-note">
          <strong>Mark paid</strong> stands in for the maker paying in the portal. In production
          this is a Stripe Checkout webhook; payment state is only ever set from a verified webhook,
          never a client callback (CLAUDE.md rule 5).
        </p>
        <p className="adm-note">
          <strong>Commission is snapshotted per booking</strong> and immutable. Changing the show
          rate later never changes what an accepted maker was promised.
        </p>
      </div>
    </>
  )
}
