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
import type { db as Db } from '@/db'
import { bookings, bookingAddons, addOns, spaceTypes, stripeEvents, auditLog, vendors } from '@/db/schema'
import { stripe, webhookSecret } from './config'
import { invoiceFor, paymentMatches, bookingPaymentKey, type Invoice } from './invoice'
import { siteUrl } from '@/lib/site-url'

export type DbHandle = typeof Db

/** The booking plus everything needed to show and charge for it. */
export async function boothInvoice(
  db: DbHandle, bookingId: string,
): Promise<{ invoice: Invoice; booking: typeof bookings.$inferSelect } | undefined> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!booking) return undefined

  const [space] = await db.select().from(spaceTypes).where(eq(spaceTypes.id, booking.spaceTypeId)).limit(1)
  const extras = await db
    .select({ name: addOns.name, priceCents: bookingAddons.priceCents })
    .from(bookingAddons)
    .innerJoin(addOns, eq(bookingAddons.addOnId, addOns.id))
    .where(eq(bookingAddons.bookingId, bookingId))

  /* Prices come off the BOOKING and its add-on rows, never off space_types or
     add_ons today. The join above reaches add_ons only for the name. */
  return {
    booking,
    invoice: invoiceFor({
      spaceLabel: space?.label ?? 'Your space',
      spacePriceCents: booking.priceCents,
      addons: extras.map((e) => ({ name: e.name, priceCents: e.priceCents })),
    }),
  }
}

export type CheckoutResult =
  | { outcome: 'unconfigured' }
  | { outcome: 'missing' }
  | { outcome: 'already_paid' }
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
): Promise<CheckoutResult> {
  const s = stripe()
  if (!s) return { outcome: 'unconfigured' }

  const found = await boothInvoice(db, bookingId)
  if (!found) return { outcome: 'missing' }
  const { booking, invoice } = found
  if (booking.status === 'confirmed') return { outcome: 'already_paid' }

  /* An existing session is reused while it is still open. Stripe expires a
     session after 24 hours, and the payment window is 48, so a maker who
     starts on day one and finishes on day two must not be handed a dead url. */
  if (booking.stripeSessionId) {
    try {
      const existing = await s.checkout.sessions.retrieve(booking.stripeSessionId)
      if (existing.status === 'open' && existing.url) {
        return { outcome: 'ready', url: existing.url }
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
      /* Card and bank. Both, from day one. */
      payment_method_types: ['card', 'us_bank_account'],
      line_items: invoice.lines.map((l) => ({
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
      success_url: `${siteUrl()}/account?paid=1`,
      cancel_url: `${siteUrl()}/account`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    }, { idempotencyKey: bookingPaymentKey(booking.id) })

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

export type WebhookResult =
  | { outcome: 'unconfigured' }
  | { outcome: 'bad_signature' }
  | { outcome: 'duplicate'; eventId: string }
  | { outcome: 'ignored'; eventId: string; type: string }
  | { outcome: 'confirmed'; eventId: string; bookingId: string }
  | { outcome: 'mismatch'; eventId: string; bookingId: string; detail: string }

/**
 * Handle one webhook. The ONLY thing in this codebase that marks a booking
 * paid (rule 5).
 *
 * `rawBody` must be the untouched request body: Stripe's signature is over the
 * exact bytes, so anything that re-serialises the JSON first breaks
 * verification in a way that looks like an attack.
 */
export async function handleStripeWebhook(
  db: DbHandle, rawBody: string, signature: string | null,
): Promise<WebhookResult> {
  const s = stripe()
  const secret = webhookSecret()
  if (!s || !secret || !signature) return { outcome: 'unconfigured' }

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

  if (event.type !== 'checkout.session.completed') {
    await finish({ payload: 'not a completed checkout' })
    return { outcome: 'ignored', eventId: event.id, type: event.type }
  }

  const session = event.data.object as {
    id: string
    client_reference_id?: string | null
    payment_intent?: string | null
    amount_total?: number | null
    payment_status?: string | null
    metadata?: Record<string, string> | null
  }

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

  /* Already confirmed by an earlier event. Not an error: two different events
     can describe the same successful payment. */
  if (booking.status === 'confirmed') {
    await finish({ bookingId, payload: 'already confirmed' })
    return { outcome: 'confirmed', eventId: event.id, bookingId }
  }

  const received = session.amount_total ?? 0
  if (session.payment_status !== 'paid' || !paymentMatches(invoice.totalCents, received)) {
    const detail = `expected ${invoice.totalCents}, stripe reported ${received} (${session.payment_status})`
    await finish({ bookingId, error: detail })
    /* Deliberately NOT confirmed. A maker holding a space they did not fully
       pay for is worse than a maker who has to be emailed. */
    return { outcome: 'mismatch', eventId: event.id, bookingId, detail }
  }

  const before = { status: booking.status, paidAt: booking.paidAt, amountPaidCents: booking.amountPaidCents }
  const paidAt = new Date().toISOString()
  await db.update(bookings).set({
    status: 'confirmed',
    paidAt,
    amountPaidCents: received,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
  }).where(eq(bookings.id, booking.id))

  /* Rule 3: actor, timestamp, before and after, reason. The actor is Stripe,
     because no person did this. */
  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: booking.id,
    action: 'payment_confirmed',
    before: JSON.stringify(before),
    after: JSON.stringify({ status: 'confirmed', paidAt, amountPaidCents: received }),
    actor: 'stripe:webhook',
    reason: `checkout.session.completed ${event.id}`,
  })

  await finish({ bookingId, payload: `confirmed ${received} cents` })
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
