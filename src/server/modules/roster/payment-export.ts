import { asc, eq } from 'drizzle-orm'
import { bookings, bookingCharges, spaceTypes, vendors } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'
import { isPaid } from '@/server/modules/payments/booking-status'
import { ledgerFor } from '@/server/modules/payments/ledger'
import { viaLabel, makerSignal } from '@/server/modules/payments/paid-via'
import type { db as Db } from '@/db'

/**
 * The roster as two files: who to write to, and who has paid.
 *
 * Drew, 22 Sept: the girls need the seventy eight pay links in a sheet they
 * can mail merge from, and a tab that says who has paid what and where. Both
 * were a copy button per row until now, which at seventy eight rows is not a
 * process, it is an evening.
 *
 * One gather, two files, on purpose. A links file and a payments file built
 * from separate queries would eventually disagree about a fee, and the fee is
 * the number in the email.
 *
 * The pay link is a capability: anyone holding it can open that maker's
 * invoice and pay it. That is the point, it is what goes in the email, but it
 * means these files are not to be shared beyond the people sending them.
 */

type DbHandle = typeof Db

export type PaymentRow = {
  code: string
  shop: string
  contact: string
  email: string
  track: string
  space: string
  /** Dollars, plain, for a spreadsheet to sum: "280.00". The running total. */
  fee: string
  /** What is still owed after what has arrived. Never negative. */
  balance: string
  payLink: string
  due: string
  status: string
  paidHow: string
  paidAt: string
  /** Staff ticked that they sent the link. Not evidence the maker read it. */
  linkSent: string
  /** What the maker themselves has done, if anything. */
  theirMove: string
}

/**
 * Not paid, clearing, paid, released: the same four words the roster uses.
 *
 * "Awaiting" was read as "paid, still processing" by the person who works
 * this list every morning, which is the opposite of what it means. These
 * files land in the team's own sheet, so they have to say it the same way
 * the screen does, and say it in words that cannot be read backwards.
 *
 * `cancelled` used to fall through to the same word as unpaid, which put a
 * released maker on a chase list.
 */
function statusWords(status: string): string {
  if (status === 'confirmed') return 'Paid'
  if (status === 'payment_processing') return 'Clearing'
  if (status === 'forfeited' || status === 'cancelled') return 'Released'
  return 'Not paid'
}

const MOVE: Record<string, string> = {
  paid: '',
  said: 'Says they sent it',
  started: 'Opened Stripe, did not finish',
  nothing: 'Nothing back yet',
}

export async function paymentRows(
  db: DbHandle, showId: string, siteUrl: string,
): Promise<PaymentRow[]> {
  const rows = await db
    .select({ booking: bookings, vendor: vendors, space: spaceTypes })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))
    .orderBy(asc(bookings.vendorCode))

  /* Lines added or taken off since the booking was made. The fee on the
     booking is the space; a maker who added a second day owes more than that
     and the sheet is where the girls read it, so a tab showing the old number
     is a tab that sends somebody to collect the wrong amount. */
  const charges = await db
    .select({
      id: bookingCharges.id, bookingId: bookingCharges.bookingId,
      description: bookingCharges.description, amountCents: bookingCharges.amountCents,
      voidedAt: bookingCharges.voidedAt,
    })
    .from(bookingCharges)
  const byBooking = new Map<string, typeof charges>()
  for (const c of charges) {
    const list = byBooking.get(c.bookingId) ?? []
    list.push(c)
    byBooking.set(c.bookingId, list)
  }

  return rows.map(({ booking, vendor, space }) => {
    const ledger = ledgerFor({
      priceCents: booking.priceCents,
      addonsCents: booking.addonsCents,
      amountPaidCents: booking.amountPaidCents,
      charges: (byBooking.get(booking.id) ?? []).map((c) => ({
        id: c.id, description: c.description, amountCents: c.amountCents, voidedAt: c.voidedAt,
      })),
    })
    return {
    code: booking.vendorCode,
    shop: vendor.shopName,
    contact: vendor.contactName,
    email: vendor.email,
    track: space.track,
    space: space.label,
    /* Cents to a plain decimal, never a float multiply (rule 1), and never a
       dollar sign: a sheet has to be able to add this column up. */
    /* The running total, not the original fee. */
    fee: centsToPlain(ledger.totalCents),
    /* What is still owed after what has arrived. Zero for a settled booking,
       and the number to chase for everybody else. */
    balance: centsToPlain(Math.max(0, ledger.balanceCents)),
    payLink: booking.payToken ? `${siteUrl}/pay/${booking.payToken}` : '',
    due: booking.paymentDueAt ? fmtDateTime(booking.paymentDueAt) : '',
    /* A booking can be confirmed AND owe money: she paid for Saturday and
       added Sunday. The ledger knows that and the status column alone does
       not, so the word comes from whichever is the more useful answer. */
    status: ledger.balanceCents > 0 && isPaid(booking.status)
      ? 'Part paid'
      : statusWords(booking.status),
    paidHow: isPaid(booking.status) ? viaLabel(booking.paidVia) : '',
    paidAt: booking.paidAt ? fmtDateTime(booking.paidAt) : '',
    linkSent: booking.linkSentAt ? fmtDateTime(booking.linkSentAt) : '',
    theirMove: MOVE[makerSignal(booking)] ?? '',
    }
  })
}

/** Integer cents as a spreadsheet can add it: 28000 -> "280.00". */
export function centsToPlain(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const a = Math.abs(cents)
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}

/* ─────────────────────────── the two files ─────────────────────────── */

/** What the girls mail merge from. Nothing that goes stale. */
export const LINK_COLUMNS = [
  'Mermade ID', 'Shop', 'Contact', 'Email', 'Track', 'Space', 'Fee', 'Due', 'Pay link',
] as const

export const linkValues = (r: PaymentRow) =>
  [r.code, r.shop, r.contact, r.email, r.track, r.space, r.fee, r.due, r.payLink]

/** What they watch all day. Everything above plus where the money got to. */
export const PAYMENT_COLUMNS = [
  'Mermade ID', 'Shop', 'Contact', 'Email', 'Track', 'Space', 'Fee', 'Still owed',
  'Status', 'Paid how', 'Paid at', 'Link sent', 'Their move', 'Due', 'Pay link',
] as const

export const paymentValues = (r: PaymentRow) =>
  [r.code, r.shop, r.contact, r.email, r.track, r.space, r.fee, r.balance,
    r.status, r.paidHow, r.paidAt, r.linkSent, r.theirMove, r.due, r.payLink]

/**
 * RFC 4180, quoting everything.
 *
 * Unconditional quoting rather than only where it is needed, because a shop
 * on this roster is "Brighton Awad (Melissa, mom)" and a comma that shifts a
 * column shifts a fee.
 */
const cell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`

export function toCsv(headers: readonly string[], rows: string[][]): string {
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')
}
