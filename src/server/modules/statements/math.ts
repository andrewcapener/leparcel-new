import { splitCommission } from '@/lib/money'

/**
 * What a maker is owed after a show.
 *
 * The one calculation in this codebase that decides what leaves the bank, so
 * it lives here as pure functions and nowhere else (CLAUDE.md rule 2). No
 * route, no component and no query recomputes any part of it.
 *
 * The shape follows docs/03 §10 exactly rather than being redesigned:
 *
 *     net sales = gross - discounts - refunds
 *     commission, net = split(net sales, commission_bps)
 *     payout = net + adjustments
 *
 * `commission_bps` is the booking's own snapshot, taken the day the maker was
 * accepted and immutable since (rule 6). A rate changed on the Show record in
 * December must never reach back into November's money, which is the whole
 * reason the booking carries its own copy.
 */

/** A line somebody added by hand: a deduction is negative, a credit positive. */
export type Adjustment = {
  code: string
  description: string
  /** Signed, integer cents. Negative takes money off the payout. */
  amountCents: number
}

export type StatementInput = {
  /** Everything that rang up for this maker, before anything comes off. */
  grossCents: number
  /** Money never collected: a discount at the till. */
  discountsCents: number
  /** Money collected and given back. */
  refundsCents: number
  /** The BOOKING's snapshot, never the Show's current setting. */
  commissionBps: number
  adjustments: Adjustment[]
  itemsSold: number
}

export type StatementTotals = {
  grossCents: number
  discountsCents: number
  refundsCents: number
  netSalesCents: number
  commissionBps: number
  commissionCents: number
  /** The maker's share before anything is added or taken off by hand. */
  netCents: number
  /** Sum of the negative adjustments. Negative or zero. */
  deductionsCents: number
  /** Sum of the positive adjustments. Positive or zero. */
  creditsCents: number
  /** What actually leaves the bank. Can be negative: see `owesUs`. */
  payoutCents: number
  itemsSold: number
  /**
   * True when deductions have eaten more than the maker earned.
   *
   * A real case and not an error: a maker with almost no sales and a
   * replacement cost against her can finish a show owing Mermade money. It is
   * flagged rather than clamped, because clamping to zero would quietly
   * forgive a debt and nobody would ever see it, and because what to do about
   * it is a decision for a person and not a rounding rule.
   */
  owesUs: boolean
}

const whole = (n: number, what: string) => {
  if (!Number.isInteger(n)) throw new Error(`${what} must be integer cents`)
  return n
}

export function statementTotals(input: StatementInput): StatementTotals {
  const gross = whole(input.grossCents, 'gross')
  const discounts = whole(input.discountsCents, 'discounts')
  const refunds = whole(input.refundsCents, 'refunds')
  whole(input.commissionBps, 'commission bps')

  /* Discounts and refunds come off BEFORE the house takes its share. Mermade
     does not earn commission on money it never kept: a $40 piece sold at $30
     earns the house 20% of $30, and a refunded sale earns nothing at all. */
  const netSales = gross - discounts - refunds

  const split = splitCommission(netSales, input.commissionBps)

  let deductions = 0
  let credits = 0
  for (const a of input.adjustments) {
    whole(a.amountCents, `adjustment ${a.code}`)
    if (a.amountCents < 0) deductions += a.amountCents
    else credits += a.amountCents
  }

  const payout = split.netCents + credits + deductions

  return {
    grossCents: gross,
    discountsCents: discounts,
    refundsCents: refunds,
    netSalesCents: netSales,
    commissionBps: input.commissionBps,
    commissionCents: split.commissionCents,
    netCents: split.netCents,
    deductionsCents: deductions,
    creditsCents: credits,
    payoutCents: payout,
    itemsSold: input.itemsSold,
    owesUs: payout < 0,
  }
}

/**
 * Whether this statement may be paid at all.
 *
 * Deliberately separate from the arithmetic, and deliberately a list of
 * reasons rather than a boolean: "cannot pay" with no reason is the thing
 * somebody stares at on payout day.
 *
 * Mirrors invariant 4 in docs/03 §10: approval needs compliance cleared and
 * Stripe's own verdict on the account.
 */
export function payoutBlockers(s: {
  totals: StatementTotals
  payoutsReady: boolean
  complianceClear: boolean
  status: string
}): string[] {
  const out: string[] = []
  if (s.status === 'void') out.push('This statement was voided and superseded.')
  if (s.status === 'paid') out.push('Already paid.')
  if (!s.complianceClear) out.push('Their paperwork is not cleared.')
  /* Stripe's verdict and nothing else. Our own columns looking agreeable has
     never been enough: the money either can leave or it cannot. */
  if (!s.payoutsReady) out.push('Their payout account is not ready at Stripe.')
  if (s.totals.owesUs) out.push('The deductions come to more than they earned, so there is nothing to send.')
  if (s.totals.payoutCents === 0) out.push('Nothing to send.')
  return out
}

/** The key that stops a double press paying twice (rule 4). */
export function payoutIdempotencyKey(statementId: string, version: number): string {
  return `payout:${statementId}:v${version}`
}
