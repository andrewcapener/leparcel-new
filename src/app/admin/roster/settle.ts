'use server'

import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings } from '@/db/schema'
import { boothInvoice, dropLiveCheckout } from '@/server/modules/payments/booth'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { backTo } from './resend-lines'
import { randomUUID } from 'crypto'

async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Close the gap on a booking that is confirmed but still reads as owing.
 *
 * A booking is a running total, not a frozen price. Mark a maker paid and the
 * amount that arrived is written down; change her spaces, her fee or her
 * add-ons afterwards and the total moves while that figure does not. The
 * difference is real debt most of the time, which is why the invoice shows it
 * and the maker is asked for it. Sometimes it is not: the fee was corrected
 * downward after she paid, or the space she is in was added to the booking
 * after the money was matched by hand. There was no way to say so. markPaid
 * refuses a booking that is already confirmed, so the only route to a page
 * that said "There is more to pay" was taking money that was not owed.
 *
 * This writes down that nothing more is owed, by recording what has arrived
 * as the invoice total. It never sets payment state (rule 5): the booking is
 * already confirmed, which is the condition for offering this at all. Refused
 * on an unpaid booking, because that is markPaid's job and it records how the
 * money came. Audit-logged with a reason, like every figure a person can move.
 */
export async function settleBoothBalance(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  if (reason.length < 3) redirect(backTo(back, 'settle', 'noreason'))

  const settled = await boothInvoice(db, bookingId)
  if (!settled) redirect(backTo(back, 'settle', 'missing'))
  const { invoice, booking } = settled

  /* Not a payment route. Somebody who has not paid gets the control that
     records how their money came, not this one. */
  if (booking.status !== 'confirmed') redirect(backTo(back, 'settle', 'unpaid'))
  /* Nothing to close. A stale page pressed twice is not an error. */
  if (invoice.amountDueCents <= 0) redirect(backTo(back, 'settle', 'already'))

  const who = await staffActor()
  await db.update(bookings).set({
    amountPaidCents: invoice.totalCents,
    priceVersion: booking.priceVersion + 1,
  }).where(eq(bookings.id, bookingId))

  /* Any checkout still open would collect the balance this just forgave. */
  await dropLiveCheckout(db, bookingId)

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'balance_settled',
    before: JSON.stringify({ amountPaidCents: booking.amountPaidCents ?? 0, dueCents: invoice.amountDueCents }),
    after: JSON.stringify({ amountPaidCents: invoice.totalCents, dueCents: 0 }),
    reason,
    actor: who,
  })

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'settle', 'settled'))
}
