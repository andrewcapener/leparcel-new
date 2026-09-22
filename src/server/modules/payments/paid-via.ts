/**
 * Which route a booth fee took, in one word.
 *
 * Money arrives four ways and each one is somebody else's record: a card and
 * an ACH transfer land in Stripe, a Venmo lands in an app on a phone, a Zelle
 * lands in the bank. The booking is the only place all four meet, so the route
 * belongs on the booking or it is not written down anywhere.
 *
 * Pure, and tested, because the two Stripe answers are INFERRED rather than
 * handed to us. A Checkout Session names the methods that were offered, not
 * the one that was used, and getting that inference wrong does not fail: it
 * quietly reports the wrong split between a route that costs 0.8% capped at $5
 * and one that costs 2.9% plus thirty cents.
 */
export const PAID_VIA = ['card', 'bank', 'venmo', 'zelle', 'other'] as const
export type PaidVia = (typeof PAID_VIA)[number]

/** The routes staff can pick when they match a payment by hand. Stripe's two
 *  are never offered in a dropdown: only a verified webhook writes those. */
export const MANUAL_VIA = ['venmo', 'zelle', 'other'] as const

export function isPaidVia(v: unknown): v is PaidVia {
  return typeof v === 'string' && (PAID_VIA as readonly string[]).includes(v)
}

/** Stripe's own payment_method type name, in our words. */
export function viaFromStripeType(type: string | null | undefined): PaidVia | null {
  if (!type) return null
  /* Link is Stripe's saved-card wallet, so it settles and costs like a card.
     Treating it as its own route would split the card total in two for no
     reason a person reading this screen would recognise. */
  if (type === 'card' || type === 'link') return 'card'
  if (type === 'us_bank_account') return 'bank'
  return 'other'
}

/**
 * Which route a Checkout payment took, from the webhook event alone.
 *
 * No second call to Stripe, because the event already settles it. Checkout
 * splits payment methods into two kinds and tells us which kind this was:
 *
 *   A card settles at once. `checkout.session.completed` arrives with
 *   payment_status "paid" and there is nothing more to come.
 *
 *   ACH is a delayed notification method. `completed` arrives "unpaid", the
 *   money lands days later on `async_payment_succeeded`, and no card ever
 *   takes that path.
 *
 * So a settled `completed` is a card and an async event is a transfer, and
 * the only case needing the offered list at all is a Show configured for one
 * method, where the answer is simply that method.
 *
 * Returns null rather than guessing when the event does not say. A row that
 * reads "not recorded" is a small hole. A row that reads "card" when the money
 * came by transfer is a wrong number somebody will reconcile against.
 */
export function viaFromEvent(
  eventType: string,
  paymentStatus: string | null | undefined,
  /** `payment_method_types` off the Session: what was OFFERED, not chosen. */
  offered: readonly string[] = [],
): PaidVia | null {
  /* Card is not on the table, or bank is not. Then there is nothing to
     infer. Link rides along with card and never changes the answer. */
  const real = offered.filter((t) => t !== 'link')
  if (real.length === 1) return viaFromStripeType(real[0])

  if (eventType === 'checkout.session.async_payment_succeeded') return 'bank'
  /* A `completed` that has not settled is the authorisation half of a delayed
     method, which for this integration is ACH and nothing else. */
  if (paymentStatus && paymentStatus !== 'paid') return 'bank'
  if (eventType === 'checkout.session.completed' && paymentStatus === 'paid') return 'card'
  return null
}

/**
 * The route staff matched by hand.
 *
 * Falls back to what the maker said when they pressed "I have sent it", which
 * is the whole point of having asked: staff who found a $280 Venmo against an
 * MM code should not have to retype which app they were just looking at. A
 * maker who never said anything, and a staff member who picked nothing, give
 * "other" rather than a guess.
 */
export function viaFromManual(
  chosen: string | null | undefined,
  saidSentVia: string | null | undefined,
): PaidVia {
  if (isPaidVia(chosen)) return chosen
  if (isPaidVia(saidSentVia)) return saidSentVia
  return 'other'
}

/** The route in the words the screen uses. Null is an honest gap, never a
 *  guess: those bookings were paid before anything recorded the route. */
export function viaLabel(via: string | null | undefined): string {
  switch (via) {
    case 'card': return 'Card'
    case 'bank': return 'Bank transfer'
    case 'venmo': return 'Venmo'
    case 'zelle': return 'Zelle'
    case 'other': return 'Another way'
    default: return 'Route not recorded'
  }
}

/**
 * What the MAKER has actually done, which is not the same question as whether
 * staff sent them anything.
 *
 * `linkSentAt` is a person ticking a box to say they wrote an email. It is not
 * evidence that anybody read it, and this codebase records no page views and
 * no maker sign-ins, so nothing here can honestly say "opened". What it can
 * say is what the maker DID, each one a write only they could have caused:
 *
 *   paid     the money is in
 *   started  they pressed Pay and a Checkout Session exists against them
 *   said     they pressed "I have sent it" on a Venmo or a Zelle
 *   nothing  no trace of them, which may mean they never opened the link and
 *            may mean they read it and closed the tab. We cannot tell, and
 *            the screen says so rather than picking one.
 */
export type MakerSignal = 'paid' | 'started' | 'said' | 'nothing'

export function makerSignal(b: {
  status: string
  stripeSessionId?: string | null
  saidSentAt?: string | null
}): MakerSignal {
  if (b.status === 'confirmed' || b.status === 'payment_processing') return 'paid'
  if (b.saidSentAt) return 'said'
  if (b.stripeSessionId) return 'started'
  return 'nothing'
}
