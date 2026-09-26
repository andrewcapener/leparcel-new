import { grantProblem, priceFromDollars, spaceNotice } from './spaces'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const ok = {
  holdsSpace: true, bookingTrack: 'outdoor', spaceTrack: 'outdoor',
  alreadyHas: false, priceCents: null as number | null | 'bad',
}

/* JC Beans and Alohana: outdoor every day, granted at no charge. */
check('an outdoor day can be granted at no charge',
  grantProblem(ok) === undefined)
check('and with a price',
  grantProblem({ ...ok, priceCents: 40000 }) === undefined)
check('the same space twice is refused',
  grantProblem({ ...ok, alreadyHas: true }) === 'already')
check('an indoor booking cannot take an outdoor day',
  grantProblem({ ...ok, bookingTrack: 'indoor' }) === 'wrong_track')
check('a released booking has nothing to add to',
  grantProblem({ ...ok, holdsSpace: false }) === 'released')
check('a missing space refuses',
  grantProblem({ ...ok, spaceTrack: undefined }) === 'missing')
check('a bad price refuses before anything is written',
  grantProblem({ ...ok, priceCents: 'bad' }) === 'bad_price')

/* Rule 1: integer cents, never a float. 4.10 * 100 is 409.99999999999994. */
check('dollars become exact cents',
  priceFromDollars('4.10') === 410 && priceFromDollars('400') === 40000
  && priceFromDollars('0.01') === 1 && priceFromDollars('1.005' ) === 'bad')
check('a dollar sign and commas are fine',
  priceFromDollars('$1,250.50') === 125050)
check('empty means no charge, not zero typed',
  priceFromDollars('') === null && priceFromDollars('   ') === null)
check('zero typed is zero, and is not the same as empty',
  priceFromDollars('0') === 0)
check('a credit is allowed', priceFromDollars('-50') === -5000)
check('nonsense is refused',
  ['abc', '1e4', '4.', '.5.5', '--5'].every((t) => priceFromDollars(t) === 'bad'))
check('an absurd figure is refused rather than written',
  priceFromDollars('1000000') === 'bad')

/* The sentence that stops a maker never being refunded. */
check('removing a space never implies a refund happened',
  (spaceNotice('removed') ?? '').includes('does not refund'))
check('adding free says nothing went on the invoice',
  (spaceNotice('free') ?? '').includes('Nothing was added to their invoice'))
check('every notice is dash free and unexcited',
  ['granted', 'free', 'removed', 'already', 'wrong_track', 'released', 'bad_price',
    'last_one', 'missing'].every((c) => {
    const t = spaceNotice(c) ?? ''
    return t.length > 0 && !t.includes('!')
      && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))
  }))
check('an unknown code says nothing', spaceNotice('nope') === null)

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('booking spaces: a day can be granted free or priced, and cents never come from a float')
