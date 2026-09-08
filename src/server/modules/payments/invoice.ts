/**
 * What an accepted maker owes, and nothing else.
 *
 * Pure, so it can be property-tested (CLAUDE.md rule 2). Every figure comes
 * from the booking row, which snapshotted the space price and each add-on
 * price at acceptance, and from nowhere else. Reading today's price off
 * space_types would mean a maker accepted in September could be charged
 * October's number, which is exactly what the snapshot exists to prevent
 * (rule 6).
 *
 * Integer cents throughout (rule 1). There is no rounding in here at all,
 * because a booth fee is a sum of prices somebody typed, not a percentage of
 * anything. The commission math that does round lives in statements/.
 */

export type InvoiceLine = {
  /** What the maker sees. Already human, already final. */
  label: string
  amountCents: number
}

export type Invoice = {
  lines: InvoiceLine[]
  totalCents: number
}

export type InvoiceInput = {
  spaceLabel: string
  spacePriceCents: number
  addons: { name: string; priceCents: number }[]
}

/**
 * The lines and the total.
 *
 * The total is the sum of the lines shown, never a stored figure alongside
 * them: a maker who adds up the rows and gets a different answer than the
 * button charges has caught us being wrong, and that must be impossible by
 * construction rather than by care.
 */
export function invoiceFor(input: InvoiceInput): Invoice {
  const lines: InvoiceLine[] = [
    { label: input.spaceLabel, amountCents: input.spacePriceCents },
    ...input.addons.map((a) => ({ label: a.name, amountCents: a.priceCents })),
  ]
  return {
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
  }
}

/**
 * Is what Stripe collected what we asked for?
 *
 * Called from the webhook before a booking is marked paid. Stripe reports the
 * amount it actually received, and it is not automatically the amount we put
 * in the session: a session can be built wrong, a price can be edited between
 * creating and paying, and Stripe's own docs are clear that the event is the
 * truth. An exact match is the only thing that confirms a booking; anything
 * else is recorded and left for a person, because silently accepting a short
 * payment means a maker holds a space they did not buy.
 */
export function paymentMatches(expectedCents: number, receivedCents: number): boolean {
  return Number.isInteger(expectedCents)
    && Number.isInteger(receivedCents)
    && expectedCents === receivedCents
}

/**
 * The Stripe idempotency key for a booking's payment (CLAUDE.md rule 4).
 *
 * Stable per booking, so a maker who double-clicks Pay, or reloads the page
 * mid-redirect, reuses the one Checkout Session rather than creating a second
 * one against the same space. `v` exists for the case where a session has to
 * be deliberately abandoned and replaced, e.g. the price was corrected: bump
 * it and Stripe treats the next call as new work instead of replaying the old
 * answer.
 */
export function bookingPaymentKey(bookingId: string, version = 1): string {
  return `booth:${bookingId}:v${version}`
}
