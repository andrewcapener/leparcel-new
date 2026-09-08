/**
 * The webhook is the only thing that marks a booking paid (CLAUDE.md rule 5),
 * so it is tested against a real signed payload rather than a mock.
 *
 * Stripe's own `generateTestHeaderString` signs the body with a known secret,
 * which means every path below goes through the same `constructEventAsync`
 * verification production uses. No Stripe account is needed and nothing leaves
 * this process.
 *
 * The four properties that matter:
 *   1. An unsigned or wrongly signed event changes nothing and is not recorded.
 *   2. The same event delivered twice confirms once. Stripe retries; a double
 *      confirmation would mean two audit rows for one payment.
 *   3. An amount that is not exactly right never confirms a booking.
 *   4. A correct event confirms, records the received amount, and writes audit.
 */
import Stripe from 'stripe'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { bookings, stripeEvents, auditLog, shows, spaceTypes, vendors, applications } from '@/db/schema'
import { handleStripeWebhook } from './booth'

/* This one needs a real database, because what is under test is a race and a
   unique constraint, and neither is a thing a mock can be wrong about. With no
   DATABASE_URL it says so and passes rather than failing the suite on a
   machine that simply has no Postgres. */
if (!process.env.DATABASE_URL) {
  console.log('booth webhook: no DATABASE_URL, skipped (needs a real database)')
  process.exit(0)
}

const SECRET = 'whsec_test_secret_for_this_file_only'
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key'
process.env.STRIPE_WEBHOOK_SECRET = SECRET

const stripe = new Stripe('sk_test_not_a_real_key', { apiVersion: '2026-08-26.dahlia' })

let failures = 0
const check = (name: string, ok: boolean) => {
  if (!ok) { failures++; console.error(`FAIL: ${name}`) }
}

function signed(body: unknown) {
  const payload = JSON.stringify(body)
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }),
  }
}

const sessionEvent = (opts: {
  eventId: string; bookingId: string; amountTotal: number; paymentStatus?: string
}) => ({
  id: opts.eventId,
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: `cs_test_${opts.bookingId.slice(0, 8)}`,
      object: 'checkout.session',
      client_reference_id: opts.bookingId,
      payment_intent: `pi_test_${opts.bookingId.slice(0, 8)}`,
      amount_total: opts.amountTotal,
      payment_status: opts.paymentStatus ?? 'paid',
      metadata: { bookingId: opts.bookingId },
    },
  },
})

async function main() {
  /* Imported here rather than at the top: src/db throws on import without
     DATABASE_URL, and the skip above has to be able to run first. */
  const { db } = await import('@/db')

  /* A real booking to charge, built from whatever the seeded database has. */
  const [show] = await db.select().from(shows).limit(1)
  const [space] = await db.select().from(spaceTypes).limit(1)
  const [vendor] = await db.select().from(vendors).limit(1)
  const [app] = await db.select().from(applications).limit(1)
  if (!show || !space || !vendor || !app) {
    console.log('webhook: no seeded show/space/vendor/application, skipping')
    return
  }

  const bookingId = randomUUID()
  await db.insert(bookings).values({
    id: bookingId, showId: show.id, vendorId: vendor.id, applicationId: app.id,
    spaceTypeId: space.id, vendorCode: `ZZ${Math.floor(Math.random() * 90 + 10)}`,
    priceCents: space.priceCents, addonsCents: 0,
    commissionBps: show.commissionBps,
    status: 'awaiting_payment',
    paymentDueAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
  })

  const total = space.priceCents   // no add-ons on this one, so the space is the invoice

  try {
    /* 1 · A forged signature changes nothing, and records nothing. */
    const forged = JSON.stringify(sessionEvent({ eventId: 'evt_forged', bookingId, amountTotal: total }))
    const bad = await handleStripeWebhook(db, forged, 't=1,v1=deadbeef')
    check('a bad signature is rejected', bad.outcome === 'bad_signature')
    const forgedRows = await db.select().from(stripeEvents).where(eq(stripeEvents.id, 'evt_forged'))
    check('a bad signature writes no event row', forgedRows.length === 0)
    const [afterForged] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
    check('a bad signature leaves the booking unpaid', afterForged!.status === 'awaiting_payment')

    /* 2 · An amount that is one cent short never confirms. */
    const shortId = `evt_short_${bookingId.slice(0, 8)}`
    const short = signed(sessionEvent({ eventId: shortId, bookingId, amountTotal: total - 1 }))
    const shortResult = await handleStripeWebhook(db, short.payload, short.signature)
    check('a short payment does not confirm', shortResult.outcome === 'mismatch')
    const [afterShort] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
    check('a short payment leaves the booking unpaid', afterShort!.status === 'awaiting_payment')
    const [shortRow] = await db.select().from(stripeEvents).where(eq(stripeEvents.id, shortId))
    check('a short payment is recorded with its reason', Boolean(shortRow?.error))

    /* 3 · payment_status that is not "paid" never confirms, whatever the total. */
    const unpaidId = `evt_unpaid_${bookingId.slice(0, 8)}`
    const unpaid = signed(sessionEvent({
      eventId: unpaidId, bookingId, amountTotal: total, paymentStatus: 'unpaid',
    }))
    const unpaidResult = await handleStripeWebhook(db, unpaid.payload, unpaid.signature)
    check('an unpaid session does not confirm', unpaidResult.outcome === 'mismatch')

    /* 4 · The correct event confirms, exactly once. */
    const okId = `evt_ok_${bookingId.slice(0, 8)}`
    const good = signed(sessionEvent({ eventId: okId, bookingId, amountTotal: total }))
    const first = await handleStripeWebhook(db, good.payload, good.signature)
    check('a correct payment confirms', first.outcome === 'confirmed')

    const [paid] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
    check('the booking is confirmed', paid!.status === 'confirmed')
    check('the received amount is stored', paid!.amountPaidCents === total)
    check('paid_at is set', Boolean(paid!.paidAt))
    check('the payment intent is stored', Boolean(paid!.stripePaymentIntentId))

    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, bookingId))
    const confirms = audits.filter((a) => a.action === 'payment_confirmed')
    check('exactly one audit row for the payment', confirms.length === 1)

    /* 5 · Stripe redelivers. It must not confirm or audit a second time. */
    const replay = await handleStripeWebhook(db, good.payload, good.signature)
    check('a redelivered event is a duplicate', replay.outcome === 'duplicate')
    const auditsAfter = await db.select().from(auditLog).where(eq(auditLog.entityId, bookingId))
    const confirmsAfter = auditsAfter.filter((a) => a.action === 'payment_confirmed')
    check('a redelivery writes no second audit row', confirmsAfter.length === 1)

    /* 6 · A DIFFERENT event describing the same paid booking is not an error
     *     and still does not double-write. */
    const secondId = `evt_ok2_${bookingId.slice(0, 8)}`
    const again = signed(sessionEvent({ eventId: secondId, bookingId, amountTotal: total }))
    const secondResult = await handleStripeWebhook(db, again.payload, again.signature)
    check('a second event on a paid booking is fine', secondResult.outcome === 'confirmed')
    const auditsFinal = await db.select().from(auditLog).where(eq(auditLog.entityId, bookingId))
    check(
      'still exactly one audit row for the payment',
      auditsFinal.filter((a) => a.action === 'payment_confirmed').length === 1,
    )
  } finally {
    await db.delete(stripeEvents).where(eq(stripeEvents.bookingId, bookingId))
    await db.delete(auditLog).where(eq(auditLog.entityId, bookingId))
    await db.delete(bookings).where(eq(bookings.id, bookingId))
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log('booth webhook: forgery rejected, short payments refused, redelivery confirms once')
  process.exit(0)
}

main()
export {}
