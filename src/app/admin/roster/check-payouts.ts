'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, vendors } from '@/db/schema'
import { refreshAccount } from '@/server/modules/payments/connect'

/**
 * Ask Stripe about this maker's account, now.
 *
 * Drew, 2 November: "we had one vendor MM16 that was having issues with
 * payment, a lot of people seem to have connected it perfectly."
 *
 * One maker stuck while ninety are fine is not a bug in the flow, it is one
 * person and one unmet requirement, and the fix starts with knowing which.
 * The maker's own page has had a refresh since the day it shipped, for the
 * maker standing there ten seconds after finishing. Staff had nothing: the
 * admin page printed whatever the last webhook left behind, which for a
 * maker who is stuck is a snapshot of the moment she got stuck, possibly
 * days old, with no way to tell it from the truth. So the one person who
 * can help her was the one person who could not see what Stripe wanted.
 *
 * A read, not a write of our own: it records what Stripe says, exactly as
 * the webhook does, which is why there is no audit row. It never sets
 * payment state from anything else (rule 5), and it follows the pointer when
 * the account belongs to another maker, because that is the account that
 * actually pays this one.
 */
export async function checkPayoutAccount(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const back = `/admin/roster/${bookingId}`

  const [row] = await db
    .select({ vendor: vendors })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) redirect(`${back}?checked=missing#paid`)

  /* Whichever account pays her. Checking her own empty column for a maker
     paid through her mother would report "nothing to check" about an account
     that exists and may well be the one with the problem. */
  const [owner] = row.vendor.payoutsViaVendorId
    ? await db
        .select({ stripeAccountId: vendors.stripeAccountId })
        .from(vendors)
        .where(eq(vendors.id, row.vendor.payoutsViaVendorId))
        .limit(1)
    : []
  const accountId = owner?.stripeAccountId ?? row.vendor.stripeAccountId
  if (!accountId) redirect(`${back}?checked=none#paid`)

  const ok = await refreshAccount(db, accountId)
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(`${back}?checked=${ok ? 'ok' : 'failed'}#paid`)
}
