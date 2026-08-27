import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { shows, bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { markPaid } from '@/app/actions'
import { usd, splitCommission } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function Roster() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
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

  // What the register will do to a $100 indoor sale, at the rate each booking
  // snapshotted. Never recompute from the show — the snapshot is the promise.
  const example = confirmed[0]
    ? splitCommission(10_000, confirmed[0].booking.commissionBps)
    : null

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34 }}>Roster — {show.name}</h1>
      </header>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0,
        border: '1px solid var(--line)', marginBottom: 30,
      }}>
        {[
          ['Confirmed', String(confirmed.length), false],
          ['Awaiting payment', String(awaiting.length), false],
          ['Booth fees collected', usd(collected), false],
          ['Missing paperwork', String(undocumented.length), undocumented.length > 0],
        ].map(([k, v, warn], i) => (
          <div key={String(k)} style={{
            padding: '18px 20px',
            borderRight: i < 3 ? '1px solid var(--line)' : undefined,
            background: warn ? '#FBF1EE' : undefined,
          }}>
            <div style={{
              fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase',
              fontWeight: 600, color: warn ? '#8C3A2A' : 'var(--ink-3)',
            }}>{k}</div>
            <div style={{
              fontFamily: 'var(--font-g)', fontSize: 30, marginTop: 8,
              color: warn ? '#8C3A2A' : undefined,
            }}>{v}</div>
            {Boolean(warn) && (
              <div style={{ fontSize: 11, color: '#8C3A2A', marginTop: 6, lineHeight: 1.45 }}>
                No permit and no 410-D on file. Clear before load-in.
              </div>
            )}
          </div>
        ))}
      </div>

      {example && (
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 26, maxWidth: 70 + 'ch' }}>
          At the snapshotted rate, a $100 indoor sale splits{' '}
          <strong style={{ color: 'var(--ink)' }}>{usd(example.commissionCents)}</strong> to Mermade
          and <strong style={{ color: 'var(--ink)' }}>{usd(example.netCents)}</strong> to the vendor.
          Commission is snapshotted per booking and immutable — changing the show rate later never
          changes what an accepted vendor was promised.
        </p>
      )}

      <table className="tbl">
        <thead>
          <tr>
            <th>Code</th>
            <th>Shop</th>
            <th>Category</th>
            <th>Space</th>
            <th className="r">Fee</th>
            <th className="r">Commission</th>
            <th>Status</th>
            <th>Compliance</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ booking, vendor, app, space }) => (
            <tr key={booking.id}>
              <td style={{ fontFamily: 'var(--font-g)', fontSize: 18 }}>{booking.vendorCode}</td>
              <td>
                {vendor.shopName}
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{vendor.email}</div>
              </td>
              <td>{app.category}</td>
              <td>{space.label}</td>
              <td className="r">{usd(booking.priceCents)}</td>
              <td className="r">
                {app.track === 'outdoor' ? '—' : `${booking.commissionBps / 100}%`}
              </td>
              <td>
                <span className="chip" data-s={booking.status === 'confirmed' ? 'accepted' : 'new'}>
                  {booking.status === 'confirmed' ? 'Paid' : 'Awaiting'}
                </span>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>
                  {booking.paidAt
                    ? fmtDateTime(booking.paidAt)
                    : `due ${fmtDateTime(booking.paymentDueAt)}`}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 150 }}>
                  {!documented(app) && (
                    <span className="chip" data-warn="1" title="CDTFA Publication 111 — up to $1,000 per undocumented seller">
                      Blocks load-in
                    </span>
                  )}
                  {app.occasionalSeller && !app.sellerPermit.trim() && (
                    <span className="chip">410-D claimed</span>
                  )}
                  {app.sellerPermit.trim() && (
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
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
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 22, maxWidth: 76 + 'ch' }}>
        “Mark paid” stands in for the vendor paying in the portal. In production this is a Stripe
        Checkout webhook — payment state is only ever set from a verified webhook, never a client
        callback (CLAUDE.md rule 5).
      </p>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12, maxWidth: 76 + 'ch' }}>
        <strong style={{ color: 'var(--ink)' }}>Blocks load-in</strong> means no seller’s permit
        number and no CDTFA-410-D on file. Publication 111 puts the record-keeping duty on the
        market, not the maker — up to $1,000 per undocumented seller who should have held a permit,
        and the records have to be kept four years. It is deliberately <em>not</em> a gate on the
        application: the duty attaches to renting space, and a maker who isn’t accepted never rents
        any.
      </p>
    </div>
  )
}
