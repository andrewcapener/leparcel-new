import { listState, multiBuyWords } from './inventory-export'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/**
 * The printed inventory.
 *
 * What these two functions decide is what somebody reads off paper at a
 * counter with a shopper waiting, and what somebody else reads when deciding
 * who to ring on the Tuesday before the show. Both are worth a test: a price
 * that prints wrong is money, and a maker counted as finished when she is not
 * is a phone call nobody makes.
 */

const DOT = String.fromCharCode(0xb7)

check('no multi-buys prints nothing at all', multiBuyWords([]) === '')
check('one reads as a person would say it',
  multiBuyWords([{ qty: 2, cents: 1500 }]) === '2 for $15.00')
check('several are listed fewest first, whatever order they arrive in',
  multiBuyWords([{ qty: 3, cents: 2000 }, { qty: 2, cents: 1500 }])
    === `2 for $15.00 ${DOT} 3 for $20.00`)
/* Cents, never a float: $7.05 must not print as $7.5 or $7.050000001. */
check('cents under ten keep their nought',
  multiBuyWords([{ qty: 2, cents: 705 }]) === '2 for $7.05')
check('a round number still prints two places',
  multiBuyWords([{ qty: 2, cents: 700 }]) === '2 for $7.00')
check('and a big one does not lose a digit',
  multiBuyWords([{ qty: 2, cents: 129600 }]) === '2 for $1296.00')

/* Three states, not two. A maker with eleven lines who has not pressed the
   button needs a reminder; a maker with none needs a phone call. Collapsing
   them loses the difference between the two jobs. */
check('nothing filed says so', listState(0, null) === 'Nothing yet')
check('lines but no submit reads as started', listState(11, null) === 'Started')
check('submitted reads as filed', listState(11, '2026-11-01T00:00:00.000Z') === 'Filed')
/* Submitted and then emptied is still filed: she told us, and the register
   has what she told us. The count is on the same row to say the rest. */
check('submitted with nothing left is still filed',
  listState(0, '2026-11-01T00:00:00.000Z') === 'Filed')

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('inventory export: a price never loses a digit, and nobody reads as finished who is not')
