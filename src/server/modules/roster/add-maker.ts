import { randomUUID } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { db as Db } from '@/db'
import {
  applications, auditLog, bookings, bookingSpaces, spaceTypes, vendors,
} from '@/db/schema'
import { nextVendorCode } from '@/server/modules/payments/mm-code'
import { paymentDueAt } from '@/server/modules/payments/deadline'

type DbHandle = typeof Db

/**
 * Put a maker on the roster by hand.
 *
 * Until now there was no way to do this at all. A maker who never went
 * through /apply was unreachable: the sheet import refuses them with "no
 * application for this show under that email", and every other path hangs off
 * an application row that does not exist. That came up twice in a week in
 * late October, once for a maker who wanted to move inside and once for a
 * straggler who paid before anybody had her on a list, and both times the
 * answer was to send them back to a sixteen field public form.
 *
 * So this creates the three rows an accepted maker actually needs, in the
 * same shape the jury path creates them:
 *
 *   the vendor, or the existing one if that address is already known
 *   an application, already decided, marked as staff created
 *   the booking, with its MM code, its fee and its pay link
 *   and the booking_spaces row the public lineup reads
 *
 * It is deliberately NOT a second jury. The application it writes carries
 * almost nothing, because nobody answered any questions: what it records is
 * that a person decided, who they were, and why. The curation judgement is
 * the product, and a form that let somebody skip it quietly would be the one
 * place in this codebase that undermines that. Staff type a reason and it
 * goes in the audit log.
 */

export type NewMaker = {
  shopName: string
  contactName: string
  email: string
  spaceTypeId: string
  /** Dollars as typed. Empty means the space's list price. */
  fee: string
  instagram: string
  phone: string
  reason: string
}

export type Ready = {
  shopName: string
  contactName: string
  email: string
  spaceTypeId: string
  /** Null means "use the list price", resolved against the space on write. */
  priceCents: number | null
  instagram: string | null
  phone: string | null
  reason: string
}

/** Cents from text, never Number(x) * 100. See money.test.ts for why. */
export function feeFromDollars(raw: string): { cents: number } | null | { bad: string } {
  const t = (raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  if (t === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { bad: 'Write the fee as a number, like 280 or 280.00.' }
  const [whole, frac = ''] = t.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 100_000_00) return { bad: 'That is not a fee.' }
  return { cents }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The form, checked, or the first thing wrong with it. */
export function readNewMaker(input: NewMaker): { ready: Ready } | { bad: string } {
  const shopName = (input.shopName ?? '').trim().replace(/\s+/g, ' ')
  if (!shopName) return { bad: 'The shop needs a name.' }
  if (shopName.length > 120) return { bad: 'That shop name is too long.' }

  const contactName = (input.contactName ?? '').trim().replace(/\s+/g, ' ')
  if (!contactName) return { bad: 'Who is the person behind it?' }

  const email = (input.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) return { bad: 'That does not look like an email address.' }

  if (!(input.spaceTypeId ?? '').trim()) return { bad: 'Pick the space they are taking.' }

  const fee = feeFromDollars(input.fee)
  if (fee && 'bad' in fee) return { bad: fee.bad }

  /* A reason, always. This is the one path onto the roster that nobody
     juried, so the audit log is the only record of why somebody is here. */
  const reason = (input.reason ?? '').trim()
  if (reason.length < 3) return { bad: 'Say why, in a few words. It goes in the audit log.' }

  return {
    ready: {
      shopName, contactName, email,
      spaceTypeId: input.spaceTypeId.trim(),
      priceCents: fee ? fee.cents : null,
      instagram: (input.instagram ?? '').trim().replace(/^@/, '') || null,
      phone: (input.phone ?? '').trim() || null,
      reason,
    },
  }
}

export type AddResult =
  | { ok: true; bookingId: string; vendorCode: string; payToken: string; reused: boolean }
  | { ok: false; because: string }

/**
 * Write the rows.
 *
 * Idempotent on the thing that matters: a maker who already holds a booking
 * at this show is refused rather than given a second one, because two
 * bookings for one maker is two invoices and two spaces held.
 */
export async function addMaker(
  db: DbHandle, showId: string, ready: Ready, actor: string,
): Promise<AddResult> {
  const show = await db.query.shows.findFirst({ where: (s, { eq: e }) => e(s.id, showId) })
  if (!show) return { ok: false, because: 'No active show.' }

  const [space] = await db
    .select({
      id: spaceTypes.id, label: spaceTypes.label,
      track: spaceTypes.track, priceCents: spaceTypes.priceCents,
    })
    .from(spaceTypes)
    .where(eq(spaceTypes.id, ready.spaceTypeId))
    .limit(1)
  if (!space) return { ok: false, because: 'That space no longer exists.' }

  /* The address is the account, here as everywhere else. A maker who applied
     to a previous show keeps her vendor row, her MM code and her history. */
  let vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, ready.email) })
  const reused = Boolean(vendor)
  if (!vendor) {
    const id = randomUUID()
    await db.insert(vendors).values({
      id, email: ready.email, shopName: ready.shopName, contactName: ready.contactName,
      instagram: ready.instagram ?? '', phone: ready.phone ?? '',
    })
    vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, id) })
  }
  if (!vendor) return { ok: false, because: 'Could not create the maker.' }

  const existing = await db.query.bookings.findFirst({
    where: and(eq(bookings.showId, showId), eq(bookings.vendorId, vendor.id)),
  })
  if (existing) {
    return { ok: false, because: `${ready.shopName} already holds a space at this show.` }
  }

  /* Almost empty on purpose: nobody answered any questions. What it records
     is that this maker exists, was decided, and by whom. */
  const applicationId = randomUUID()
  const now = new Date().toISOString()
  /* The columns the table insists on, filled with the truth rather than with
     invented answers. Nobody asked this maker what her prices are or what she
     makes, so the category reads "Other", the description says where the row
     came from, and the price range is zero. A jury screen showing an invented
     answer beside a real one is worse than one showing an obvious blank. */
  await db.insert(applications).values({
    id: applicationId,
    showId,
    vendorId: vendor.id,
    track: space.track === 'outdoor' ? 'outdoor' : 'indoor',
    status: 'accepted',
    requestedSpaceIds: JSON.stringify([space.id]),
    category: 'Other',
    description: `Added to the roster by hand. ${ready.reason}`,
    priceLowCents: 0,
    priceHighCents: 0,
    madeByYou: 'all',
    decidedAt: now,
    decidedBy: actor,
    submittedAt: now,
  })

  /* Every code anybody carries, from any show and any booking. A maker who
     already holds MM11 keeps it, and the counter does not know that, so two
     makers would otherwise share the reference in the Venmo note. */
  const taken = new Set(
    [
      ...(await db.select({ code: vendors.vendorCode }).from(vendors)),
      ...(await db.select({ code: bookings.vendorCode }).from(bookings)),
    ].map((v) => (v.code ?? '').trim().toUpperCase()).filter(Boolean),
  )
  let code = (vendor.vendorCode ?? '').trim()
  if (!code) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.showId, showId))
    code = nextVendorCode(Number(n), taken)
    await db.update(vendors).set({ vendorCode: code }).where(eq(vendors.id, vendor.id))
  }

  const bookingId = randomUUID()
  const payToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  const priceCents = ready.priceCents ?? space.priceCents

  await db.insert(bookings).values({
    id: bookingId, showId, vendorId: vendor.id, applicationId,
    spaceTypeId: space.id, vendorCode: code,
    priceCents,
    addonsCents: 0,
    /* Snapshotted at booking time and immutable from here (rule 6). */
    commissionBps: show.commissionBps,
    status: 'awaiting_payment',
    paymentDueAt: paymentDueAt({
      fixedAt: show.paymentDueAt,
      windowHours: show.paymentWindowHours,
      acceptedAtIso: now,
    }),
    payToken,
  })

  /* The lineup reads booking_spaces, not bookings.space_type_id. A booking
     without this row is a maker nobody can see on the website. */
  await db.insert(bookingSpaces).values({
    id: randomUUID(), bookingId, spaceTypeId: space.id, priceCents: null,
    createdBy: 'added by hand',
  })

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: bookingId,
    action: 'added_by_hand',
    actor,
    before: null,
    after: JSON.stringify({
      shopName: ready.shopName, email: ready.email,
      vendorCode: code, priceCents, space: space.label, reusedVendor: reused,
    }),
    reason: ready.priceCents === null
      ? `added by hand, list price: ${ready.reason}`
      : `added by hand, fee set to ${priceCents} rather than the list ${space.priceCents}: ${ready.reason}`,
  })

  return { ok: true, bookingId, vendorCode: code, payToken, reused }
}
