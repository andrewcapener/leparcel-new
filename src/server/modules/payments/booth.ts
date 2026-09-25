/**
 * Booth fee payments, end to end.
 *
 * The flow, and where each CLAUDE.md rule lands:
 *
 *   accepted → booking(awaiting_payment, price snapshotted)   rule 6
 *   maker opens /account, sees the invoice built from that booking
 *   Pay → Checkout Session, keyed on the booking                rule 4
 *   maker pays on Stripe's page
 *   webhook, signature verified, event id stored                rule 5
 *   amounts compared exactly, booking → confirmed               rule 2
 *   every transition written to the audit log                   rule 3
 *
 * The browser is never told anything it is trusted on. The redirect back from
 * Stripe says "thanks", and the booking is confirmed by the webhook, which may
 * well arrive first. Both orders are fine because confirmation is idempotent.
 */
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import type { db as Db } from '@/db'
import { bookings, bookingAddons, bookingCharges, addOns, spaceTypes, stripeEvents, auditLog, vendors } from '@/db/schema'
import { stripe, webhookSecret } from './config'
import {
  invoiceFor, paymentMatches, bookingPaymentKey, paymentDoor, checkoutLines, type Invoice,
} from './invoice'
import { stripeMethods, type PaymentMethods } from './methods'
import { canCollect } from './booking-status'
import { viaFromEvent } from './paid-via'
import { recordAccount } from './connect'
import { pushPaymentTabsIfConnected } from '@/server/modules/roster/sheet-push'
import { siteUrl } from '@/lib/site-url'

export type DbHandle = typeof Db

/** The booking plus everything needed to show and charge for it. */
export async function boothInvoice(
  db: DbHandle, bookingId: string,
): Promise<{ invoice: Invoice; booking: typeof bookings.$inferSelect } | undefined> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!booking) return undefined

  /* The booking had to come first, for its space id. These three did not have
     to wait on each other, and reading them in a row cost this invoice three
     database latencies for nothing. Every page that prices a booth builds
     through here, so the waterfall was paid on all of them. */
  const [[space], extras, changes] = await Promise.all([
    db.select().from(spaceTypes).where(eq(spaceTypes.id, booking.spaceTypeId)).limit(1),
    db
      .select({ name: addOns.name, priceCents: bookingAddons.priceCents })
      .from(bookingAddons)
      .innerJoin(addOns, eq(bookingAddons.addOnId, addOns.id))
      .where(eq(bookingAddons.bookingId, bookingId)),
    /* Everything added or taken off since the booking was made. Voided lines
       are left out of the arithmetic and stay in the table, so an invoice can
       still be read back in December (rule 3). */
    db
      .select({
        description: bookingCharges.description,
        amountCents: bookingCharges.amountCents,
        voidedAt: bookingCharges.voidedAt,
      })
      .from(bookingCharges)
      .where(eq(bookingCharges.bookingId, bookingId)),
  ])

  /* Prices come off the BOOKING and its add-on rows, never off space_types or
     add_ons today. The join above reaches add_ons only for the name. */
  return {
    booking,
    invoice: invoiceFor({
      spaceLabel: space?.label ?? 'Your space',
      spacePriceCents: booking.priceCents,
      addons: extras.map((e) => ({ name: e.name, priceCents: e.priceCents })),
      charges: changes
        .filter((c) => !c.voidedAt)
        .map((c) => ({ label: c.description, amountCents: c.amountCents })),
      /* What has arrived, so the invoice can say what is LEFT. A maker who
         paid for Saturday and added Sunday is asked for Sunday. */
      paidCents: booking.amountPaidCents ?? 0,
    }),
  }
}

/**
 * The booking a pasted payment link points at.
 *
 * Token comparison is a plain equality check on a 64 character random value,
 * which is not a secret worth timing-attacking: an attacker who can guess this
 * can already pay somebody else's invoice, which costs them money and gains
 * them nothing.
 *
 * Returns undefined for a token that is empty, unknown, or attached to a
 * booking that no longer holds a space, so the page can say "this link is no
 * longer live" without leaking whether the token was ever real.
 */
export async function bookingByPayToken(
  db: DbHandle, token: string,
): Promise<{
  id: string; showId: string; email: string
  /* Whose booking it is, in their own words. The page used to head itself
     with the MM code, which is a poor name for a page and, outdoors, reads
     as a booth number. */
  shopName: string
  /* The maker behind the booking, and where they stand on getting paid. The
     token authorises this booking, so it authorises both directions of money
     on it: paying the fee, and setting up how the maker is paid back. */
  vendorId: string
  /* The booked space's track, not the application's. An application can say
     "both"; only the space knows where they ended up, and only an indoor
     maker is ever owed anything. */
  track: string
  stripeAccountId: string | null
  payoutsEnabled: boolean
  connectRequirements: string
  connectDisabledReason: string | null
} | undefined> {
  const t = token.trim()
  if (t.length < 32) return undefined
  const [row] = await db
    .select({
      id: bookings.id, showId: bookings.showId, email: vendors.email,
      shopName: vendors.shopName,
      vendorId: vendors.id,
      track: spaceTypes.track,
      stripeAccountId: vendors.stripeAccountId,
      payoutsEnabled: vendors.payoutsEnabled,
      connectRequirements: vendors.connectRequirements,
      connectDisabledReason: vendors.connectDisabledReason,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.payToken, t))
    .limit(1)
  return row
}

export type CheckoutResult =
  | { outcome: 'unconfigured' }
  | { outcome: 'missing' }
  | { outcome: 'already_paid' }
  /** The space was released or cancelled. The link still exists; the booking
   *  does not. */
  | { outcome: 'released' }
  | { outcome: 'ready'; url: string }
  | { outcome: 'failed'; detail: string }

/**
 * A Checkout Session for one booking.
 *
 * Hosted Checkout rather than Elements: it takes card and ACH from one
 * integration, Stripe hosts the page so no card data touches this app, and it
 * is far less of our code standing between a maker and a deadline.
 *
 * ACH is offered alongside card because the fee difference is real money to
 * this business: 0.8% capped at $5 against 2.9% + 30c, which on a $450 outdoor
 * booth is $5 instead of $13.35 (docs/04 section 2.1).
 *
 * Idempotent on the booking (rule 4). A maker who double-clicks, or reloads
 * mid-redirect, is handed the same session rather than a second one against
 * the same space.
 */
export async function startBoothPayment(
  db: DbHandle, bookingId: string, email: string,
  /* The Show's policy, passed in rather than read here so this stays a pure
     function of its arguments and the caller owns the one database read. */
  policy: PaymentMethods = 'card_and_bank',
  /* Where Stripe returns them. This used to be hardcoded to /account, which
     was right when /account was the only door and wrong the moment staff
     started pasting /pay/<token> links: that maker has no session, so paying
     successfully dropped them on a sign-in box. Landing somebody on a login
     screen at the exact moment they have just given you money is the worst
     possible thank-you. */
  back = '/account',
): Promise<CheckoutResult> {
  const s = stripe()
  if (!s) return { outcome: 'unconfigured' }

  const found = await boothInvoice(db, bookingId)
  if (!found) return { outcome: 'missing' }
  const { booking, invoice } = found
  /* The BALANCE says whether there is anything to collect, not the status.
     A booking that was paid and then grew a second day is confirmed and still
     owes, and this used to refuse it: the maker saw the new line on her
     invoice and had no way to pay it. */
  if (invoice.amountDueCents <= 0) return { outcome: 'already_paid' }
  /* Anything the status rules out: a released space, or a transfer already in
     flight that a second charge would double. */
  if (!canCollect(booking.status, invoice.amountDueCents)) return { outcome: 'released' }

  /* An existing session is reused while it is still open. Stripe expires a
     session after 24 hours, and the payment window is 48, so a maker who
     starts on day one and finishes on day two must not be handed a dead url. */
  if (booking.stripeSessionId) {
    try {
      const existing = await s.checkout.sessions.retrieve(booking.stripeSessionId)
      if (existing.status === 'open' && existing.url) {
        /* Reused only when it would return them to the same door. A maker who
           opened the portal once and then used a pasted link would otherwise
           be handed the portal's session and bounced to a sign-in box after
           paying. */
        if ((existing.success_url ?? '').startsWith(`${siteUrl()}${back}?`)) {
          return { outcome: 'ready', url: existing.url }
        }
        /* The other door's, and still live. Expired rather than abandoned, so
           exactly one session for this booking is ever payable: two open
           checkouts is how a maker pays their booth fee twice and needs a
           refund, and no amount of webhook care undoes a captured card. */
        await s.checkout.sessions.expire(existing.id)
      }
    } catch {
      /* Gone or unreadable. Fall through and make a new one rather than
         stranding the maker on an error. */
    }
  }

  try {
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      /* Whatever the Show record says, and never an empty list. */
      payment_method_types: stripeMethods(policy),
      line_items: checkoutLines(invoice, "Mermade Market").map((l) => ({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: l.amountCents,          // integer cents, rule 1
          product_data: { name: l.label },
        },
      })),
      /* The booking id travels with the payment so the webhook never has to
         guess which booking an event belongs to. */
      client_reference_id: booking.id,
      metadata: { bookingId: booking.id, vendorCode: booking.vendorCode },
      payment_intent_data: {
        metadata: { bookingId: booking.id, vendorCode: booking.vendorCode },
      },
      success_url: `${siteUrl()}${back}?paid=1`,
      cancel_url: `${siteUrl()}${back}`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    }, {
      idempotencyKey: bookingPaymentKey(booking.id, paymentDoor(back), booking.priceVersion),
    })

    if (!session.url) return { outcome: 'failed', detail: 'Stripe returned a session with no url' }

    await db.update(bookings)
      .set({ stripeSessionId: session.id })
      .where(eq(bookings.id, booking.id))

    return { outcome: 'ready', url: session.url }
  } catch (err) {
    /* Never echo the exception verbatim: Stripe puts request context in some
       errors and the key is in this process (rule 9). */
    const detail = err instanceof Error ? err.message.slice(0, 200) : 'unknown Stripe error'
    return { outcome: 'failed', detail }
  }
}

/**
 * Kill any live Checkout Session for a booking.
 *
 * Called when the price changes, and the reason it must be is not obvious: a
 * Session's line items are fixed at creation. Leave an old one open and the
 * maker can still open the email they already have, pay the OLD amount, and be
 * confirmed by a webhook that compares the payment against the NEW invoice and
 * calls it a mismatch. The money is captured, the booking is not confirmed,
 * and somebody has to unpick it by hand.
 *
 * Failures are swallowed. An already-expired or already-paid session throws,
 * and neither is a reason to refuse a price correction.
 */
export async function dropLiveCheckout(db: DbHandle, bookingId: string): Promise<void> {
  const s = stripe()
  const [booking] = await db.select({ sid: bookings.stripeSessionId })
    .from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (s && booking?.sid) {
    try { await s.checkout.sessions.expire(booking.sid) } catch { /* already gone */ }
  }
  await db.update(bookings).set({ stripeSessionId: null }).where(eq(bookings.id, bookingId))
}

export type WebhookResult =
  | { outcome: 'unconfigured' }
  | { outcome: 'bad_signature' }
  | { outcome: 'duplicate'; eventId: string }
  | { outcome: 'ignored'; eventId: string; type: string }
  | { outcome: 'confirmed'; eventId: string; bookingId: string }
  | { outcome: 'processing'; eventId: string; bookingId: string }
  | { outcome: 'payment_failed'; eventId: string; bookingId: string }
  | { outcome: 'mismatch'; eventId: string; bookingId: string; detail: string }
  /** A maker's Connect account changed. Nothing to do with a booking: this is
   *  the money going the other way. */
  | { outcome: 'account_updated'; eventId: string; accountId: string }

/**
 * The three events a Checkout payment can arrive on, and why all three matter.
 *
 * A CARD pays synchronously: `checkout.session.completed` arrives with
 * payment_status "paid" and that is the whole story.
 *
 * A BANK TRANSFER does not. ACH Direct Debit is what Stripe calls a delayed
 * notification method: `checkout.session.completed` fires when the maker
 * authorises the debit, with payment_status "unpaid", and the money lands days
 * later on `checkout.session.async_payment_succeeded`, or does not land at all
 * on `checkout.session.async_payment_failed`. Stripe's docs put settlement at
 * "typically 4 business days".
 *
 * Handling only `completed` and requiring "paid" would have been catastrophic
 * in a quiet way: every maker who chose bank transfer would have authorised
 * the payment, been recorded as a MISMATCH, never been confirmed, and had
 * their space forfeited at hour 48 for paying on time. Bank transfer is the
 * option this business should want people to take, because it is $5 instead
 * of $13.35 on an outdoor booth.
 */
const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
])

/**
 * Handle one webhook. The ONLY thing in this codebase that marks a booking
 * paid (rule 5).
 *
 * `rawBody` must be the untouched request body: Stripe's signature is over the
 * exact bytes, so anything that re-serialises the JSON first breaks
 * verification in a way that looks like an attack.
 */
/**
 * Refresh the team's Google Sheet after a payment moves.
 *
 * This is the path that makes the Payments tab live: most of the money
 * arrives through Stripe and nobody presses anything when it does. It is
 * capped and swallowed inside pushPaymentTabsIfConnected, so a slow or
 * unreachable Google can neither fail this webhook nor push it past Stripe's
 * ten second timeout into a retry.
 */
async function refreshSheet(db: DbHandle, showId: string): Promise<void> {
  const show = await db.query.shows.findFirst({ where: (t, { eq: e }) => e(t.id, showId) })
  await pushPaymentTabsIfConnected(db, showId, show?.paymentSheetId, siteUrl())
}

export async function handleStripeWebhook(
  db: DbHandle, rawBody: string, signature: string | null,
): Promise<WebhookResult> {
  const s = stripe()
  const secret = webhookSecret()
  /* No keys on this deployment is a different thing from a caller that sent
     no signature, and saying the first when you mean the second sends
     somebody hunting for missing environment variables that are all present.
     An unsigned POST is simply not from Stripe. */
  if (!s || !secret) return { outcome: 'unconfigured' }
  if (!signature) return { outcome: 'bad_signature' }

  let event
  try {
    event = await s.webhooks.constructEventAsync(rawBody, signature, secret)
  } catch {
    /* An unverified event is not evidence of anything. Nothing is written,
       not even a record that it arrived: an attacker must not be able to fill
       this table by posting garbage. */
    return { outcome: 'bad_signature' }
  }

  /* Claim the event id first. The insert IS the lock: a replay of the same
     delivery conflicts here and stops, so the work below runs exactly once
     even if Stripe sends it three times. */
  const claimed = await db.insert(stripeEvents)
    .values({ id: event.id, type: event.type, payload: '' })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id })
  if (claimed.length === 0) return { outcome: 'duplicate', eventId: event.id }

  const finish = async (patch: { bookingId?: string; payload?: string; error?: string }) => {
    await db.update(stripeEvents).set({
      processedAt: new Date().toISOString(),
      bookingId: patch.bookingId ?? null,
      payload: patch.payload ?? '',
      error: patch.error ?? null,
    }).where(eq(stripeEvents.id, event.id))
  }

  /* Money going OUT, not in. Stripe sends this whenever a maker finishes a
     step of onboarding, uploads a document, or has a capability turned on or
     off, and it is the only thing allowed to write payouts_enabled: the
     account page reads our columns, so if this is not handled a maker who
     finished onboarding is still shown a half-done checklist.

     Handled before the booking lookup below, because there is no booking. */
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    await recordAccount(db, account)
    await finish({ payload: `payouts_enabled=${Boolean(account.payouts_enabled)}` })
    return { outcome: 'account_updated', eventId: event.id, accountId: account.id }
  }

  if (!HANDLED.has(event.type)) {
    await finish({ payload: 'not a payment outcome' })
    return { outcome: 'ignored', eventId: event.id, type: event.type }
  }

  const session = event.data.object as {
    id: string
    client_reference_id?: string | null
    payment_intent?: string | null
    amount_total?: number | null
    payment_status?: string | null
    /* What Checkout OFFERED, not what the maker chose. `viaFromEvent` is
       what turns it into a route, and it leans on the event type rather
       than on this list. */
    payment_method_types?: string[] | null
    metadata?: Record<string, string> | null
  }

  /* Card or bank transfer, decided from the event and written alongside the
     status. Stripe is the only thing allowed to write these two (rule 5), and
     this is the only place it happens. Null when the event does not settle
     it, in which case the column is left exactly as it was. */
  const via = viaFromEvent(
    event.type, session.payment_status, session.payment_method_types ?? [],
  )

  const bookingId = session.client_reference_id || session.metadata?.bookingId
  if (!bookingId) {
    await finish({ error: 'no booking id on the session' })
    return { outcome: 'mismatch', eventId: event.id, bookingId: '', detail: 'no booking id on the session' }
  }

  const found = await boothInvoice(db, bookingId)
  if (!found) {
    await finish({ bookingId, error: 'no such booking' })
    return { outcome: 'mismatch', eventId: event.id, bookingId, detail: 'no such booking' }
  }
  const { booking, invoice } = found
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

  /** Rule 3: actor, timestamp, before and after, reason. Stripe is the actor,
   *  because no person did this. */
  const audit = async (action: string, before: unknown, after: unknown) => {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'booking',
      entityId: booking.id,
      action,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      actor: 'stripe:webhook',
      reason: `${event.type} ${event.id}`,
    })
  }

  /* The transfer did not clear. Back to unpaid, and the session id is cleared
     so the Pay button builds a fresh one rather than reusing a dead session.
     A booking already confirmed is left alone: a late failure on a payment
     that already landed is a dispute, not a reversal, and is a person's
     problem rather than a status change. */
  if (event.type === 'checkout.session.async_payment_failed') {
    if (booking.status === 'confirmed') {
      await finish({ bookingId, payload: 'failure after confirmation, left alone' })
      return { outcome: 'confirmed', eventId: event.id, bookingId }
    }
    const before = { status: booking.status, paidVia: booking.paidVia }
    await db.update(bookings).set({
      status: 'awaiting_payment',
      stripeSessionId: null,
      /* The transfer is the route that did not happen, so it stops being
         this booking's route. Leaving 'bank' on an unpaid row would count
         it in tomorrow's bank column against money that never arrived. */
      paidVia: null,
    }).where(eq(bookings.id, booking.id))
    await audit('payment_failed', before, { status: 'awaiting_payment', paidVia: null })
    await finish({ bookingId, payload: 'bank transfer did not clear' })
    await refreshSheet(db, booking.showId)
    return { outcome: 'payment_failed', eventId: event.id, bookingId }
  }

  /* Already confirmed by an earlier event. Not an error: `completed` and
     `async_payment_succeeded` can both describe one successful payment. */
  if (booking.status === 'confirmed') {
    await finish({ bookingId, payload: 'already confirmed' })
    return { outcome: 'confirmed', eventId: event.id, bookingId }
  }

  const received = session.amount_total ?? 0

  /* Authorised but not settled. This is every bank transfer, on the
     `completed` event. The space is HELD: the maker did everything asked of
     them inside the window and the money is simply in transit. */
  if (session.payment_status !== 'paid') {
    if (!paymentMatches(invoice.amountDueCents, received)) {
      const detail = `expected ${invoice.amountDueCents}, stripe reported ${received} (${session.payment_status})`
      await finish({ bookingId, error: detail })
      return { outcome: 'mismatch', eventId: event.id, bookingId, detail }
    }
    const before = { status: booking.status, paidVia: booking.paidVia }
    await db.update(bookings).set({
      status: 'payment_processing',
      stripePaymentIntentId: intentId,
      ...(via ? { paidVia: via } : {}),
    }).where(eq(bookings.id, booking.id))
    await audit('payment_processing', before,
      { status: 'payment_processing', amountCents: received, paidVia: via })
    await finish({ bookingId, payload: `bank transfer initiated, ${received} cents in flight` })
    await refreshSheet(db, booking.showId)
    return { outcome: 'processing', eventId: event.id, bookingId }
  }

  if (!paymentMatches(invoice.amountDueCents, received)) {
    const detail = `expected ${invoice.amountDueCents}, stripe reported ${received} (${session.payment_status})`
    await finish({ bookingId, error: detail })
    /* Deliberately NOT confirmed. A maker holding a space they did not fully
       pay for is worse than a maker who has to be emailed. */
    return { outcome: 'mismatch', eventId: event.id, bookingId, detail }
  }

  const before = {
    status: booking.status, paidAt: booking.paidAt,
    amountPaidCents: booking.amountPaidCents, paidVia: booking.paidVia,
  }
  const paidAt = new Date().toISOString()
  /* ADDED to what was already received, never replacing it. A maker who paid
     for Saturday and then paid the balance for Sunday has paid both, and
     overwriting the first figure with the second would report the show as
     having collected the top-up and lost the booth fee. */
  const paidSoFar = (booking.amountPaidCents ?? 0) + received
  await db.update(bookings).set({
    status: 'confirmed',
    paidAt,
    amountPaidCents: paidSoFar,
    stripePaymentIntentId: intentId,
    /* Left alone when the event does not settle the route, which keeps the
       'bank' written days earlier at authorisation rather than replacing a
       known answer with a blank one. */
    ...(via ? { paidVia: via } : {}),
  }).where(eq(bookings.id, booking.id))
  await audit('payment_confirmed', before,
    { status: 'confirmed', paidAt, amountPaidCents: paidSoFar, received,
      paidVia: via ?? booking.paidVia })
  await finish({ bookingId, payload: `confirmed ${received} cents` })
  await refreshSheet(db, booking.showId)
  return { outcome: 'confirmed', eventId: event.id, bookingId }
}

/** The vendor's email, for the Checkout session. */
export async function vendorEmailForBooking(db: DbHandle, bookingId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ email: vendors.email })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  return row?.email
}
