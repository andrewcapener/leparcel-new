import { isPaid, holdsSpace, needsChasing, isForfeitable } from './booking-status'

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

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('booking status: a transfer in flight holds its space and is never forfeited')
export {}
