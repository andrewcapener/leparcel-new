/**
 * Which payment methods a Checkout Session offers, and what that means for
 * the deadline.
 *
 * Pure, because the consequence is not cosmetic. Bank transfer is what this
 * business should want people to use: ACH is 0.8% capped at $5 against card's
 * 2.9% + 30c, which on a $450 outdoor booth is $5 instead of $13.35. But ACH
 * is a delayed notification method and Stripe puts settlement at "typically 4
 * business days", which is longer than the 48 hour payment window.
 *
 * So under bank_only the deadline changes meaning, and every screen has to say
 * the same thing about it. That is what `deadlineMeans` is for: one answer,
 * used by the invoice, the acceptance email and the admin, instead of three
 * screens each guessing.
 */
export type PaymentMethods = 'card_and_bank' | 'bank_only' | 'card_only'

/**
 * What Stripe is told to offer, and in what order.
 *
 * The order is not cosmetic and it is not Stripe's to decide: Checkout renders
 * these in the order given and preselects the first. So this one line largely
 * decides the mix between a method that costs 0.8% capped at $5 and one that
 * costs 2.9% plus thirty cents.
 *
 * Bank first, deliberately. Card stays one tap away for anybody whose bank
 * will not link or who simply prefers it, which is the whole reason to offer
 * both, but the default should be the cheap one. On a full show the gap
 * between everybody defaulting to bank and everybody defaulting to card is
 * most of a thousand dollars, and nobody is worse off for the ordering: the
 * maker who wants a card still gets one.
 */
export function stripeMethods(policy: PaymentMethods): ('card' | 'us_bank_account')[] {
  switch (policy) {
    case 'bank_only': return ['us_bank_account']
    case 'card_only': return ['card']
    default: return ['us_bank_account', 'card']
  }
}

/**
 * Can a maker paying this way be CONFIRMED inside the payment window?
 *
 * False whenever bank transfer is the only option, because four business days
 * does not fit in forty eight hours and no amount of wishing changes that.
 * When this is false the deadline is a deadline to START paying.
 */
export function settlesInsideWindow(policy: PaymentMethods): boolean {
  return policy !== 'bank_only'
}

/** The deadline, in the words a maker should read. */
export function deadlineMeans(policy: PaymentMethods): 'be paid by' | 'start your transfer by' {
  return settlesInsideWindow(policy) ? 'be paid by' : 'start your transfer by'
}

/** True when card is on the table at all. Used to decide whether to explain
 *  the fee difference, which is only worth saying when there is a choice. */
export function offersCard(policy: PaymentMethods): boolean {
  return policy !== 'bank_only'
}

export function offersBank(policy: PaymentMethods): boolean {
  return policy !== 'card_only'
}
