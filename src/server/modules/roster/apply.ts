import { randomUUID } from 'crypto'
import { nextVendorCode } from '@/server/modules/payments/mm-code'
import { and, eq, sql } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { applications, bookings, spaceTypes, vendors, auditLog } from '@/db/schema'
import { paymentDueAt } from '@/server/modules/payments/deadline'
import { planImport, summarise, type Lookups, type Planned, type SheetRow } from './import'

type DbHandle = typeof Db

/**
 * The database half of the roster import: read what exists, then write.
 *
 * Kept apart from import.ts so the deciding is pure and tested and this file
 * only moves rows. Two entry points on purpose, and the screen makes you use
 * them in order: look at what would happen, then do it.
 */

export async function lookupsFor(db: DbHandle, showId: string): Promise<Lookups> {
  const apps = await db
    .select({ id: applications.id, vendorId: applications.vendorId,
      status: applications.status, email: vendors.email })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .where(eq(applications.showId, showId))

  const booked = await db
    .select({ email: vendors.email })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.showId, showId))

  const spaces = await db
    .select({ id: spaceTypes.id, label: spaceTypes.label, priceCents: spaceTypes.priceCents })
    .from(spaceTypes)

  const codes = await db.select({ id: vendors.id, code: vendors.vendorCode }).from(vendors)

  return {
    /* Last application wins where a maker somehow has two: the newest row in
       a table nobody deletes from is the one they meant. */
    applications: new Map(apps.map((a) => [a.email.toLowerCase(), a])),
    booked: new Set(booked.map((b) => b.email.toLowerCase())),
    spaces,
    vendorCodes: new Map(codes.map((c) => [c.id, c.code])),
  }
}

export async function planFor(db: DbHandle, showId: string, rows: SheetRow[]) {
  const plan = planImport(rows, await lookupsFor(db, showId))
  return { plan, summary: summarise(plan) }
}

/**
 * Create the bookings.
 *
 * Everything the single-maker path does, minus the two things that would be
 * wrong in bulk:
 *
 * No add-ons are attached. The fee from the sheet is the WHOLE fee, already
 * carrying credits, second-day discounts and whatever the girls granted or
 * refused, so adding what the application happened to tick on top is exactly
 * the mistake that produced fourteen overcharges.
 *
 * And no email leaves, whatever the Show's switches say. The girls write
 * their own, and a bulk run is the worst possible place to discover a switch
 * was on.
 *
 * Idempotent: a maker who already has a booking is skipped, so a half
 * finished run is fixed by running it again.
 */
export async function applyPlan(
  db: DbHandle, showId: string, plan: Planned[], actor: string,
): Promise<{ booked: number; skipped: number; failed: { shop: string; detail: string }[] }> {
  const show = await db.query.shows.findFirst({ where: (s, { eq: e }) => e(s.id, showId) })
  if (!show) return { booked: 0, skipped: 0, failed: [{ shop: '', detail: 'No such show.' }] }

  const todo = plan.filter((p): p is Extract<Planned, { kind: 'book' }> => p.kind === 'book')
  const failed: { shop: string; detail: string }[] = []
  let booked = 0

  /* Every MM code anybody already carries, from any show.
     Accepting one maker at a time numbers them `MM{bookings so far + 1}`,
     which is fine at that pace and wrong at this one: a maker who already
     carries MM11 from a previous show keeps it, the counter does not know
     that, and the eleventh booking of the night is handed MM11 as well. Two
     makers on one code is not a cosmetic problem. It is the reference in the
     Venmo note, so their payments arrive indistinguishable. */
  const taken = new Set(
    [
      ...(await db.select({ code: vendors.vendorCode }).from(vendors)),
      /* Bookings too, not just makers. A booking snapshots the code it was
         made with, so a code can be live on a booking after the maker's own
         row has moved on, and handing it out again would point two rows at
         one reference. */
      ...(await db.select({ code: bookings.vendorCode }).from(bookings)),
    ]
      .map((v) => (v.code ?? '').trim().toUpperCase())
      .filter(Boolean),
  )

  /* One at a time, in order, because the Mermade ID is a running count of
     this show's bookings and two rows inserted at once would claim the same
     number. Seventy eight sequential inserts is under a second. */
  for (const p of todo) {
    try {
      const exists = await db.query.bookings.findFirst({
        where: and(eq(bookings.showId, showId), eq(bookings.vendorId, p.vendorId)),
      })
      if (exists) continue

      let code = p.vendorCode
      if (!code) {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)` })
          .from(bookings)
          .where(eq(bookings.showId, showId))
        code = nextVendorCode(n, taken)
        await db.update(vendors).set({ vendorCode: code }).where(eq(vendors.id, p.vendorId))
      }
      taken.add(code.toUpperCase())

      const bookingId = randomUUID()
      const payToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
      await db.insert(bookings).values({
        id: bookingId, showId, vendorId: p.vendorId, applicationId: p.applicationId,
        spaceTypeId: p.spaceTypeId, vendorCode: code,
        priceCents: p.priceCents,
        addonsCents: 0,
        commissionBps: show.commissionBps,
        status: 'awaiting_payment',
        paymentDueAt: paymentDueAt({
          fixedAt: show.paymentDueAt,
          windowHours: show.paymentWindowHours,
          acceptedAtIso: new Date().toISOString(),
        }),
        payToken,
      })
      await db.update(applications).set({
        status: 'accepted', decidedAt: new Date().toISOString(), decidedBy: actor,
      }).where(eq(applications.id, p.applicationId))

      await db.insert(auditLog).values({
        id: randomUUID(), entity: 'booking', entityId: bookingId, action: 'accepted_by_import',
        actor,
        before: null,
        after: JSON.stringify({ vendorCode: code, priceCents: p.priceCents, space: p.spaceLabel }),
        reason: p.priceCents === p.defaultCents
          ? 'roster import, list price'
          : `roster import, fee set to ${p.priceCents} rather than the list ${p.defaultCents}`,
      })
      booked++
    } catch (err) {
      failed.push({ shop: p.shop, detail: err instanceof Error ? err.message.slice(0, 160) : 'unknown' })
    }
  }
  return { booked, skipped: todo.length - booked - failed.length, failed }
}
