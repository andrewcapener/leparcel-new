import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { markPaid } from '@/app/actions'
import { usd, splitCommission, bpsLabel } from '@/lib/money'
import { fmtDateTime, fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * The run-up screen. Between acceptance and load-in the only questions are
 * who has paid, whose paperwork is missing, and who cannot be let in the
 * door yet. So the page leads with those two answers at a glance, then
 * sorts every row that needs a human above every row that does not.
 */

/* PII (CLAUDE.md rule 9). A seller's permit number is a taxpayer identifier
   and this screen is read at a table on load-in day with makers standing at
   it. Staff only ever need the last four to match a row against a document,
   so that is all that renders until someone asks for the rest. The dot group
   is a fixed four so the mask does not publish the length of the number. */
const maskPermit = (permit: string) => `•••• ${permit.trim().slice(-4)}`

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
  const pctCollected = expected > 0 ? Math.round((collected / expected) * 100) : 0

  // What the register will do to a $100 indoor sale, at the rate each booking
  // snapshotted. Never recompute from the show — the snapshot is the promise.
  const example = confirmed[0]
    ? splitCommission(10_000, confirmed[0].booking.commissionBps)
    : null

  /* Sort order is the whole point of the screen. Blocked before unpaid,
     unpaid before a missing COI, everything else last, and vendor code
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

  const cols = 7

  const row = ({ booking, vendor, app, space }: typeof rows[number]) => {
    const paid = booking.status === 'confirmed'
    const permit = app.sellerPermit.trim()
    return (
      <tr key={booking.id}>
        <td className="op-code">{booking.vendorCode}</td>

        <td>
          <div className="op-name">{vendor.shopName}</div>
          <span className="op-sub wrap">{app.category} · {vendor.email}</span>
        </td>

        <td>
          {space.label}
          <span className="op-sub" style={{ textTransform: 'capitalize' }}>{app.track}</span>
        </td>

        <td className="r">
          <span className="op-money">{usd(booking.priceCents)}</span>
          <span className="op-sub">
            {app.track === 'outdoor' ? 'no commission' : `${bpsLabel(booking.commissionBps)} commission`}
          </span>
        </td>

        <td>
          <span className="chip" data-s={paid ? 'accepted' : 'due'}>{paid ? 'Paid' : 'Awaiting'}</span>
          <span className="op-sub">
            {booking.paidAt ? fmtDateTime(booking.paidAt) : `due ${fmtDateTime(booking.paymentDueAt)}`}
          </span>
        </td>

        <td>
          <div className="op-flags">
            {!documented(app) && (
              <span className="chip" data-warn="1">Blocks load-in</span>
            )}
            {app.occasionalSeller && !permit && <span className="chip">410-D claimed</span>}
            {permit && <span className="chip">Permit on file</span>}
            {!app.hasCoi && <span className="chip" data-s="due">COI due</span>}
          </div>
          {permit && (
            /* Revealed one row at a time, by an explicit click, and never
               opened by default. See maskPermit above. */
            <details className="op-mask" style={{ marginTop: 8 }}>
              <summary>
                <span className="mk">{maskPermit(permit)}</span>
                <span className="op-sr">
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
              <button className="btn-o" type="submit">
                Mark paid
                <span className="op-sr"> for {vendor.shopName}</span>
              </button>
            </form>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="op-page">
      <header className="op-head">
        <span className="eb">Run-up</span>
        <h1 className="t">Roster</h1>
        <p className="lede">
          Every accepted maker with a space held: who has paid, whose paperwork is missing, who
          cannot come through the door on load-in day. Rows that need a person sit at the top.
        </p>
        <p className="meta">
          <span>{show.name}</span>
          <span>{fmtRange(show.startsOn, show.endsOn)}</span>
          <span>{rows.length} {rows.length === 1 ? 'space held' : 'spaces held'}</span>
        </p>
      </header>

      <div className="op-lead">
        <div>
          <span className="k">Rows needing a person</span>
          <span className="fig">
            {needsAction.length}
            <small>of {rows.length}</small>
          </span>
          <p className="say">
            {needsAction.length === 0
              ? 'Every space is paid for and documented. Nothing on this roster is waiting on you.'
              : 'Listed first below, blocked before unpaid, unpaid before a missing certificate.'}
          </p>
          <div className="op-tally">
            <div data-warn={undocumented.length > 0 ? '1' : undefined}>
              <span className="lb">Missing paperwork, blocks load-in</span>
              <span className="n">{undocumented.length}</span>
            </div>
            <div>
              <span className="lb">Booth fee unpaid, {show.paymentWindowHours}h window</span>
              <span className="n">{awaiting.length}</span>
            </div>
            <div>
              <span className="lb">Certificate of insurance outstanding</span>
              <span className="n">{noCoi.length}</span>
            </div>
          </div>
        </div>

        <div>
          <span className="k">Booth fees collected</span>
          <span className="fig">
            {usd(collected)}
            <small>of {usd(expected)} expected</small>
          </span>
          <div className="op-meter" aria-hidden="true">
            <span style={{ width: `${pctCollected}%` }} />
          </div>
          <div className="op-tally">
            <div>
              <span className="lb">Paid and in the bank</span>
              <span className="n">{usd(collected)}</span>
            </div>
            <div>
              <span className="lb">Still to come in</span>
              <span className="n">{usd(outstanding)}</span>
            </div>
            <div>
              <span className="lb">Spaces confirmed</span>
              <span className="n">{confirmed.length} of {rows.length}</span>
            </div>
          </div>
          {example && (
            <p className="say">
              At the snapshotted rate, a $100 indoor sale splits {usd(example.commissionCents)} to
              Mermade and {usd(example.netCents)} to the vendor.
            </p>
          )}
        </div>
      </div>

      <div className="op-sec">
        <h2>The roster</h2>
        <span className="c">{needsAction.length} need a person</span>
      </div>

      {rows.length === 0 ? (
        <p className="op-empty">
          Nothing here yet. When you accept an application in the jury queue, the booking lands on
          this roster with its fee and paperwork status.
        </p>
      ) : (
        <table className="tbl">
          <caption className="op-sr">
            Accepted makers for {show.name}, rows needing action first.
          </caption>
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Maker</th>
              <th scope="col">Space</th>
              <th scope="col" className="r">Booth fee</th>
              <th scope="col">Fee status</th>
              <th scope="col">Paperwork</th>
              <th scope="col" className="r"><span className="op-sr">Action</span></th>
            </tr>
          </thead>

          {needsAction.length > 0 && (
            <tbody>
              <tr className="op-group">
                <th scope="colgroup" colSpan={cols}>
                  Needs a person <span className="c">{needsAction.length}</span>
                </th>
              </tr>
              {needsAction.map(row)}
            </tbody>
          )}

          {clear.length > 0 && (
            <tbody>
              <tr className="op-group">
                <th scope="colgroup" colSpan={cols}>
                  Clear for load-in <span className="c">{clear.length}</span>
                </th>
              </tr>
              {clear.map(row)}
            </tbody>
          )}
        </table>
      )}

      <div className="op-foot">
        <p className="op-note">
          <strong>Blocks load-in</strong> means no seller&rsquo;s permit number and no CDTFA-410-D
          on file. Publication 111 puts the record-keeping duty on the market, not the maker: up to
          $1,000 per undocumented seller who should have held a permit, and the records have to be
          kept four years. It is deliberately <em>not</em> a gate on the application, because the
          duty attaches to renting space, and a maker who isn&rsquo;t accepted never rents any.
        </p>
        <p className="op-note">
          <strong>Permit numbers are masked.</strong> The last four are enough to match a row
          against a document. Reveal one when you need the whole number.
        </p>
        <p className="op-note">
          <strong>Mark paid</strong> stands in for the vendor paying in the portal. In production
          this is a Stripe Checkout webhook; payment state is only ever set from a verified webhook,
          never a client callback (CLAUDE.md rule 5).
        </p>
        <p className="op-note">
          <strong>Commission is snapshotted per booking</strong> and immutable. Changing the show
          rate later never changes what an accepted vendor was promised.
        </p>
      </div>
    </div>
  )
}
