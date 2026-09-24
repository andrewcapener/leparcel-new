import {
  isPaid, holdsSpace, needsChasing, isForfeitable, canStartPayment, canCollect,
} from './booking-status'

let failures = 0
const check = (name: string, ok: boolean) => {
  if (!ok) { failures++; console.error(`FAIL: ${name}`) }
}

const ALL = ['awaiting_payment', 'payment_processing', 'confirmed', 'forfeited', 'cancelled']

check('only confirmed counts as paid', ALL.filter(isPaid).join() === 'confirmed')
check('three states hold a space',
  ALL.filter(holdsSpace).join() === 'awaiting_payment,payment_processing,confirmed')
check('only an unpaid booking is chased', ALL.filter(needsChasing).join() === 'awaiting_payment')

const past = '2026-09-01T00:00:00Z'
const future = '2026-12-01T00:00:00Z'
const now = '2026-09-09T00:00:00Z'

check('an unpaid booking past its deadline is forfeitable', isForfeitable('awaiting_payment', past, now))
check('an unpaid booking inside its window is not', !isForfeitable('awaiting_payment', future, now))

/* The one that matters. A maker who sent a bank transfer on the last day is
   still "processing" days later, and must never lose their space for it. */
check('a transfer in flight is never forfeitable, even long past the deadline',
  !isForfeitable('payment_processing', past, now))
check('a confirmed booking is never forfeitable', !isForfeitable('confirmed', past, now))
check('an already forfeited booking is not forfeited twice', !isForfeitable('forfeited', past, now))
check('a cancelled booking is not forfeitable', !isForfeitable('cancelled', past, now))

/* An unparseable date must never be read as "overdue". A bad row is a bug to
   look at, not a reason to take somebody's space. */
check('an unreadable deadline is not forfeitable', !isForfeitable('awaiting_payment', 'not a date', now))
check('an unreadable now is not forfeitable', !isForfeitable('awaiting_payment', past, 'not a date'))

/* Exactly at the deadline is still inside it. */
check('the deadline instant itself has not passed', !isForfeitable('awaiting_payment', now, now))

/* ── "I have sent it" ──
   A maker who says a Venmo is on its way is not evidence of payment, and
   nothing here marks her paid. But her space must not be released out from
   under her while somebody goes looking for it: chasing a maker who paid is
   embarrassing, releasing one is not recoverable. */
check('a maker who says they sent it is never forfeitable',
  !isForfeitable('awaiting_payment', past, now, '2026-09-22T01:00:00Z'))
check('and the claim does not otherwise change the answer',
  isForfeitable('awaiting_payment', past, now, null)
  && isForfeitable('awaiting_payment', past, now, undefined))
check('an empty claim is not a claim',
  isForfeitable('awaiting_payment', past, now, ''))
/* It holds the space; it does not confirm it. Everything else still decides
   the same way it did. */
check('saying so does not make a booking paid', !isPaid('awaiting_payment'))
check('and it still counts as holding a space', holdsSpace('awaiting_payment'))


/* Who may still be charged. The pay link is a capability that lives in an
   inbox forever, so this is the only thing standing between a released space
   and a payment against it. */
check('a booking waiting for money can be paid', canStartPayment('awaiting_payment'))
check('one already paid cannot be paid again', !canStartPayment('confirmed'))
/* A second charge on a transfer in flight would take the fee twice. */
check('a transfer in flight cannot be charged again', !canStartPayment('payment_processing'))
/* The two that matter: these no longer hold a space at all, and money against
   one is a refund, an apology and a space promised to somebody else. */
check('a forfeited space cannot be paid for', !canStartPayment('forfeited'))
check('a released space cannot be paid for', !canStartPayment('cancelled'))
check('and nor can nonsense', !canStartPayment('') && !canStartPayment('banana'))

/* ── what can still be collected, which the status alone cannot answer ──
 *
 * The case this exists for: a maker paid for Saturday, then added Friday. She
 * is confirmed, she holds her space, and she owes $350. Reading "confirmed" as
 * "has paid" left her looking at a line on her invoice with no way to pay it.
 */
check('a maker who has paid and then added a day can pay the difference',
  canCollect('confirmed', 35000))
check('an ordinary unpaid booking can be paid', canCollect('awaiting_payment', 28000))
check('one that is settled is not asked for anything', !canCollect('confirmed', 0))
check('nor is an overpaid one, which is owed money rather than asked for it',
  !canCollect('confirmed', -5000))
check('a free space is never sent to Stripe', !canCollect('awaiting_payment', 0))
/* The one that matters most: her money is already moving. */
check('a transfer in flight is never charged again, whatever the balance says',
  !canCollect('payment_processing', 35000))
check('a forfeited space takes no more money', !canCollect('forfeited', 35000))
check('nor does a released one', !canCollect('cancelled', 35000))
check('and nor does nonsense', !canCollect('', 35000) && !canCollect('banana', 35000))
/* Anything collectable must still be holding the space it is being paid for. */
for (const st of ['awaiting_payment', 'confirmed', 'payment_processing', 'forfeited', 'cancelled']) {
  if (canCollect(st, 35000)) check(`${st} holds a space if it can be collected`, holdsSpace(st))
}
/* Payable is a strict subset of holding a space, never the other way round. */
for (const st of ['awaiting_payment', 'payment_processing', 'confirmed', 'forfeited', 'cancelled']) {
  if (canStartPayment(st)) check(`${st} holds a space if it can be paid`, holdsSpace(st))
}

/* ── a maker who owes nothing is never released ── */

{
  const past = '2026-09-25T00:00:00.000Z'
  const due = '2026-09-24T06:59:00.000Z'

  check('an unpaid maker past their deadline is forfeitable',
    isForfeitable('awaiting_payment', due, past, null, 28000) === true)

  /* Three credits from previous shows and one free space the girls granted
     outright. Releasing a space because somebody failed to pay zero dollars
     is the worst thing this button could do, and it would have done it. */
  check('a maker on a full credit is not',
    isForfeitable('awaiting_payment', due, past, null, 0) === false)

  /* An old caller that does not pass the total must not silently start
     forfeiting the free spaces, and must not stop forfeiting everybody else. */
  check('an unknown total is judged on the deadline alone',
    isForfeitable('awaiting_payment', due, past, null) === true)
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('booking status: a transfer in flight holds its space and is never forfeited')
export {}
