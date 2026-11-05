'use server'

import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookingSpaces, bookings, spaceTypes } from '@/db/schema'
import { dropLiveCheckout } from '@/server/modules/payments/booth'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { grantProblem, priceFromDollars } from '@/server/modules/roster/spaces'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { backTo } from './resend-lines'

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
 * Give a maker another space, priced or free.
 *
 * Outdoors a space is a day, so this is how JC Beans gets all three. Leaving
 * the price empty grants it at no charge, which is the common case and is
 * deliberately not the same as typing 0: access and invoicing are separate
 * decisions (see server/modules/roster/spaces.ts).
 *
 * A priced space becomes its own line on the invoice immediately, so the
 * maker can be re-invoiced from the same screen. It never touches payment
 * state, which only a verified Stripe webhook may set (rule 5).
 */
export async function grantBoothSpace(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  /* Several at once. Drew, 5 November: an outdoor maker doing Friday and
     Saturday was two visits to this form, and a maker doing all three was
     three. Deduplicated, because two ticks of one day is one day. */
  const wanted = [...new Set(fd.getAll('spaceTypeIds').map((v) => String(v).trim()).filter(Boolean))]
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')
  const price = priceFromDollars(String(fd.get('dollars') ?? ''))
  const n = wanted.length

  if (n === 0) redirect(backTo(back, 'space', 'none'))

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect(backTo(back, 'space', 'missing'))

  const [booked, found, held] = await Promise.all([
    db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, b.spaceTypeId) }),
    db.select({ id: spaceTypes.id, label: spaceTypes.label, track: spaceTypes.track })
      .from(spaceTypes).where(inArray(spaceTypes.id, wanted)),
    db.select({ spaceTypeId: bookingSpaces.spaceTypeId })
      .from(bookingSpaces)
      .where(and(eq(bookingSpaces.bookingId, bookingId), isNull(bookingSpaces.voidedAt))),
  ])

  /* Checked in the order they were ticked, and ALL of them before anything is
     written. A half applied grant is indistinguishable from a whole one in
     the notice afterwards, and the cost of that is a maker standing at a
     table on a day nobody put her on. */
  const want = wanted.map((id) => found.find((f) => f.id === id))
  for (let i = 0; i < want.length; i++) {
    const problem = grantProblem({
      holdsSpace: holdsSpace(b.status),
      bookingTrack: booked?.track,
      spaceTrack: want[i]?.track,
      alreadyHas: held.some((h) => h.spaceTypeId === wanted[i]),
      priceCents: price,
    })
    if (problem) redirect(backTo(back, 'space', problem, n))
  }

  const who = await staffActor()
  /* One row each. priceCents is per space rather than split across them: it
     lands on the invoice as its own line, and splitting a total would mean
     rounding, which has a rule of its own and no business here. */
  await db.insert(bookingSpaces).values(wanted.map((spaceTypeId) => ({
    id: randomUUID(),
    bookingId,
    spaceTypeId,
    priceCents: price as number | null,
    createdBy: who,
  })))

  /* Only when it costs something. A free day changes what she has access to
     and not what she owes, so there is no stale checkout to kill and no
     reason to make the next one need a fresh idempotency key. */
  if (price !== null) {
    await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
      .where(eq(bookings.id, bookingId))
    await dropLiveCheckout(db, bookingId)
  }

  /* One line each, so the history reads as the days it actually added rather
     than as a single entry somebody has to unpack later. */
  await db.insert(auditLog).values(want.map((w) => ({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'space_granted',
    before: null,
    after: JSON.stringify({ space: w?.label ?? '', priceCents: price }),
    reason: reason || 'no reason given',
    actor: who,
  })))

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'space', price === null ? 'free' : 'granted', n))
}

/**
 * Take a space back off a maker.
 *
 * Voided, never deleted (rule 3). Refused when it is the only space she
 * holds: a maker with no space is a maker who is not at the show, and that
 * decision belongs to the remove control with its reason and its red
 * treatment, not to this one.
 */
export async function revokeBoothSpace(fd: FormData): Promise<void> {
  const spaceId = String(fd.get('spaceId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const back = String(fd.get('back') ?? '/admin/roster')

  const [row] = await db
    .select({
      id: bookingSpaces.id,
      bookingId: bookingSpaces.bookingId,
      priceCents: bookingSpaces.priceCents,
      voidedAt: bookingSpaces.voidedAt,
      label: spaceTypes.label,
    })
    .from(bookingSpaces)
    .innerJoin(spaceTypes, eq(bookingSpaces.spaceTypeId, spaceTypes.id))
    .where(eq(bookingSpaces.id, spaceId))
    .limit(1)
  if (!row) redirect(backTo(back, 'space', 'missing'))
  if (row.voidedAt) redirect(backTo(back, 'space', 'already'))

  const live = await db.select({ id: bookingSpaces.id })
    .from(bookingSpaces)
    .where(and(eq(bookingSpaces.bookingId, row.bookingId), isNull(bookingSpaces.voidedAt)))
  if (live.length <= 1) redirect(backTo(back, 'space', 'last_one'))

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, row.bookingId) })
  const who = await staffActor()

  await db.update(bookingSpaces).set({
    voidedAt: new Date().toISOString(),
    voidedBy: who,
    voidReason: reason || 'no reason given',
  }).where(eq(bookingSpaces.id, spaceId))

  if (row.priceCents !== null && b) {
    await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
      .where(eq(bookings.id, row.bookingId))
    await dropLiveCheckout(db, row.bookingId)
  }

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: row.bookingId,
    action: 'space_revoked',
    before: JSON.stringify({ space: row.label, priceCents: row.priceCents }),
    after: null,
    reason: reason || 'no reason given',
    actor: who,
  })

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect(backTo(back, 'space', 'removed'))
}
