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

/** What Stripe is told to offer. Order is Stripe's to decide. */
export function stripeMethods(policy: PaymentMethods): ('card' | 'us_bank_account')[] {
  switch (policy) {
    case 'bank_only': return ['us_bank_account']
    case 'card_only': return ['card']
    default: return ['card', 'us_bank_account']
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
