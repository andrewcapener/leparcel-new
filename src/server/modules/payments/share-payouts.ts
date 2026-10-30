import type { ConnectFacts } from './connect'

/**
 * Paying one maker through another maker's account.
 *
 * Drew, 30 October: "MM19 and MM18 are essentially the same mom, but she has
 * two different daughters who are selling things. They want payouts to go to
 * the same account, but they do need a breakdown between MM19 and 18. I'm
 * thinking we might as well just pay her out once, so she only has to fill
 * that information out once."
 *
 * The breakdown and the bank account are different questions and the schema
 * already answers them separately. A statement is per booking, so two booths
 * keep two sets of commission maths no matter what. Where the money lands is
 * one id on the vendor, and the mechanism is a POINTER at the maker who owns
 * that account, never a copy of the id: vendors carries a unique index on
 * stripe_account_id, which is what makes a webhook about one account write
 * exactly one row.
 *
 * Note what this is NOT. It does not mark anybody as ready, and it cannot:
 * payouts_enabled is Stripe's verdict and nothing here stands in for it
 * (rule 5). It points a maker at an account that already exists and already
 * works. If that account is half finished, both makers read half finished,
 * which is the truth.
 *
 * Pure, and tested, because the thing being decided is where somebody else's
 * money goes.
 */

/** As much of a maker as this decision needs. */
export type PayoutParty = {
  id: string
  shopName: string
  vendorCode: string | null
  stripeAccountId: string | null
  /** Set when this maker is themselves paid through somebody else. */
  payoutsViaVendorId: string | null
}

export type ShareRead =
  | { ok: true; accountId: string; ownerId: string }
  | { bad: string }

export const MIN_REASON = 3

/**
 * Whether this maker may be paid through that one.
 *
 * Every refusal names the maker, because staff doing this are looking at two
 * MM codes that differ by one digit.
 */
export function readShare(
  me: PayoutParty,
  them: PayoutParty | undefined,
  reason: string,
): ShareRead {
  if (reason.trim().length < MIN_REASON) {
    return { bad: 'Say why, in a few words. It goes in the record.' }
  }
  if (!them) {
    return { bad: 'No maker at this show has that number.' }
  }
  if (them.id === me.id) {
    return { bad: `${me.shopName} cannot be paid through their own account.` }
  }
  if (!them.stripeAccountId) {
    return {
      bad: `${them.shopName} has not set up payouts yet, so there is no account`
        + ' to share. Ask them to finish theirs first.',
    }
  }
  /* No chains. A pointing at B pointing at C is a thing nobody can follow in
     December, and it breaks the moment one of the three changes. One hop, to
     an account its own maker actually owns. */
  if (them.payoutsViaVendorId) {
    return {
      bad: `${them.shopName} is themselves paid through somebody else's account.`
        + ' Point this maker at whoever owns that one instead.',
    }
  }
  return { ok: true, accountId: them.stripeAccountId, ownerId: them.id }
}

/** What the admin page says once it is set. */
export function sharedWords(owner: { shopName: string; vendorCode: string | null }): string {
  return owner.vendorCode
    ? `Paid through ${owner.vendorCode} ${owner.shopName}.`
    : `Paid through ${owner.shopName}.`
}

/** What the MAKER is told on her own page, which is a different sentence:
 *  she did not do this and should not be asked to undo it. */
export function sharedForMaker(owner: { shopName: string }): string {
  return `Your share goes to the account ${owner.shopName} set up. There is`
    + ' nothing for you to do here, and nothing more to fill in.'
}

/* ═══════════════ reading it back, everywhere money is counted ═══════════════

   One maker's readiness is another's, which every screen that counts payouts
   has to know or it reports a gap that does not exist and writes to a maker
   asking her to set up what her mother already did. So the resolution lives
   here once rather than in each screen's own select. */

/** The Connect columns a screen reads. The same shape connectState wants,
 *  by name, so resolving the account cannot quietly change what is read. */
export type PayoutColumns = ConnectFacts

/**
 * The account that actually pays this maker: her own, or the one she was
 * pointed at. One hop and no further, which readShare guarantees by refusing
 * to point anybody at a maker who is herself paid through somebody else.
 *
 * Falls back to her own columns when the owner is not in the map, which is
 * the honest answer: a screen that only loaded this show's makers would
 * otherwise report an owner it cannot see as ready.
 */
export function payingAccount<T extends PayoutColumns>(
  me: T & { payoutsViaVendorId: string | null },
  owners: ReadonlyMap<string, T>,
): T {
  if (!me.payoutsViaVendorId) return me
  return owners.get(me.payoutsViaVendorId) ?? me
}
