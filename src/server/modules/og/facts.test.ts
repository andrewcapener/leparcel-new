import { cityOf, datesNoYear, datesShort, venueLine } from './facts'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* The real one, as it is stored today. */
check('the town comes out of the venue address',
  cityOf('24642 San Juan Avenue, Dana Point, CA 92629') === 'Dana Point')
check('and survives loose spacing',
  cityOf('  24642 San Juan Avenue ,Dana Point , CA 92629 ') === 'Dana Point')
check('a two field address names no town',
  cityOf('Dana Point, CA') === undefined)
/* Rather than confidently printing "Suite 2" as the town. */
check('a suite line is refused rather than guessed at',
  cityOf('24642 San Juan Avenue, Suite 2, Dana Point, CA 92629') === undefined)
check('empty and missing name no town',
  cityOf('') === undefined && cityOf(null) === undefined && cityOf(undefined) === undefined)

check('the dates carry no year',
  datesNoYear('2026-11-13T12:00:00-08:00', '2026-11-15T12:00:00-08:00') === 'November 13-15')
check('a one day show says the day once',
  datesNoYear('2026-11-13T12:00:00-08:00', '2026-11-13T20:00:00-08:00') === 'November 13')
/* Rule 8: stored UTC, rendered Pacific. 08:00Z on the 14th is still the 13th
   in Dana Point, and a card that says the 14th sends people a day late. */
check('the day is the Pacific day, not the UTC one',
  datesNoYear('2026-11-14T06:00:00Z', '2026-11-16T06:00:00Z') === 'November 13-15')

check('the short month takes a stop',
  datesShort('2026-11-13T12:00:00-08:00', '2026-11-15T12:00:00-08:00') === 'Nov. 13-15')
/* The one month that is already its own abbreviation. "May." is wrong and is
   what a hand-written list of months always ends up printing. */
check('May keeps no stop',
  datesShort('2027-05-14T12:00:00-07:00', '2027-05-16T12:00:00-07:00') === 'May 14-16')
check('a one day show says the day once, short too',
  datesShort('2026-11-13T12:00:00-08:00', '2026-11-13T20:00:00-08:00') === 'Nov. 13')
check('the short dates are Pacific too',
  datesShort('2026-11-14T06:00:00Z', '2026-11-16T06:00:00Z') === 'Nov. 13-15')

check('the venue reads the way a person says it',
  venueLine('Community House', '24642 San Juan Avenue, Dana Point, CA 92629')
  === 'Dana Point Community House')
check('and stands alone when the address will not parse',
  venueLine('Community House', 'somewhere') === 'Community House')

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('og facts: the town comes off the address, and the day is the Pacific day')
