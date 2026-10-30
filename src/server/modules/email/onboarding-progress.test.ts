import { progressOf, pct, progressNotice, asked } from './onboarding-progress'
import type { InviteMaker } from './onboarding-invite'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const m = (over: Partial<InviteMaker> = {}): InviteMaker => ({
  bookingId: 'b', vendorCode: 'MM1', shopName: 'Shop', contactName: 'A',
  email: 'a@example.com', track: 'indoor', bookingStatus: 'confirmed',
  applicationStatus: 'accepted', payoutState: 'not_started',
  itemCount: 0, itemsSent: false, ...over,
})

/* Only the people actually being asked. Counting outdoor makers, who take
   their own money and are never asked, would flatter every number here. */
check('outdoor makers are not counted', asked([m({ track: 'outdoor' })]).length === 0)
check('an undecided application is not counted',
  asked([m({ applicationStatus: 'waitlist' })]).length === 0)
check('a released space is not counted',
  asked([m({ bookingStatus: 'cancelled' })]).length === 0)
check('a forfeited one is not either',
  asked([m({ bookingStatus: 'forfeited' })]).length === 0)
check('an accepted indoor maker is', asked([m()]).length === 1)

/* Typed is not sent. The maker's own checklist draws that line and so does
   the invite; the number on the wall has to draw it too, or it reports work
   as finished that nobody has told us about. */
const half = progressOf([
  m({ bookingId: '1', itemsSent: true, itemCount: 4, payoutState: 'ready' }),
  m({ bookingId: '2', itemsSent: true, itemCount: 2 }),
  m({ bookingId: '3', itemCount: 9 }),
  m({ bookingId: '4', payoutState: 'ready' }),
])
check('four are being asked', half.total === 4)
check('two have their inventory in', half.itemsDone === 2)
check('a list typed and never sent does not count', half.itemsDone === 2)
check('two have payouts ready', half.payoutsDone === 2)
check('one has done both', half.bothDone === 1)
check('and it does not read as waiting', !half.waiting)

/* An account Stripe has not finished with is not ready, whatever stage it
   reached: that is Stripe's verdict and nothing stands in for it. */
for (const s of ['unfinished', 'in_review', 'disabled', 'not_started'] as const) {
  check(`a ${s} account is not counted as ready`,
    progressOf([m({ payoutState: s })]).payoutsDone === 0)
}

const none = progressOf([m(), m()])
check('nobody yet reads as waiting', none.waiting)
check('and says so plainly',
  progressNotice(none) === 'Nobody has finished either one yet. The first will show here.')
check('an empty room says something else',
  progressNotice(progressOf([])) === 'Nobody is being asked for either of these yet.')

const all = progressOf([m({ itemsSent: true, itemCount: 1, payoutState: 'ready' })])
check('everybody done is worth saying', progressNotice(all) === 'Everybody is done. Nothing left to chase.')
check('otherwise it counts both', progressNotice(half) === '1 of 4 have done both.')

/* A percentage a person would say. */
check('none is none', pct(0, 39) === 0)
check('all is all', pct(39, 39) === 100)
/* The two that matter: one maker out of thirty nine is not nothing, and
   thirty eight out of thirty nine is not everybody. */
check('one of many is never rounded away to zero', pct(1, 39) === 3)
check('nearly all is never rounded up to everybody', pct(38, 39) === 97)
check('and a true 99 stays 99', pct(99, 100) === 99)
check('an empty room is zero, not a division by nothing', pct(0, 0) === 0)

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('onboarding progress: only the people being asked are counted, and typed is not sent')
