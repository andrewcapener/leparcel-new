/**
 * What a booking's status MEANS, in one place.
 *
 * Four screens were each carrying their own `['confirmed', 'awaiting_payment']`
 * literal, which was fine while those were the only two states that held a
 * space. Adding `payment_processing` for bank transfers in flight made every
 * one of those literals silently wrong in a different way: the roster would
 * have dropped a paying maker out of expected revenue, the admin badge would
 * have stopped counting them entirely, and nothing would have said so.
 *
 * Pure and tested, because the distinction that matters here is not
 * cosmetic: it decides whether a maker keeps their space.
 */
export type BookingStatus =
  | 'awaiting_payment'
  | 'payment_processing'
  | 'confirmed'
  | 'forfeited'
  | 'cancelled'

/** Money is actually in the bank. Only this counts as collected. */
export function isPaid(status: string): boolean {
  return status === 'confirmed'
}

/**
 * The maker has a space. Counts toward capacity and toward expected revenue.
 *
 * `payment_processing` belongs here: the maker authorised a bank transfer
 * inside their window and Stripe takes about four business days to settle it.
 * They have done everything asked of them.
 */
export function holdsSpace(status: string): boolean {
  return status === 'confirmed'
    || status === 'payment_processing'
    || status === 'awaiting_payment'
}

/**
 * Can this booking still be paid?
 *
 * Only a booking that is waiting for money. Every other state is a no for its
 * own reason: `confirmed` has already been paid, `payment_processing` has a
 * transfer in flight and a second charge would take the fee twice, and
 * `forfeited` or `cancelled` no longer holds a space at all.
 *
 * That last pair is why this exists. The pay link is a capability, it lives
 * in somebody's inbox forever, and the only guard in front of it refused
 * `confirmed` and nothing else, so a maker whose space had been released
 * could still open an old email and pay for it. Money against a released
 * booking is a refund, an apology, and a space that was promised to somebody
 * else.
 */
export function canStartPayment(status: string): boolean {
  return status === 'awaiting_payment'
}

/**
 * Somebody needs to chase this maker.
 *
 * Deliberately NOT `payment_processing`. Chasing a maker whose money is
 * already on its way is how you make a good maker feel like a debtor.
 */
export function needsChasing(status: string): boolean {
  return status === 'awaiting_payment'
}

/**
 * Can this booking lose its space when the window closes?
 *
 * Only a booking where nothing was ever started. A transfer in flight is
 * never forfeitable, and this is the single most important line in the file:
 * forfeiting a maker who paid by bank on the last day, because the money had
 * not landed yet, would be taking a space from somebody who did it right.
 */
export function isForfeitable(
  status: string, dueAtIso: string, nowIso: string,
  /* The maker pressed "I have sent it" on their Venmo or Zelle. Not a
     payment, and it never confirms anything, but it is a claim that money is
     on its way and releasing the space of somebody who really did pay is the
     one mistake here that cannot be undone with a click. So it holds the
     space and hands the row to a person instead. */
  saidSentAt?: string | null,
): boolean {
  if (status !== 'awaiting_payment') return false
  if (saidSentAt) return false
  const due = Date.parse(dueAtIso)
  const now = Date.parse(nowIso)
  if (!Number.isFinite(due) || !Number.isFinite(now)) return false
  return now > due
}
