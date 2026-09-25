'use server'

/**
 * Change a line on a maker's invoice.
 *
 * Drew, 24 Sept: "we should be able to modify line items on their invoice, add
 * things, remove things etc. needs a lot of flexiblitly."
 *
 * Adding and removing already existed. This is the third thing staff actually
 * do, which is neither: the line is right in kind and wrong in detail. "Extra
 * day $350" should have been $450, or should read "Sunday, 12x12". Until now
 * the only way through was void and add again, two presses and two audit rows
 * that nobody reading them back can tell were one decision.
 *
 * Nothing is edited in place (rule 3). The existing row is VOIDED, with who
 * did it and why, and a superseding row is inserted with the new description
 * and amount. Both stay on the invoice, the voided one stops counting, and the
 * audit row names both ids, so "what did this maker owe on the 3rd of October,
 * and who decided" is answerable in December.
 *
 * It cannot mark anything paid and it never touches `status`. Payment state
 * belongs to a verified Stripe webhook and to staff pressing Mark paid
 * (rule 5). A confirmed booking that now owes another $100 is both of those
 * things at once.
 */
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditLog, bookingCharges, bookings, shows } from '@/db/schema'
import { dropLiveCheckout } from '@/server/modules/payments/booth'
import { chargeProblem } from '@/server/modules/payments/ledger'
import { pushPaymentTabsIfConnected } from '@/server/modules/roster/sheet-push'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { siteUrl } from '@/lib/site-url'
import { backTo, centsFromDollars } from './resend-lines'

/** Who pressed it (rule 3). A name, never an address (rule 9). */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

export async function editBoothCharge(fd: FormData): Promise<void> {
  const chargeId = String(fd.get('chargeId') ?? '')
  const bookingId = String(fd.get('bookingId') ?? '')
  const description = String(fd.get('description') ?? '').trim()
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')
  const go = (outcome: string): never => redirect(backTo(back, 'charge', outcome))

  /* Dollars in the box, integer cents in the column (rule 1). A leading minus
     is how a line comes off, so it is kept. */
  const amountCents = centsFromDollars(String(fd.get('amount') ?? ''))
  if (amountCents === null) return go('bad')
  if (chargeProblem(description, amountCents)) return go('bad')

  const old = await db.query.bookingCharges.findFirst({
    where: eq(bookingCharges.id, chargeId),
  })
  if (!old) return go('missing')
  /* Already off the invoice. Editing it would quietly bring it back, which is
     the opposite of what the person who voided it decided. */
  if (old.voidedAt) return go('voided')
  /* The form says which booking it thinks this line belongs to. A mismatch
     means a stale page, and the wrong maker's invoice is the wrong place to
     find that out. */
  if (bookingId && bookingId !== old.bookingId) return go('mismatch')
  if (description === old.description && amountCents === old.amountCents) return go('same')

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, old.bookingId),
  })
  if (!booking) return go('missing')

  const actor = await staffActor()
  const now = new Date().toISOString()
  /* Minted first so the voided row can name its replacement. Read back to
     back, the two rows tell the whole story without the audit log. */
  const newId = randomUUID()

  await db.update(bookingCharges).set({
    voidedAt: now,
    voidedBy: actor,
    voidReason: reason
      ? `Replaced: ${reason}`
      : 'Replaced by a corrected line, no reason given',
  }).where(eq(bookingCharges.id, old.id))

  await db.insert(bookingCharges).values({
    id: newId,
    bookingId: old.bookingId,
    description,
    amountCents,
    reason: reason || `Replaces an earlier line: ${old.description}`,
    createdBy: actor,
  })

  /* Same reason addBoothCharge bumps it: the Stripe idempotency key carries
     this number, and Stripe answers a reused key by REPLAYING the first
     session rather than opening a new one. Without the bump, a maker asked for
     a corrected balance would be handed the checkout built for the old one. */
  await db.update(bookings).set({ priceVersion: booking.priceVersion + 1 })
    .where(eq(bookings.id, old.bookingId))

  /* A maker part way through checking out is paying the old balance, and a
     Session's line items are fixed when it is created. Leave it open and she
     can pay the old amount and be read as a mismatch: money captured, booking
     not confirmed. dropLiveCheckout exists for exactly this. */
  await dropLiveCheckout(db, old.bookingId)

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: old.bookingId,
    action: 'charge_superseded',
    before: JSON.stringify({
      chargeId: old.id, description: old.description, amountCents: old.amountCents,
    }),
    after: JSON.stringify({
      chargeId: newId, description, amountCents,
      /* What moved, so the balance change is readable without adding up rows. */
      deltaCents: amountCents - old.amountCents,
    }),
    actor,
    reason: reason || 'no reason given',
  })

  /* The girls read the sheet, not this screen. A balance changed here and not
     there is how one maker comes to be discussed as two different numbers on
     the day she is trying to pay. Capped and swallowed inside the push, so a
     slow Google cannot fail this action. */
  const [show] = await db.select({ paymentSheetId: shows.paymentSheetId })
    .from(shows).where(eq(shows.id, booking.showId)).limit(1)
  await pushPaymentTabsIfConnected(db, booking.showId, show?.paymentSheetId, siteUrl())

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  return go('edited')
}
