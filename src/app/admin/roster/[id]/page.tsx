import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeAddOns, activeSpaceTypes } from '@/db/queries'
import {
  addOns, applications, auditLog, bookingAddons, bookingCharges, bookings, shows,
  spaceTypes, vendors,
} from '@/db/schema'
import {
  addBoothCharge, cancelBooking, markLinkSent, markPaid, setBoothPrice, setBoothSpace,
  voidBoothCharge,
} from '@/app/actions'
import { voidBoothAddon } from '@/app/admin/roster/void-addon'
import { resendBoothInvoice } from '@/app/admin/roster/resend'
import {
  NOTE_MAX, addonNotice, resendNotice, resendProblem,
} from '@/app/admin/roster/resend-lines'
import { boothInvoice } from '@/server/modules/payments/booth'
import { ledgerFor, standing, standingWords } from '@/server/modules/payments/ledger'
import { holdsSpace, isPaid } from '@/server/modules/payments/booking-status'
import { viaLabel } from '@/server/modules/payments/paid-via'
import { permitState } from '@/server/modules/compliance/permit'
import { thumbnailFor } from '@/server/modules/roster/thumbnail'
import { bpsLabel, usd } from '@/lib/money'
import { fmtDateTime, fmtRange } from '@/lib/dates'
import { siteUrl } from '@/lib/site-url'
import { PayLink } from '../PayLink'
import { PageHead } from '../../ui'
import { chargePresets, dollarsField, presetFill } from './presets'

export const dynamic = 'force-dynamic'

/**
 * One maker, everything about their booth fee, on one screen.
 *
 * Drew, on the roster: "you should be able to click into each maker, and then
 * see everything back there, and adding fees should be so easy, and then you
 * should be able to send other invoices to them after they have paid."
 *
 * The roster is a payment-week triage screen and it is good at that: eighty
 * rows ranked so the ones needing a person come first. It is bad at the other
 * job, which is one maker and one conversation, because every control on it
 * had to fit inside a table cell. Seven of them ended up folded into
 * disclosures a few pixels wide, all labelled "Change".
 *
 * So this page takes the same actions and gives them room. Nothing new
 * happens here: every form posts to the server action the roster already
 * posts to, which is what keeps the audit log, the idempotency bumps and the
 * Stripe session housekeeping identical whichever screen a person used
 * (CLAUDE.md rules 3 and 4).
 *
 * The invoice reads top to bottom: what they owe, then how to change it, then
 * what was taken off and by whom, then every write anybody has made against
 * this booking. Voided lines stay on the page (rule 3): an invoice that
 * quietly loses a row cannot be reconciled against the bank in December.
 */

/** One labelled fact. `n` is the figure column, right aligned and tabular. */
function Row({ k, children, n }: { k: string; children: React.ReactNode; n?: React.ReactNode }) {
  return (
    <tr>
      <th scope="row">{k}</th>
      <td>{children}</td>
      {n !== undefined && <td className="n">{n}</td>}
    </tr>
  )
}

/** A JSON blob out of the audit log, as one readable line. Never thrown by a
 *  row somebody wrote by hand, and never expanded into anything shaped like a
 *  document: these columns hold status and money, not PII (rule 9). */
function auditWords(raw: string | null): string {
  if (!raw) return ''
  try {
    const v = JSON.parse(raw)
    if (v === null || typeof v !== 'object') return String(v)
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== undefined && x !== '')
      .map(([k, x]) => `${k} ${typeof x === 'number' && /cents$/i.test(k) ? usd(x) : String(x)}`)
      .join(', ')
  } catch {
    return raw
  }
}

export default async function MakerDetail({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  /** `add` is a quick fill: the code of an add-on whose name and price land
   *  in the add-a-line form, ready to be pressed rather than typed. `resend`
   *  is how the invoice email reports back, and `addon` how taking an add-on
   *  off does: both are told to return here rather than to the roster. */
  searchParams: Promise<{ add?: string; resend?: string; addon?: string }>
}) {
  const { id } = await params
  const { add, resend, addon } = await searchParams

  const [row] = await db
    .select({ booking: bookings, vendor: vendors, app: applications, space: spaceTypes })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.id, id))
    .limit(1)
  if (!row) notFound()
  const { booking, vendor, app, space } = row

  /* The booking's own show, not the active one. A booking outlives a season
     and this page has to read correctly in February. */
  const show = await db.query.shows.findFirst({ where: eq(shows.id, booking.showId) })
  if (!show) notFound()

  /* The authoritative figures, from the one function that builds an invoice
     for this booking. The maker's pay page and the Stripe session are built
     from the same call, so what is printed here is what the maker is asked for. */
  const found = await boothInvoice(db, booking.id)
  if (!found) notFound()
  const { invoice } = found

  /* The same lines again, with their ids, because an invoice line has to be
     voidable and `Invoice` carries labels only. Oldest first, which is the
     order they happened in. */
  const charges = await db
    .select()
    .from(bookingCharges)
    .where(eq(bookingCharges.bookingId, booking.id))
    .orderBy(asc(bookingCharges.createdAt))
  const live = charges.filter((c) => !c.voidedAt)
  const dead = charges.filter((c) => c.voidedAt)

  /* Extras bought on the application, at the price snapshotted then. */
  const extras = await db
    .select({
      id: bookingAddons.id, name: addOns.name, priceCents: bookingAddons.priceCents,
      voidedAt: bookingAddons.voidedAt, voidedBy: bookingAddons.voidedBy,
      voidReason: bookingAddons.voidReason,
    })
    .from(bookingAddons)
    .innerJoin(addOns, eq(bookingAddons.addOnId, addOns.id))
    .where(eq(bookingAddons.bookingId, booking.id))

  /* Standing is separate from status on purpose: a confirmed booking that
     grew a second day is both paid and owing, and only this says so. */
  const ledger = ledgerFor({
    priceCents: booking.priceCents,
    addonsCents: booking.addonsCents,
    amountPaidCents: booking.amountPaidCents,
    charges: charges.map((c) => ({
      id: c.id, description: c.description, amountCents: c.amountCents, voidedAt: c.voidedAt,
    })),
  })

  /* Every write anybody has made against this booking, newest first. */
  const history = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, 'booking'), eq(auditLog.entityId, booking.id)))
    .orderBy(desc(auditLog.at))

  /* What this maker could be moved to, and what could be added to their
     invoice. Both come off the Show record rather than out of this file, so a
     price nobody typed here can never appear on an invoice (rule 6). */
  const spaceChoices = (await activeSpaceTypes(show.id)).filter((t) => t.track === space.track)
  const presets = chargePresets(await activeAddOns(show.id), space.track)
  const fill = presetFill(presets, add)

  const paid = isPaid(booking.status)
  const inFlight = booking.status === 'payment_processing'
  const gone = !holdsSpace(booking.status)
  /* The fee and the footprint are frozen once money has moved or is moving.
     Editing either then only makes the record disagree with the bank. */
  const frozen = paid || inFlight
  const thumb = thumbnailFor({ thumbnailUrl: app.thumbnailUrl, photos: app.photos })
  /* Why the invoice email would refuse, worked out before it is pressed. A
     button that bounces teaches somebody not to trust the screen. */
  const cannotResend = resendProblem({
    status: booking.status,
    amountDueCents: invoice.amountDueCents,
    payToken: booking.payToken,
    email: vendor.email,
  })
  /* Both kinds of removed line read the same to a person, so they are shown
     as one list rather than as two sections that happen to mean the same
     thing. Add-on ids and charge ids are both uuids, so the keys cannot
     collide. */
  const takenOff = [
    ...dead.map((c) => ({
      id: c.id, description: c.description, amountCents: c.amountCents,
      voidedAt: c.voidedAt, voidedBy: c.voidedBy, voidReason: c.voidReason,
    })),
    ...extras.filter((e) => e.voidedAt).map((e) => ({
      id: e.id, description: e.name, amountCents: e.priceCents,
      voidedAt: e.voidedAt, voidedBy: e.voidedBy, voidReason: e.voidReason,
    })),
  ]
  const resendSaid = resendNotice(resend ?? '')
  const addonSaid = addonNotice(addon ?? '')
  const permit = permitState({
    track: app.track, permitStatus: app.permitStatus,
    sellerPermit: app.sellerPermit, occasionalSeller: app.occasionalSeller,
  })

  return (
    <>
      {/* Scoped to this page. The preset strip is the one shape the admin does
          not already have, and globals.css is not mine to edit. */}
      <style>{`
        .mk-quick { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 18px; }
        .mk-quick a { text-decoration: none; }
        .mk-quick a[aria-current="true"] {
          background: var(--ad-ink); border-color: var(--ad-ink); color: #fff;
        }
        .mk-add { border: 1px solid var(--ad-line-2); border-radius: 2px;
          padding: 16px 18px 18px; background: var(--ad-card); }
        .mk-add .mk-fields { display: grid; gap: 12px 16px;
          grid-template-columns: minmax(0, 2fr) 110px minmax(0, 2fr); align-items: end; }
        .mk-add .adm-field { margin-bottom: 0; }
        .mk-total { display: flex; gap: 10px; align-items: baseline;
          justify-content: space-between; padding: 12px 0;
          border-bottom: 1px solid var(--ad-line); }
        .mk-total:last-child { border-bottom: 0; }
        .mk-total.due { border-top: 1px solid var(--ad-line-2); border-bottom: 0; }
        .mk-id { display: flex; gap: 16px; align-items: flex-start; }
        .mk-id img { width: 88px; height: 88px; object-fit: cover; border-radius: 2px;
          border: 1px solid var(--ad-line); background: var(--ad-sunk); }
        /* The who and why under a voided line, across both columns rather
           than squeezed under the description. */
        .adm-lines li > .adm-sub2 { grid-column: 1 / -1; }
        @media (max-width: 720px) {
          .mk-add .mk-fields { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      <nav className="adm-queue" aria-label="Back to the roster">
        <Link href="/admin/roster" className="adm-lk">
          <span aria-hidden="true">←</span> Roster
        </Link>
        <span className="pos">{booking.vendorCode}</span>
      </nav>

      {resendSaid && <p className="adm-note" role="status">{resendSaid}</p>}
      {addonSaid && <p className="adm-note" role="status">{addonSaid}</p>}

      <PageHead
        title={vendor.shopName}
        sub={`${booking.vendorCode} · ${space.label} · ${show.name} · ${fmtRange(show.startsOn, show.endsOn)}`}
      >
        <span className="adm-tags">
          <span className="adm-tag">{space.track === 'indoor' ? 'Indoor' : 'Outdoor'}</span>
          <span className="adm-tag" data-warn={paid || inFlight || gone ? undefined : '1'}>
            {gone ? 'Released' : paid ? 'Paid' : inFlight ? 'Clearing' : 'Not paid'}
          </span>
          <span className="adm-tag" data-warn={ledger.balanceCents > 0 ? '1' : undefined}>
            {standingWords(ledger)}
          </span>
        </span>
      </PageHead>

      <div className="adm-review">
        <div>
          {/* ── who they are ── */}
          <div className="adm-sec" style={{ marginTop: 0 }}>
            <h2>The maker</h2>
            <Link className="adm-lk" href={`/admin/applications/${app.id}`}>
              Their application <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="mk-id">
            {thumb.url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={thumb.url} alt={`${vendor.shopName}, from their application`} />
              : <span className="adm-thumb-none" aria-hidden="true">no photo</span>}
            <table className="adm-fx">
              <tbody>
                <Row k="Contact" n={booking.vendorCode}>
                  {vendor.contactName}
                  <span className="adm-sub2">
                    <a className="adm-a" href={`mailto:${vendor.email}`}>{vendor.email}</a>
                    {vendor.phone ? ` · ${vendor.phone}` : ''}
                  </span>
                </Row>
                <Row k="Space" n={usd(booking.priceCents)}>
                  {space.label}
                  <span className="adm-sub2">
                    {space.dimensions ? `${space.dimensions} · ` : ''}
                    {space.track === 'outdoor'
                      ? 'Outdoor booth, no commission'
                      : `Indoor consignment, ${bpsLabel(booking.commissionBps)} commission`}
                  </span>
                </Row>
                <Row k="Show">
                  {show.name}
                  <span className="adm-sub2">{show.venueName}</span>
                </Row>
                <Row k="Paperwork" n={permit === 'on_file' || permit === 'occasional_documented'
                  ? 'On file' : app.track === 'indoor' ? 'Not needed' : ''}>
                  {app.track === 'indoor'
                    ? 'Sells inside, so no permit is needed: Mermade is the retailer of record.'
                    : permit === 'on_file'
                      ? 'Seller’s permit number on file.'
                      : permit === 'occasional_documented'
                        ? 'CDTFA-410-D on file.'
                        : 'No permit number and no 410-D yet. This blocks load-in.'}
                </Row>
              </tbody>
            </table>
          </div>

          {/* ── the invoice ── */}
          <div className="adm-sec">
            <h2>Invoice</h2>
            <span className="c">{invoice.lines.length} {invoice.lines.length === 1 ? 'line' : 'lines'}</span>
          </div>
          <table className="adm-fx">
            <caption className="adm-sr">
              What {vendor.shopName} owes for {show.name}, line by line.
            </caption>
            <tbody>
              <Row k="Space" n={usd(booking.priceCents)}>{space.label}</Row>
              {extras.filter((e) => !e.voidedAt).map((e) => (
                <Row key={e.id} k="Add-on" n={usd(e.priceCents)}>
                  {e.name}
                  {/* The control Hillary went looking for and did not find.
                      An add-on is the line staff most often need to remove
                      and it was the one line with nothing on it. */}
                  <details className="adm-mask" style={{ marginTop: 8 }}>
                    <summary>
                      <span className="mk">Take off</span>
                      <span className="adm-sr"> {e.name}</span>
                    </summary>
                    <form action={voidBoothAddon}>
                      <input type="hidden" name="addonId" value={e.id} />
                      <input type="hidden" name="back" value={`/admin/roster/${booking.id}`} />
                      <label className="adm-sr" htmlFor={`va-${e.id}`}>
                        Why this add-on comes off
                      </label>
                      <input className="inp" id={`va-${e.id}`} name="reason" type="text"
                        placeholder="Why (goes in the audit log)" />
                      <button className="adm-btn-q" type="submit">Take it off</button>
                    </form>
                  </details>
                </Row>
              ))}
              {live.map((c) => (
                <Row key={c.id} k="Line" n={usd(c.amountCents)}>
                  {c.description}
                  <span className="adm-sub2">
                    Added {fmtDateTime(c.createdAt)} by {c.createdBy}
                    {c.reason ? ` · ${c.reason}` : ''}
                  </span>
                  <details className="adm-mask" style={{ marginTop: 8 }}>
                    <summary>
                      <span className="mk">Take off</span>
                      <span className="adm-sr"> {c.description}</span>
                    </summary>
                    <form action={voidBoothCharge}>
                      <input type="hidden" name="chargeId" value={c.id} />
                      <label className="adm-sr" htmlFor={`vr-${c.id}`}>
                        Why this line comes off
                      </label>
                      <input className="inp" id={`vr-${c.id}`} name="reason" type="text"
                        placeholder="Why (goes in the audit log)" />
                      <button className="adm-btn-q" type="submit">Take it off</button>
                    </form>
                  </details>
                </Row>
              ))}
            </tbody>
          </table>

          <div style={{ maxWidth: 760, marginTop: 18 }}>
            <p className="mk-total">
              <span>Invoice total</span>
              <span className="adm-money">{usd(invoice.totalCents)}</span>
            </p>
            <p className="mk-total">
              <span>Paid{booking.paidVia ? ` by ${viaLabel(booking.paidVia).toLowerCase()}` : ''}</span>
              <span className="adm-money">{usd(invoice.paidCents)}</span>
            </p>
            <p className="mk-total due">
              <span><strong>Still to pay</strong></span>
              <span className="adm-money"><strong>{usd(invoice.amountDueCents)}</strong></span>
            </p>
            {standing(ledger) === 'overpaid' && (
              <p className="adm-note">
                {usd(-ledger.balanceCents)} more has arrived than this invoice now asks for.
                Refund it or carry it as a credit: nothing here moves money either way.
              </p>
            )}
          </div>

          {/* ── the headline control ──
              Open, not folded away. This is the thing the roster made hard:
              a second day, a corner, priority placement, a credit. It works
              whether or not they have paid, which is the case it exists for. */}
          <div className="adm-sec" id="add">
            <h2>Add a line</h2>
            <span className="c">lands on the invoice at once</span>
          </div>
          {gone && (
            <p className="adm-note tight">
              This booking no longer holds a space, so nothing more will be collected against
              it. A line added here is a record, not a bill.
            </p>
          )}
          {presets.length > 0 && (
            <>
              <p className="adm-note tight">
                Press one to fill the form below, then Add line. Prices come from the show
                settings, so they are whatever {show.name} is charging.
              </p>
              <div className="mk-quick">
                {presets.map((p) => (
                  <a
                    key={p.code} className="adm-btn-q"
                    href={`/admin/roster/${booking.id}?add=${encodeURIComponent(p.code)}#add`}
                    aria-current={add === p.code ? 'true' : undefined}
                  >
                    {p.label} {usd(p.amountCents)}
                  </a>
                ))}
              </div>
            </>
          )}
          <form action={addBoothCharge} className="mk-add">
            <input type="hidden" name="bookingId" value={booking.id} />
            <div className="mk-fields">
              <label className="adm-field" htmlFor="cd">
                <span className="lb">What it is for</span>
                <input className="inp" id="cd" name="description" type="text" required
                  defaultValue={fill.description} autoComplete="off"
                  placeholder="Sunday booth, corner, priority" />
              </label>
              <label className="adm-field" htmlFor="ca">
                <span className="lb">Dollars</span>
                <input className="inp" id="ca" name="dollars" type="text" required
                  inputMode="decimal" defaultValue={fill.dollars} autoComplete="off"
                  placeholder="450.00" />
              </label>
              <label className="adm-field" htmlFor="cr">
                <span className="lb">Why</span>
                <input className="inp" id="cr" name="reason" type="text" autoComplete="off"
                  placeholder="Goes in the audit log" />
              </label>
            </div>
            <button className="adm-btn" type="submit" style={{ marginTop: 16 }}>
              Add line
              <span className="adm-sr"> to {vendor.shopName}&rsquo;s invoice</span>
            </button>
            <p className="adm-note" style={{ marginTop: 12 }}>
              A minus sign takes money off: type -40.00 for a credit. The pay link then asks
              for the balance and never the whole fee again. Any half-finished Stripe checkout
              of theirs is cancelled, so the old figure cannot be paid by mistake.
            </p>
          </form>

          {/* ── what was taken off ──
              Quieter, and never gone. Rule 3: voided, not deleted, with who
              and why, so this invoice can be read back in December. */}
          {takenOff.length > 0 && (
            <>
              <div className="adm-sec">
                <h2>Taken off</h2>
                <span className="c">{takenOff.length} voided</span>
              </div>
              <ul className="adm-lines" style={{ maxWidth: 760 }}>
                {takenOff.map((c) => (
                  <li key={c.id} className="off">
                    <span>{c.description}</span>
                    <span className="adm-money">{usd(c.amountCents)}</span>
                    <span className="adm-sub2">
                      Taken off {c.voidedAt ? fmtDateTime(c.voidedAt) : ''}
                      {c.voidedBy ? ` by ${c.voidedBy}` : ''}
                      {c.voidReason ? ` · ${c.voidReason}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="adm-note">
                These do not count towards the total. They stay here so the invoice adds up
                the same way in December as it does today.
              </p>
            </>
          )}

          {/* ── every write against this booking ── */}
          <div className="adm-sec">
            <h2>History</h2>
            <span className="c">
              {history.length} {history.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          {history.length === 0 ? (
            <p className="adm-empty">Nothing has changed on this booking yet.</p>
          ) : (
            <ol className="adm-time">
              {history.map((h) => (
                <li key={h.id} className="adm-time__row">
                  <div className="adm-time__when mono">{fmtDateTime(h.at)}</div>
                  <div>
                    <div className="adm-time__title">{h.action.replace(/_/g, ' ')}</div>
                    <div className="adm-sub2">by {h.actor}{h.reason ? ` · ${h.reason}` : ''}</div>
                    {(auditWords(h.before) || auditWords(h.after)) && (
                      <div className="adm-sub2">
                        {auditWords(h.before) && <>was {auditWords(h.before)}. </>}
                        {auditWords(h.after) && <>now {auditWords(h.after)}.</>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="adm-foot">
            <p className="adm-note">
              <strong>Saving anything here returns you to the roster list.</strong> The actions
              are shared with that screen and it is where they land. Click back into this maker
              to carry on.
            </p>
            <p className="adm-note">
              <strong>Commission is snapshotted on the booking</strong> and never changes.
              Changing the show rate later has no effect on what this maker was promised.
            </p>
          </div>
        </div>

        {/* ── the money rail ── */}
        <aside className="adm-rail" aria-label="Payment and the link">
          <span className="k">Booth fee</span>
          <table className="adm-fx" style={{ marginTop: 10 }}>
            <tbody>
              <Row k="Status">
                <span className="adm-st" data-warn={paid || inFlight || gone ? undefined : '1'}>
                  {gone ? 'Released' : paid ? 'Paid' : inFlight ? 'Clearing' : 'Not paid'}
                </span>
                <span className="adm-sub2">
                  {/* A released booking has no deadline left to print, and
                      printing one read as a maker who was late. What it may
                      still have is money that arrived, which the row below
                      says, and a reason, which the history says. */}
                  {gone
                    ? 'The space is back in the pool.'
                    : paid
                      ? [booking.paidAt && fmtDateTime(booking.paidAt), viaLabel(booking.paidVia)]
                        .filter(Boolean).join(' · ')
                      : inFlight
                        ? `${viaLabel(booking.paidVia ?? 'bank')}, about 4 business days`
                        : `Due ${fmtDateTime(booking.paymentDueAt)}`}
                </span>
              </Row>
              <Row k="Received" n={usd(booking.amountPaidCents ?? 0)}>
                {booking.amountPaidCents
                  ? 'What Stripe or a person recorded as arriving.'
                  : 'Nothing recorded against this booking yet.'}
              </Row>
              <Row k="Stripe">
                {booking.stripeSessionId
                  ? 'A checkout was started.'
                  : 'No checkout started.'}
                {booking.stripePaymentIntentId && (
                  <span className="adm-sub2">A payment intent exists.</span>
                )}
              </Row>
              <Row k="Their link">
                {booking.linkSentAt
                  ? `Marked sent ${fmtDateTime(booking.linkSentAt)}`
                  : 'Nobody has marked it sent.'}
                {booking.linkSentBy && <span className="adm-sub2">by {booking.linkSentBy}</span>}
              </Row>
              <Row k="Fee email">
                {booking.feeEmailAt
                  ? `Sent ${fmtDateTime(booking.feeEmailAt)}`
                  : 'Not sent from here.'}
              </Row>
              {booking.saidSentAt && (
                <Row k="They say">
                  Sent {booking.saidSentVia === 'zelle' ? 'a Zelle' : 'a Venmo'}
                  <span className="adm-sub2">
                    {fmtDateTime(booking.saidSentAt)} · the note reads {booking.vendorCode}
                  </span>
                </Row>
              )}
            </tbody>
          </table>

          {/* Money Stripe never sees. A card or a transfer is confirmed by a
              verified webhook and never by a person (rule 5). */}
          {!paid && !inFlight && !gone && (
            <>
              <div className="adm-sec" style={{ margin: '24px 0 10px', border: 0, paddingBottom: 0 }}>
                <h2>Mark paid</h2>
              </div>
              <form action={markPaid} className="adm-paid">
                <input type="hidden" name="bookingId" value={booking.id} />
                <label className="adm-sr" htmlFor="via">How {vendor.shopName} paid</label>
                <select className="inp" id="via" name="via"
                  defaultValue={booking.saidSentVia ?? ''} required>
                  <option value="">Paid how?</option>
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Cash, check, other</option>
                </select>
                <button className="adm-btn-q" type="submit">
                  Mark paid
                  <span className="adm-sr"> for {vendor.shopName}</span>
                </button>
              </form>
              <p className="adm-note" style={{ marginTop: 10 }}>
                For a Venmo, a Zelle or a check. Cards and bank transfers confirm themselves.
              </p>
            </>
          )}

          {/* The link, and the invoice email that carries the balance. */}
          <div className="adm-sec" style={{ margin: '24px 0 10px', border: 0, paddingBottom: 0 }}>
            <h2>Send it to them</h2>
          </div>
          {booking.payToken ? (
            <>
              <PayLink
                url={`${siteUrl()}/pay/${booking.payToken}`}
                sent={Boolean(booking.linkSentAt)}
              />
              <form action={markLinkSent} style={{ marginTop: 10 }}>
                <input type="hidden" name="bookingId" value={booking.id} />
                {booking.linkSentAt && <input type="hidden" name="undo" value="1" />}
                <button className="adm-btn-q" type="submit">
                  {booking.linkSentAt ? 'Sent, undo' : 'Mark sent'}
                  <span className="adm-sr"> for {vendor.shopName}</span>
                </button>
              </form>
            </>
          ) : (
            <p className="adm-note">
              No pay link on this booking. This maker signs in at the maker portal and the
              invoice is there.
            </p>
          )}
          {/* The other half of what Drew asked for: bill somebody again after
              they have paid. It carries the balance as it stands right now, so
              a maker who paid for Saturday and added Sunday is asked for
              Sunday. Not offered on a released booking, which is nobody to
              bill. */}
          {!gone && (
            <>
              <form action={resendBoothInvoice} style={{ marginTop: 12 }}>
                <input type="hidden" name="bookingId" value={booking.id} />
                {/* This action takes a return path, so pressing it lands back
                    on this maker rather than in the roster table. */}
                <input type="hidden" name="back" value={`/admin/roster/${booking.id}`} />
                <label className="adm-field" htmlFor="note">
                  <span className="lb">A line at the top, if it needs one</span>
                  <input className="inp" id="note" name="note" type="text"
                    maxLength={NOTE_MAX} autoComplete="off"
                    placeholder="Sunday added, as we discussed" />
                  <span className="hint">
                    The maker reads this as What changed. Leave it empty and the email is
                    the invoice alone.
                  </span>
                </label>
                <button className="adm-btn" type="submit">
                  Email the invoice
                  <span className="adm-sr"> to {vendor.shopName}</span>
                </button>
              </form>
              <p className="adm-note" style={{ marginTop: 10 }}>
                {cannotResend === 'settled'
                  ? 'Nothing is owed today, so this will not send. Add a line above first, '
                    + 'then email it.'
                  : cannotResend === 'nolink'
                    ? 'This booking has no pay link, so an invoice would name no way to pay.'
                    : cannotResend === 'released'
                      ? 'A bank transfer is already on its way, so asking again is how '
                        + 'somebody pays twice.'
                      : `Sends the booth-fee invoice again with the balance as it stands, ${usd(invoice.amountDueCents)} today. This is how you bill a maker who paid once and has since added something.`}
              </p>
            </>
          )}

          {/* Both frozen once money has moved. */}
          {!frozen && !gone && (
            <>
              <div className="adm-sec" style={{ margin: '24px 0 10px', border: 0, paddingBottom: 0 }}>
                <h2>Change the fee</h2>
              </div>
              <p className="adm-note tight">
                This is the space alone. The maker sees {usd(invoice.totalCents)}, because
                add-ons and lines sit on top of it.
              </p>
              <form action={setBoothPrice}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <label className="adm-field" htmlFor="price">
                  <span className="lb">Space fee in dollars</span>
                  <input className="inp" id="price" name="dollars" type="text" inputMode="decimal"
                    defaultValue={dollarsField(booking.priceCents)} autoComplete="off" />
                </label>
                <label className="adm-field" htmlFor="pr">
                  <span className="lb">Why</span>
                  <input className="inp" id="pr" name="reason" type="text" autoComplete="off"
                    placeholder="Goes in the audit log" />
                </label>
                <button className="adm-btn-q" type="submit">Save fee</button>
                {booking.priceVersion > 1 && (
                  <span className="adm-sub2">Changed {booking.priceVersion - 1} times.</span>
                )}
              </form>

              {spaceChoices.length > 1 && (
                <>
                  <div className="adm-sec" style={{ margin: '24px 0 10px', border: 0, paddingBottom: 0 }}>
                    <h2>Change the space</h2>
                  </div>
                  <form action={setBoothSpace}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <label className="adm-field" htmlFor="spaceTypeId">
                      <span className="lb">New space</span>
                      <select className="inp" id="spaceTypeId" name="spaceTypeId"
                        defaultValue={booking.spaceTypeId}>
                        {spaceChoices.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} (lists at {usd(t.priceCents)})
                          </option>
                        ))}
                      </select>
                      <span className="hint">
                        The fee stays {usd(booking.priceCents)} until you change it too.
                      </span>
                    </label>
                    <label className="adm-field" htmlFor="sr">
                      <span className="lb">Why</span>
                      <input className="inp" id="sr" name="reason" type="text" autoComplete="off"
                        placeholder="Goes in the audit log" />
                    </label>
                    <button className="adm-btn-q" type="submit">Save space</button>
                  </form>
                </>
              )}
            </>
          )}

          {frozen && !gone && (
            <p className="adm-note" style={{ marginTop: 24 }}>
              The fee and the space are fixed now that money has moved. Add a line instead: it
              keeps the original fee and the change both legible. A fee that is genuinely
              wrong needs a refund and a person, not an edit.
            </p>
          )}

          {/* ── taking the space back ──
              Folded away and the only red control on the page. A space taken
              back from somebody who was told they were in is a decision that
              has to be explainable in November, so the reason is required. */}
          {!gone && (
            <details className="adm-danger">
              <summary>Remove {vendor.shopName} from the show</summary>
              <p className="adm-note">
                The space goes back into the pool, the pay link stops taking money, and the
                reason is written to the audit log. Nothing is sent to the maker: that note is
                yours to write.
              </p>
              <form action={cancelBooking}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <label className="adm-field" htmlFor="why">
                  <span className="lb">Why this space is being taken back</span>
                  <input className="inp" id="why" name="reason" required minLength={3}
                    maxLength={200} autoComplete="off" placeholder="Dropped out, 3 Oct" />
                </label>
                {frozen && (
                  <label className="adm-check" htmlFor="confirmPaid">
                    <input type="checkbox" id="confirmPaid" name="confirmPaid" />
                    <span>
                      {usd(ledger.paidCents)} has been paid. Refund it in Stripe or send it back
                      by hand first: removing them here does not.
                    </span>
                  </label>
                )}
                <button className="adm-btn-danger" type="submit">
                  {frozen ? 'Remove' : 'Release'}
                  <span className="adm-sr"> {vendor.shopName}&rsquo;s space</span>
                </button>
              </form>
            </details>
          )}

          {gone && (
            <p className="adm-note" style={{ marginTop: 24 }}>
              This booking was {booking.status === 'forfeited' ? 'forfeited' : 'released'}, so
              the space is back in the pool. The invoice and its history stay here.
            </p>
          )}
        </aside>
      </div>
    </>
  )
}
