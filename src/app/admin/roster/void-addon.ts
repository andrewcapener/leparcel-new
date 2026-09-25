'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { addOns, auditLog, bookingAddons, bookings } from '@/db/schema'
import { dropLiveCheckout } from '@/server/modules/payments/booth'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { backTo } from './resend-lines'
import { randomUUID } from 'crypto'

/** Who pressed it (rule 3). The audit log carries a name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Take an add-on off a booking.
 *
 * The line Hillary could not reach. She changed Kelly's Outdoor Friday fee to
 * $850, Kelly's page kept saying $950, and the missing $100 was a tent rental
 * sitting on the booking as an add-on. Charge lines have been voidable since
 * 0045; add-ons never were, so the kind of line staff most often need to
 * remove was the one kind with no control on it.
 *
 * Voided, never deleted (rule 3), the same as a charge line. The invoice stops
 * counting it and the detail page still shows it, with who took it off and why.
 *
 * Unlike the fee and the space, this is NOT refused once money has moved. That
 * is the whole case it exists for: a maker who has already paid $950 for a
 * tent she is not taking needs the tent off her invoice so the balance says
 * what she is owed back. What it never touches is payment state, which only a
 * verified Stripe webhook may set (rule 5).
 */
export async function voidBoothAddon(fd: FormData): Promise<void> {
  const addonId = String(fd.get('addonId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  const [row] = await db
    .select({
      id: bookingAddons.id,
      bookingId: bookingAddons.bookingId,
      priceCents: bookingAddons.priceCents,
      voidedAt: bookingAddons.voidedAt,
      name: addOns.name,
    })
    .from(bookingAddons)
    .innerJoin(addOns, eq(bookingAddons.addOnId, addOns.id))
    .where(eq(bookingAddons.id, addonId))
    .limit(1)

  if (!row) redirect(backTo(back, 'addon', 'missing'))
  /* Already off. Pressing a stale page twice is not an error worth a scare. */
  if (row.voidedAt) redirect(backTo(back, 'addon', 'already'))

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, row.bookingId) })
  if (!b) redirect(backTo(back, 'addon', 'missing'))

  const who = await staffActor()
  await db.update(bookingAddons).set({
    voidedAt: new Date().toISOString(),
    voidedBy: who,
    voidReason: reason || 'no reason given',
  }).where(eq(bookingAddons.id, addonId))

  /* bookings.addons_cents is a denormalised total, and it is not decoration:
     the fee chase email, the payment export and the roster's own fee column
     all add it to the space price rather than reading the add-on rows. Left
     alone it would go on chasing a maker for a tent she no longer has. It is
     recomputed from the surviving rows rather than subtracted from, so one
     wrong press can never drift it. */
  const live = await db
    .select({ priceCents: bookingAddons.priceCents })
    .from(bookingAddons)
    .where(and(
      eq(bookingAddons.bookingId, row.bookingId),
      isNull(bookingAddons.voidedAt),
    ))
  const addonsCents = live.reduce((t, a) => t + a.priceCents, 0)

  await db.update(bookings).set({
    addonsCents,
    /* The balance moved, so the next checkout needs its own idempotency key. */
    priceVersion: b.priceVersion + 1,
  }).where(eq(bookings.id, row.bookingId))

  /* A Session's line items are fixed at creation, so a live one would still
     collect the old total. Same reason setBoothPrice does it. */
  await dropLiveCheckout(db, row.bookingId)

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: row.bookingId,
    action: 'addon_voided',
    before: JSON.stringify({ name: row.name, priceCents: row.priceCents, addonsCents: b.addonsCents }),
    after: JSON.stringify({ addonsCents }),
    reason: reason || 'no reason given',
    actor: who,
  })

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'addon', 'voided'))
}
