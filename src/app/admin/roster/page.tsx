import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { markPaid } from '@/app/actions'
import { usd, splitCommission } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * The run-up screen. Between acceptance and load-in the only questions are
 * who has paid, whose paperwork is missing, and who cannot be let in the
 * door yet. So the page answers those in a stat row, then sorts every row
 * that needs a human above every row that does not.
 */
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

  // The show's booth-fee picture: expected counts every live booking
  // (confirmed and awaiting); collected counts only the paid ones.
  const expected = rows
    .filter((r) => ['confirmed', 'awaiting_payment'].includes(r.booking.status))
    .reduce((sum, r) => sum + r.booking.priceCents, 0)

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

  const stats: Array<{ k: string; v: string; n?: string; warn?: boolean }> = [
    { k: 'Confirmed', v: String(confirmed.length), n: 'Booth fee received.' },
    { k: 'Awaiting payment', v: String(awaiting.length), n: `${show.paymentWindowHours}h window from acceptance.` },
    {
      k: 'Missing paperwork', v: String(undocumented.length),
      n: 'No permit and no 410-D on file. Clear before load-in.',
      warn: undocumented.length > 0,
    },
    { k: 'Booth fees expected', v: usd(expected), n: 'Confirmed plus awaiting.' },
    { k: 'Booth fees collected', v: usd(collected), n: 'Paid and in the bank.' },
    { k: 'Booth fees outstanding', v: usd(outstanding), n: 'Still to come in.' },
  ]

  const cols = 9

  const row = ({ booking, vendor, app, space }: typeof rows[number]) => (
    <tr key={booking.id}>
      <td className="cd" style={{ fontSize: 'var(--t-lead)', letterSpacing: '.04em' }}>
        {booking.vendorCode}
      </td>
      <td>
        {vendor.shopName}
        <div style={{ fontSize: 'var(--t-lbl-s)', color: 'var(--ink-3)', marginTop: 3 }}>
          {app.category} · {vendor.email}
        </div>
      </td>
      <td style={{ textTransform: 'capitalize', color: 'var(--ink-2)' }}>{app.track}</td>
      <td>{space.label}</td>
      <td className="r">{usd(booking.priceCents)}</td>
      <td className="r">{app.track === 'outdoor' ? '—' : `${booking.commissionBps / 100}%`}</td>
      <td>
        <span className="chip" data-s={booking.status === 'confirmed' ? 'accepted' : 'new'}>
          {booking.status === 'confirmed' ? 'Paid' : 'Awaiting'}
        </span>
        <div style={{ fontSize: 'var(--t-lbl-s)', color: 'var(--ink-3)', marginTop: 5 }}>
          {booking.paidAt ? fmtDateTime(booking.paidAt) : `due ${fmtDateTime(booking.paymentDueAt)}`}
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 168 }}>
          {!documented(app) && (
            <span className="chip" data-warn="1" title="CDTFA Publication 111: up to $1,000 per undocumented seller">
              Blocks load-in
            </span>
          )}
          {app.occasionalSeller && !app.sellerPermit.trim() && (
            <span className="chip">410-D claimed</span>
          )}
          {app.sellerPermit.trim() && (
            <span style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)' }}>
              {app.sellerPermit}
            </span>
          )}
          {!app.hasCoi && <span className="chip">COI due</span>}
        </div>
      </td>
      <td>
        {booking.status === 'awaiting_payment' && (
          <form action={markPaid}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="btn-o" type="submit">Mark paid</button>
          </form>
        )}
      </td>
    </tr>
  )

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header className="op-head">
        <h1>Roster · {show.name}</h1>
        <p className="lede">
          Every accepted maker with a space held. Who has paid, whose paperwork is missing, who
          cannot come through the door on load-in day. Rows that need a person sit at the top.
        </p>
      </header>

      <dl className="op-stats">
        {stats.map((s) => (
          <div key={s.k} data-warn={s.warn ? '1' : undefined}>
            <dt className="k">{s.k}</dt>
            <dd style={{ margin: 0 }}>
              <span className="v">{s.v}</span>
              {s.n && <span className="n">{s.n}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {example && (
        <p className="op-note" style={{ marginBottom: 26 }}>
          At the snapshotted rate, a $100 indoor sale splits{' '}
          <strong>{usd(example.commissionCents)}</strong> to Mermade and{' '}
          <strong>{usd(example.netCents)}</strong> to the vendor. Commission is snapshotted per
          booking and immutable: changing the show rate later never changes what an accepted
          vendor was promised.
        </p>
      )}

      {rows.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-g)', fontSize: 'var(--t-b)', color: 'var(--ink-2)', margin: '26px 0 4px' }}>
          Nothing here yet. When you accept an application in the jury queue, the booking
          lands on this roster with its fee and paperwork status.
        </p>
      ) : (
        <table className="tbl">
          <caption className="op-note" style={{ textAlign: 'left', marginBottom: 10 }}>
            {rows.length} {rows.length === 1 ? 'space' : 'spaces'} held for {show.name}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Shop</th>
              <th scope="col">Track</th>
              <th scope="col">Space</th>
              <th scope="col" className="r">Fee</th>
              <th scope="col" className="r">Commission</th>
              <th scope="col">Fee status</th>
              <th scope="col">Paperwork</th>
              <th scope="col"><span className="sr-only">Action</span></th>
            </tr>
          </thead>

          {needsAction.length > 0 && (
            <tbody>
              <tr className="op-group">
                <th scope="colgroup" colSpan={cols}>
                  Needs action <span className="c">{needsAction.length}</span>
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

      <p className="op-note" style={{ marginTop: 22 }}>
        “Mark paid” stands in for the vendor paying in the portal. In production this is a Stripe
        Checkout webhook; payment state is only ever set from a verified webhook, never a client
        callback (CLAUDE.md rule 5).
      </p>
      <p className="op-note" style={{ marginTop: 12 }}>
        <strong>Blocks load-in</strong> means no seller’s permit number and no CDTFA-410-D on
        file. Publication 111 puts the record-keeping duty on the market, not the maker: up to
        $1,000 per undocumented seller who should have held a permit, and the records have to be
        kept four years. It is deliberately <em>not</em> a gate on the application: the duty
        attaches to renting space, and a maker who isn’t accepted never rents any.
      </p>
    </div>
  )
}
