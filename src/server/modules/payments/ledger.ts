/**
 * What a booking is worth now, what has arrived, and the difference.
 *
 * Drew, 24 Sept: "consider this like an e-commerce thing where things might
 * change over time. We might add fees, they might want priority, they might
 * want an extra day, they might want a bigger booth, they might want a
 * smaller booth."
 *
 * A booking used to be one price, frozen once money moved. The freeze was
 * right and the shape was wrong: what changes is the ORDER, and the
 * difference is either owed or owing. So the fee becomes a running total and
 * this file is the arithmetic of it. Pure, so the one thing that decides what
 * a maker is asked to pay can be tested exhaustively rather than by reading
 * a screen (CLAUDE.md rule 2).
 *
 * Three numbers, and the third is the only one anybody asks about:
 *
 *   total    the space, plus add-ons, plus every line still standing
 *   paid     what has actually arrived, which Stripe and staff own, not this
 *   balance  total minus paid
 *
 * A positive balance is owed. A negative one means they have paid more than
 * they now owe, which is a person's decision (refund or credit) and never
 * this file's.
 *
 * Integer cents throughout, never a float (rule 1). The invariant this holds
 * is that the lines add up to the total exactly, for any inputs, which is
 * property-tested next door.
 */

export type ChargeLine = {
  id: string
  description: string
  /** Signed: positive is owed, negative comes off. */
  amountCents: number
  /** Null means it counts. A voided line stays visible and stops counting. */
  voidedAt?: string | null
}

export type LedgerInput = {
  /** The space itself, snapshotted at booking time. */
  priceCents: number
  /** Add-ons chosen on the application, snapshotted the same way. */
  addonsCents: number
  /** Everything added or removed since. */
  charges: ChargeLine[]
  /** What has actually arrived. Null means nothing yet. */
  amountPaidCents?: number | null
}

export type Ledger = {
  totalCents: number
  paidCents: number
  /** Positive: they owe. Negative: they have overpaid. Zero: settled. */
  balanceCents: number
  /** The lines that count, in the order they were added. */
  active: ChargeLine[]
  /** The lines that were taken off, kept so the invoice can be read back. */
  voided: ChargeLine[]
}

const counts = (c: ChargeLine) => !c.voidedAt

export function ledgerFor(input: LedgerInput): Ledger {
  const active = input.charges.filter(counts)
  const voided = input.charges.filter((c) => !counts(c))

  /* Summed as integers and never multiplied. Every term is already cents. */
  const totalCents = active.reduce(
    (sum, c) => sum + c.amountCents,
    input.priceCents + input.addonsCents,
  )
  const paidCents = input.amountPaidCents ?? 0

  return { totalCents, paidCents, balanceCents: totalCents - paidCents, active, voided }
}

/* ──────────────────────── what it means ──────────────────────── */

export type Standing =
  /** Nothing has arrived and something is owed. */
  | 'owes'
  /** Something arrived, and there is still a balance. The add-a-day case. */
  | 'owes_more'
  /** Paid exactly, or nothing to pay. */
  | 'settled'
  /** More arrived than is now owed. A person decides what happens next. */
  | 'overpaid'

/**
 * How a booking stands, in one word.
 *
 * Deliberately separate from `bookings.status`. That column is payment state
 * and belongs to Stripe and to staff pressing Mark paid (rule 5); a line item
 * must never move it. A confirmed booking that grows a second day is still
 * confirmed, and it owes $450, and both of those are true at once.
 */
export function standing(l: Ledger): Standing {
  if (l.balanceCents === 0) return 'settled'
  if (l.balanceCents < 0) return 'overpaid'
  return l.paidCents > 0 ? 'owes_more' : 'owes'
}

/** The same four, in the words the roster and the sheet use. */
export function standingWords(l: Ledger): string {
  switch (standing(l)) {
    case 'settled': return l.totalCents === 0 ? 'Nothing to pay' : 'Paid in full'
    case 'owes_more': return 'Part paid'
    case 'overpaid': return 'Overpaid'
    default: return 'Not paid'
  }
}

/**
 * What the pay page should ask for.
 *
 * The balance, never the total. A maker who paid $900 and added a day is
 * asked for the difference, and asking for the whole thing again is the
 * mistake this exists to prevent. Never negative: an overpaid booking is
 * owed money, not asked for it.
 */
export function amountToCollect(l: Ledger): number {
  return Math.max(0, l.balanceCents)
}

/**
 * Can this line be added without producing something nobody meant?
 *
 * Kept here rather than in the form so the rule is the same wherever a line
 * comes from. A zero line is not a change; an empty description is a row
 * somebody will find in December and not recognise.
 */
export function chargeProblem(description: string, amountCents: number): string | null {
  if (!description.trim()) return 'Say what the line is for. It goes on the maker’s invoice.'
  if (!Number.isInteger(amountCents)) return 'That is not a whole number of cents.'
  if (amountCents === 0) return 'A line for nothing is not a change.'
  if (Math.abs(amountCents) > 1_000_000) return 'That is more than $10,000. Check the number.'
  return null
}
