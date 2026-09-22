import {
  PAID_VIA, isPaidVia, viaFromStripeType, viaFromEvent, viaFromManual, viaLabel,
  makerSignal,
} from './paid-via'

let failures = 0
const check = (name: string, ok: boolean) => {
  if (!ok) { failures++; console.error(`FAIL: ${name}`) }
}

/* ── the vocabulary ── */

check('five routes and no more', PAID_VIA.join() === 'card,bank,venmo,zelle,other')
check('a known route is a route', PAID_VIA.every(isPaidVia))
check('anything else is not', !isPaidVia('paypal') && !isPaidVia('') && !isPaidVia(null)
  && !isPaidVia(undefined) && !isPaidVia(7))

/* ── Stripe's own names ── */

check('a card is a card', viaFromStripeType('card') === 'card')
check('Link settles and costs like a card, so it counts as one',
  viaFromStripeType('link') === 'card')
check('us_bank_account is the bank transfer', viaFromStripeType('us_bank_account') === 'bank')
check('a method we have never offered is not invented',
  viaFromStripeType('cashapp') === 'other')
check('no method is no answer',
  viaFromStripeType(null) === null && viaFromStripeType(undefined) === null
  && viaFromStripeType('') === null)

/* ── the inference, which is the point of the file ──
   A Checkout Session names what was OFFERED. The event itself is what says
   which kind of method was used. */

const BOTH = ['us_bank_account', 'card']
const COMPLETED = 'checkout.session.completed'
const ASYNC_OK = 'checkout.session.async_payment_succeeded'

check('a settled completed is a card, even with bank on the table',
  viaFromEvent(COMPLETED, 'paid', BOTH) === 'card')
/* The one that matters. ACH authorises on `completed` with payment_status
   "unpaid" and lands days later. Reading that first event as a card would
   report the cheap route as the expensive one on every transfer we take. */
check('an unsettled completed is a bank transfer authorising',
  viaFromEvent(COMPLETED, 'unpaid', BOTH) === 'bank')
check('and it is still a bank transfer when the money lands',
  viaFromEvent(ASYNC_OK, 'paid', BOTH) === 'bank')
/* A Show set to one method needs no inference at all. */
check('bank_only is a bank transfer whatever the event says',
  viaFromEvent(COMPLETED, 'paid', ['us_bank_account']) === 'bank')
check('card_only is a card', viaFromEvent(COMPLETED, 'paid', ['card']) === 'card')
check('Link riding along does not make the offered list ambiguous',
  viaFromEvent(COMPLETED, 'paid', ['card', 'link']) === 'card')
check('nor does it against a bank_only show',
  viaFromEvent(COMPLETED, 'unpaid', ['us_bank_account', 'link']) === 'bank')

/* Never a guess. */
check('an event that says nothing gives nothing',
  viaFromEvent('checkout.session.async_payment_failed', null, []) === null)
check('an unknown event type with no offered list gives nothing',
  viaFromEvent('payment_intent.succeeded', 'paid', []) === null)
check('an empty offered list on a plain completed still reads as a card',
  viaFromEvent(COMPLETED, 'paid') === 'card')

/* ── the manual match ── */

check('what staff picked wins', viaFromManual('zelle', 'venmo') === 'zelle')
check('what the maker said is the default',
  viaFromManual('', 'venmo') === 'venmo' && viaFromManual(null, 'zelle') === 'zelle')
check('nothing from either side is "other", never a guess',
  viaFromManual('', '') === 'other'
  && viaFromManual(null, null) === 'other'
  && viaFromManual(undefined, undefined) === 'other')
check('a junk value is not trusted from either side',
  viaFromManual('bitcoin', 'carrier pigeon') === 'other')
check('and the answer is always a real route', PAID_VIA.includes(viaFromManual('x', 'y')))

/* ── labels ── */

check('every route has words', PAID_VIA.every((v) => viaLabel(v).length > 0))
check('a booking paid before the column existed says so, rather than guessing',
  viaLabel(null) === 'Route not recorded' && viaLabel(undefined) === 'Route not recorded')
check('the two Stripe routes are told apart in words',
  viaLabel('card') !== viaLabel('bank'))

/* ── what the maker actually did ──
   The honesty test for the whole screen. Nothing in this codebase records a
   page view or a maker sign-in, so no input here can produce "opened". */

check('money in is the strongest signal',
  makerSignal({ status: 'confirmed' }) === 'paid')
check('a transfer in flight counts as the maker having done their part',
  makerSignal({ status: 'payment_processing' }) === 'paid')
check('a Venmo claim is a real click from the maker',
  makerSignal({ status: 'awaiting_payment', saidSentAt: '2026-09-23T17:00:00Z' }) === 'said')
check('an open Stripe session means they pressed Pay',
  makerSignal({ status: 'awaiting_payment', stripeSessionId: 'cs_test_1' }) === 'started')
check('the claim outranks the session, because it is the later thing they did',
  makerSignal({
    status: 'awaiting_payment', stripeSessionId: 'cs_test_1', saidSentAt: '2026-09-23T17:00:00Z',
  }) === 'said')
check('no trace of them is "nothing", not "unopened"',
  makerSignal({ status: 'awaiting_payment' }) === 'nothing'
  && makerSignal({ status: 'awaiting_payment', stripeSessionId: null, saidSentAt: null }) === 'nothing'
  && makerSignal({ status: 'awaiting_payment', stripeSessionId: '', saidSentAt: '' }) === 'nothing')
/* Staff ticking "I sent the link" is not the maker doing anything, and this
   function cannot see that column at all. That is deliberate. */
check('a released space with nothing from the maker still reads as nothing',
  makerSignal({ status: 'forfeited' }) === 'nothing')

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('paid via: a bank transfer is never read as a card, and an unseen maker is never read as one who opened the link')
export {}
