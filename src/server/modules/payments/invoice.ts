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
  /** What has already arrived against this booking. */
  paidCents: number
  /** What is left to collect. Never negative: see amountToCollect. */
  amountDueCents: number
}

export type InvoiceInput = {
  spaceLabel: string
  spacePriceCents: number
  /** Further spaces the maker holds that cost extra, each its own line.
   *
   *  Outdoors a space is a day, so this is how a maker booked for Friday who
   *  later takes Saturday and Sunday is billed for them. A space granted at
   *  no charge is not here at all: access and invoicing are separate, which
   *  is why `booking_spaces.price_cents` is nullable. */
  extraSpaces?: { label: string; priceCents: number }[]
  addons: { name: string; priceCents: number }[]
  /** Things added or taken off since, already filtered to the ones that
   *  count. Signed: a second day is positive, a downgrade negative. */
  charges?: { label: string; amountCents: number }[]
  /** What has already been received. */
  paidCents?: number
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
    ...(input.extraSpaces ?? []).map((e) => ({ label: e.label, amountCents: e.priceCents })),
    ...input.addons.map((a) => ({ label: a.name, amountCents: a.priceCents })),
    ...(input.charges ?? []).map((c) => ({ label: c.label, amountCents: c.amountCents })),
  ]
  const totalCents = lines.reduce((sum, l) => sum + l.amountCents, 0)
  const paidCents = input.paidCents ?? 0
  return {
    lines,
    totalCents,
    paidCents,
    /* Never negative. A maker who has overpaid is owed money, and asking her
       for a negative amount is not a thing a checkout can do. What happens to
       an overpayment is a person's decision, on the roster. */
    amountDueCents: Math.max(0, totalCents - paidCents),
  }
}

/**
 * What to put in front of Stripe.
 *
 * Nothing has been paid yet: the itemised lines, so the maker sees the space
 * and every extra priced separately, which is most of what makes an invoice
 * feel like an invoice.
 *
 * Something HAS been paid and more is owed: one line for the balance. Stripe
 * will not take a negative line item, so there is no way to show the original
 * lines and subtract what arrived, and showing the full list while charging
 * the difference would be worse than showing one honest line. The itemised
 * version is still on the page above the button; this is only what the card
 * form says.
 */
export function checkoutLines(invoice: Invoice, showName: string): InvoiceLine[] {
  if (invoice.paidCents <= 0) return invoice.lines
  return [{
    label: `${showName} booth fee, balance`,
    amountCents: invoice.amountDueCents,
  }]
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
export function bookingPaymentKey(bookingId: string, door = 'portal', version = 1): string {
  /* The door is part of the key because it is part of the request. Stripe
     rejects a reused idempotency key whose parameters have changed, and the
     two doors send a maker back to two different pages: one key for both
     would turn "this maker opened the portal and then used the pasted link"
     into a 400 at the moment they tried to pay.

     Rule 4 still holds. What must never double-pay is a double-CLICK, and a
     double-click is always the same door, so it is always the same key. Only
     one session is ever live for a booking: startBoothPayment expires the
     other door's before it opens a new one. */
  return `booth:${bookingId}:${door}:v${version}`
}

/** A short, stable name for where a maker is paying from. Anything that is
 *  not the portal is a link staff pasted, and they all behave the same. */
export function paymentDoor(back: string): string {
  return back.startsWith('/pay/') ? 'link' : 'portal'
}
