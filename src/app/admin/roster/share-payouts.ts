'use server'

import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings, vendors } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { readShare } from '@/server/modules/payments/share-payouts'

/** Who pressed it (rule 3). A name, never an address. */
async function actor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/** Declared `never` on purpose: redirect() throws, and without saying so
 *  every `if (bad) back(...)` below leaves the compiler thinking execution
 *  carries on into the happy path. */
function back(bookingId: string, msg?: string): never {
  redirect(`/admin/roster/${bookingId}${msg ? `?share=${encodeURIComponent(msg)}` : ''}#paid`)
}

/**
 * Pay this maker through another maker's account.
 *
 * Writes ONE thing: a pointer at the maker whose account it is.
 *
 * Not a copy of stripe_account_id, which was the first shape and is wrong.
 * vendors carries a unique index on that column, and it should: it is what
 * makes recordAccount's "update the vendor with this account id" mean
 * exactly one row, so a webhook about mum's account can never write
 * payouts_enabled onto a daughter who does not own it. Two rows holding one
 * id would have broken that quietly, and the database refused it outright,
 * which is the constraint doing its job.
 *
 * So the account stays mum's alone and this row simply says whose it is.
 * Everything that needs the account follows the pointer: the screens read
 * her state from the owner, and a payout resolves the owner's account at the
 * moment it transfers.
 *
 * Nothing here touches payouts_enabled. That is Stripe's word about an
 * account that is not this maker's (rule 5).
 */
export async function sharePayoutAccount(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const code = String(fd.get('code') ?? '').trim().toUpperCase()
  const reason = String(fd.get('reason') ?? '')

  const [row] = await db
    .select({ vendor: vendors, showId: bookings.showId })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) back(bookingId, 'That booking is gone.')

  /* The owner is found by the number staff are reading off the screen, and
     only among makers at THIS show: a code from a previous season belongs to
     somebody who is not here and whose account must not be reached for. */
  const [owner] = await db
    .select({ vendor: vendors })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(and(eq(bookings.showId, row.showId), eq(bookings.vendorCode, code)))
    .limit(1)

  const read = readShare(row.vendor, owner?.vendor, reason)
  if ('bad' in read) back(bookingId, read.bad)

  const before = {
    stripeAccountId: row.vendor.stripeAccountId,
    payoutsViaVendorId: row.vendor.payoutsViaVendorId,
  }
  await db.update(vendors)
    .set({ payoutsViaVendorId: read.ownerId })
    .where(eq(vendors.id, row.vendor.id))

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'vendor',
    entityId: row.vendor.id,
    action: 'payouts_shared',
    actor: await actor(),
    before: JSON.stringify(before),
    after: JSON.stringify({ payoutsViaVendorId: read.ownerId, throughAccount: read.accountId }),
    reason: `${reason.trim()} (through ${code})`,
  })

  revalidatePath(`/admin/roster/${bookingId}`)
  revalidatePath('/admin/roster')
  revalidatePath('/admin/onboarding')
  back(bookingId, `Paid through ${code} from now on.`)
}

/**
 * Give it back.
 *
 * Clears both columns, which puts the maker exactly where she was: no
 * account, and a Set up payouts button of her own. The account itself is
 * untouched, because it was never hers.
 */
export async function unsharePayoutAccount(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const reason = String(fd.get('reason') ?? '')
  if (reason.trim().length < 3) back(bookingId, 'Say why, in a few words.')

  const [row] = await db
    .select({ vendor: vendors })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) back(bookingId, 'That booking is gone.')
  if (!row.vendor.payoutsViaVendorId) back(bookingId, 'They are already on their own account.')

  const before = {
    stripeAccountId: row.vendor.stripeAccountId,
    payoutsViaVendorId: row.vendor.payoutsViaVendorId,
  }
  /* Only the pointer. Her own Connect columns were never written while she
     was pointed elsewhere, so there is nothing of somebody else's to clear:
     she goes back to being a maker who has not set payouts up, which is what
     she was all along. */
  await db.update(vendors)
    .set({ payoutsViaVendorId: null })
    .where(eq(vendors.id, row.vendor.id))

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'vendor',
    entityId: row.vendor.id,
    action: 'payouts_unshared',
    actor: await actor(),
    before: JSON.stringify(before),
    after: JSON.stringify({ stripeAccountId: null, payoutsViaVendorId: null }),
    reason: reason.trim(),
  })

  revalidatePath(`/admin/roster/${bookingId}`)
  revalidatePath('/admin/roster')
  revalidatePath('/admin/onboarding')
  back(bookingId, 'Back on their own account.')
}
