import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { markPaid, forfeitOverdueBookings, markLinkSent, setBoothPrice } from '@/app/actions'
import { PayLink } from './PayLink'
import { siteUrl } from '@/lib/site-url'
import { usd, splitCommission, bpsLabel } from '@/lib/money'
import { holdsSpace, isPaid, isForfeitable, needsChasing } from '@/server/modules/payments/booking-status'
import { permitState, permitCleared } from '@/server/modules/compliance/permit'
import { connectState, owesPayoutSetup, type ConnectState } from '@/server/modules/payments/connect'
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

const COLS = 8

export default async function Roster({
  searchParams,
}: {
  searchParams: Promise<{ price?: string }>
}) {
  const sp = await searchParams
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

  const confirmed = rows.filter((r) => isPaid(r.booking.status))
  const awaiting = rows.filter((r) => needsChasing(r.booking.status))
  /* Authorised, money in transit. Not collected, not chased, and not a
     problem: a bank transfer takes about four business days to land. */
  const clearing = rows.filter((r) => r.booking.status === 'payment_processing')
  /* Past their window with nothing started. The acceptance email promised
     these spaces go back into the pool, and until now nothing did it. */
  const overdue = rows.filter(
    (r) => isForfeitable(r.booking.status, r.booking.paymentDueAt, new Date().toISOString()),
  )
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
    /* Was `Boolean(sellerPermit) || occasionalSeller`, which counted a maker
       who answered "I am an occasional seller" as never asked, because
       nothing in the application sets occasionalSeller. permitState reads
       what they actually told us. */
    permitCleared(permitState({
      track: a.track, permitStatus: a.permitStatus,
      sellerPermit: a.sellerPermit, occasionalSeller: a.occasionalSeller,
    }))
  const undocumented = rows.filter((r) => !documented(r.app))
  /* Accepted, holding a space, and nobody has ticked that they were told.
     This replaced a "certificate due" count: insurance is recommended rather
     than required, and the application form stopped asking, so that number
     could only ever have been zero. This one is the real gap under manual
     acceptance, where no email goes out on its own and a maker can be
     accepted, never written to, and released for not paying. */
  const notTold = rows.filter(
    (r) => holdsSpace(r.booking.status) && r.booking.payToken && !r.booking.linkSentAt,
  )

  /* Who can actually be PAID when the show closes. The other direction from
     everything else on this page, and the one with a quiet deadline: nothing
     here blocks load-in, so a maker who never finishes Stripe sells happily in
     November and is then owed money we cannot send. The count is here so that
     is visible in October rather than discovered on statement day.

     Indoor only. An outdoor maker takes their own money at their own tent and
     is never owed a cent, so counting them would report a gap that is not one. */
  const owedMoney = rows.filter((r) => holdsSpace(r.booking.status) && owesPayoutSetup(r.space.track))
  const payoutOf = (v: typeof rows[number]['vendor']): ConnectState => connectState({
    stripeAccountId: v.stripeAccountId,
    payoutsEnabled: v.payoutsEnabled,
    connectRequirements: v.connectRequirements,
    connectDisabledReason: v.connectDisabledReason,
  })
  const payable = owedMoney.filter((r) => payoutOf(r.vendor) === 'ready')
  /* Only counted while makers are actually being asked. Off, this tile would
     read "0 of 9" every day and teach staff to ignore a number that is going
     to matter later. */
  const asking = show.payoutSetup === 'on'

  // The show's booth-fee picture: expected counts every live booking
  // (confirmed and awaiting); collected counts only the paid ones.
  const expected = rows
    .filter((r) => holdsSpace(r.booking.status))
    .reduce((sum, r) => sum + r.booking.priceCents, 0)

  // What the register will do to a $100 indoor sale, at the rate each booking
  // snapshotted. Never recompute from the show: the snapshot is the promise.
  const example = confirmed[0]
    ? splitCommission(10_000, confirmed[0].booking.commissionBps)
    : null

  /* Sort order is the whole point of the screen. Blocked before unpaid,
     everything else last, and Mermade ID inside each band so a row stays
     where you last saw it. Insurance used to sit between them and no longer
     ranks at all: nobody is chased for it. */
  const rank = (r: typeof rows[number]) => {
    if (!documented(r.app)) return 0
    if (needsChasing(r.booking.status)) return 1
    return 2
  }
  const ordered = [...rows].sort(
    (a, b) => rank(a) - rank(b) || a.booking.vendorCode.localeCompare(b.booking.vendorCode),
  )
  /* 2 is the "nothing outstanding" band. It used to be 3, when a missing
     certificate of insurance sat between unpaid and clear. */
  const needsAction = ordered.filter((r) => rank(r) < 2)
  const clear = ordered.filter((r) => rank(r) === 2)

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
          {/* Most fees are the list price. This is for the one or two that are
              not, and it is deliberately a disclosure rather than a field
              sitting open: a booth fee is not something to change by leaning
              on a keyboard. Gone once money has moved, because an edit then
              only makes the record disagree with the bank. */}
          {!paid && booking.status !== 'payment_processing' && (
            <details className="adm-mask adm-price">
              <summary>
                <span className="mk">Change</span>
                <span className="adm-sr"> the booth fee for {vendor.shopName}</span>
              </summary>
              <form action={setBoothPrice}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <label className="adm-sr" htmlFor={`p-${booking.id}`}>New fee in dollars</label>
                <input className="inp" id={`p-${booking.id}`} name="dollars" type="text"
                  inputMode="decimal" defaultValue={(booking.priceCents / 100).toFixed(2)} />
                <label className="adm-sr" htmlFor={`r-${booking.id}`}>Why</label>
                <input className="inp" id={`r-${booking.id}`} name="reason" type="text"
                  placeholder="Why (goes in the audit log)" />
                <button className="adm-btn-q" type="submit">Save fee</button>
              </form>
              {booking.priceVersion > 1 && (
                <span className="adm-sub2">Changed {booking.priceVersion - 1}x</span>
              )}
            </details>
          )}
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
            {/* What they told us, which until now was invisible here: the old
                tag was keyed on occasionalSeller, a field the application
                never sets, so it could not render for anybody. */}
            {(() => {
              const st = permitState({
                track: app.track, permitStatus: app.permitStatus,
                sellerPermit: app.sellerPermit, occasionalSeller: app.occasionalSeller,
              })
              if (st === 'on_file') return <span className="adm-tag">Permit on file</span>
              if (st === 'occasional_documented') return <span className="adm-tag">410-D on file</span>
              if (st === 'occasional_declared') return <span className="adm-tag" data-warn="1">Send the 410-D</span>
              if (st === 'unsure') return <span className="adm-tag" data-warn="1">Asked for help</span>
              if (st === 'promised') return <span className="adm-tag" data-warn="1">Number promised</span>
              if (st === 'unanswered') return <span className="adm-tag" data-warn="1">Never asked</span>
              return null
            })()}
            {/* Shown when they have it, not when they lack it. A warning tag
                for an optional thing sends somebody chasing it. */}
            {app.hasCoi && <span className="adm-tag">Insured</span>}
            {/* Getting paid. Indoor only, and never a "blocks load-in" tag:
                this holds up their money, not their table. It earns a warning
                mark anyway, because the cost of noticing in November is a
                maker who sold all weekend and cannot be sent their share. */}
            {asking && owesPayoutSetup(space.track) && (() => {
              const st = payoutOf(vendor)
              if (st === 'ready') return <span className="adm-tag">Payouts ready</span>
              if (st === 'in_review') return <span className="adm-tag">Payouts in review</span>
              if (st === 'disabled') return <span className="adm-tag" data-warn="1">Payouts on hold</span>
              if (st === 'unfinished') return <span className="adm-tag" data-warn="1">Payouts unfinished</span>
              return <span className="adm-tag" data-warn="1">No payout account</span>
            })()}
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

        <td className="c-2">
          {booking.payToken ? (
            <>
              <PayLink
                url={`${siteUrl()}/pay/${booking.payToken}`}
                sent={Boolean(booking.linkSentAt)}
              />
              <form action={markLinkSent} style={{ marginTop: 6 }}>
                <input type="hidden" name="bookingId" value={booking.id} />
                {booking.linkSentAt && <input type="hidden" name="undo" value="1" />}
                <button className="adm-btn-q" type="submit">
                  {booking.linkSentAt ? 'Sent, undo' : 'Mark sent'}
                  <span className="adm-sr"> for {vendor.shopName}</span>
                </button>
              </form>
              <span className="adm-sub2">
                {booking.linkSentAt
                  ? `${fmtDateTime(booking.linkSentAt)}${booking.linkSentBy ? ` by ${booking.linkSentBy}` : ''}`
                  : 'Not told yet'}
              </span>
            </>
          ) : (
            /* Booked before payment links existed. The portal still works for
               them: they sign in at /account and the invoice is there. */
            <span className="adm-sub2">Portal only</span>
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

      {sp.price && (
        <p className="adm-note" role="status">
          {sp.price === 'set' ? 'Booth fee updated. The maker sees the new amount, any half-finished Stripe checkout of theirs was cancelled, and the change is in the audit log.'
            : sp.price === 'paid' ? 'That fee is already paid or clearing, so it was left alone. Changing it would only make the record disagree with the bank: that one needs a refund, not an edit.'
            : sp.price === 'bad' ? 'That did not look like an amount. Nothing was changed.'
            : 'No such booking. Nothing was changed.'}
        </p>
      )}

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
          note={`${usd(outstanding)} still to come in, ${show.paymentWindowHours} hour window.`
            /* Bank transfers in flight are counted separately and never as
               unpaid: those makers already paid and Stripe takes about four
               business days to settle. Chasing them would be wrong. */
            + (clearing.length > 0
              ? ` ${clearing.length} bank transfer${clearing.length === 1 ? '' : 's'} clearing, not counted here.`
              : '')}
        />
        {asking && <Stat
          label="Can be paid" icon="money" value={payable.length} unit={`of ${owedMoney.length}`}
          warn={payable.length < owedMoney.length}
          note={owedMoney.length === 0
            ? 'No indoor spaces held yet, so nobody is owed anything.'
            : payable.length === owedMoney.length
              ? 'Every indoor maker has finished Stripe. Payouts can go out the day statements are approved.'
              : 'Indoor makers with a Stripe payout account Stripe says is ready. The rest sell fine and cannot be paid until they finish.'}
        />}
        <Stat
          label="Not told yet" icon="roster" value={notTold.length}
          note={notTold.length === 0
            ? 'Everybody holding a space has been sent their link.'
            : 'Accepted, holding a space, and nobody has marked their payment link as sent.'}
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

      {overdue.length > 0 && (
        <>
          <div className="adm-sec" id="overdue" style={{ scrollMarginTop: '24px' }}>
            <h2>Past the payment window</h2>
            <span className="c">{overdue.length} to release</span>
          </div>
          <p className="adm-note">
            {overdue.length === 1 ? 'This maker' : 'These makers'} passed the{' '}
            {show.paymentWindowHours} hour window without starting a payment. Releasing is always
            written to the audit log; whether it also emails them depends on{' '}
            <Link href="/admin/show">show settings</Link>, and with decision emails off it sends
            nothing and the note is yours to write. Check <em>their link</em> in the roster first:
            a maker who was never told is not really late. Nobody whose bank transfer is still
            clearing can appear here, however far past the deadline they are.
            Anyone marked <em>started a payment</em> opened Stripe and did not finish; that can be
            an abandoned tab, or a bank still sending its verification deposits, so it is worth a
            look before releasing.
          </p>
          <table className="adm-tbl adm-tbl--tight">
            <thead>
              <tr>
                <th scope="col">Maker</th>
                <th scope="col">Was due</th>
                <th scope="col" className="r">Fee</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((r) => (
                <tr key={r.booking.id}>
                  <td>
                    <span className="adm-nm">{r.vendor.shopName}</span>
                    <span className="adm-sub2">
                      {r.booking.vendorCode} · {r.vendor.email}
                      {/* They opened a payment and it never completed. Could be
                          an abandoned tab, could be a bank transfer stuck in
                          microdeposit verification, which takes one to two
                          business days before the transfer even starts. Worth
                          a look before taking the space back. */}
                      {r.booking.stripeSessionId ? ' · started a payment' : ''}
                    </span>
                  </td>
                  <td><span className="mono">{fmtDateTime(r.booking.paymentDueAt)}</span></td>
                  <td className="r">{usd(r.booking.priceCents + r.booking.addonsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={forfeitOverdueBookings}>
            <button className="adm-btn" type="submit">
              Release {overdue.length} space{overdue.length === 1 ? '' : 's'}
            </button>
          </form>
          <div style={{ height: 26 }} />
        </>
      )}

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
              <th scope="col" className="c-2">Their link</th>
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
