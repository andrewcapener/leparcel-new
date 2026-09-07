/**
 * "Days left" has to agree with the window we published.
 *
 * Applications open 7 September and close 21 September at 11:59pm PT, which
 * Elise called fourteen days and which the FAQ now says. A duration in
 * milliseconds divided by 86400000 rounds that to FIFTEEN on opening morning,
 * so the homepage would have contradicted the FAQ on day one.
 *
 * The fix is to count calendar dates in Pacific rather than elapsed time, and
 * this pins it, because every date bug in this codebase so far has been a
 * timezone one.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { daysUntil } from './dates'

const CLOSE = '2026-09-21T23:59:00-07:00'
let failures = 0
const check = (what: string, got: number, want: number) => {
  if (got !== want) { failures++; console.error(`  FAIL ${what}: got ${got}, want ${want}`) }
}

// Opening morning, 9am PT. Fourteen dates from the 7th to the 21st.
check('opening morning', daysUntil(CLOSE, new Date('2026-09-07T16:00:00Z')), 14)
// Late the same evening, still the 7th in Pacific, so still fourteen. This is
// the case the millisecond version got wrong in the other direction.
check('the same evening', daysUntil(CLOSE, new Date('2026-09-08T04:00:00Z')), 14)
// The day before.
check('the 20th', daysUntil(CLOSE, new Date('2026-09-20T19:00:00Z')), 1)
// The closing day itself is zero, never "1 day left" and never "0 days left"
// on screen: the caller says "last day".
check('the closing day', daysUntil(CLOSE, new Date('2026-09-21T18:00:00Z')), 0)
// One minute after midnight Pacific on the closing day is still the last day.
check('after midnight on the last day', daysUntil(CLOSE, new Date('2026-09-21T07:01:00Z')), 0)
// Past.
check('the day after', daysUntil(CLOSE, new Date('2026-09-22T18:00:00Z')), -1)

/* A UTC day boundary that is NOT a Pacific one: 2am UTC on the 8th is still
   7pm on the 7th in Dana Point. Counting in UTC would lose a day here. */
check('7pm Pacific is not tomorrow', daysUntil(CLOSE, new Date('2026-09-08T02:00:00Z')), 14)

if (failures) { console.error(`days until: ${failures} failure(s)`); process.exit(1) }
console.log('days until: counted as Pacific calendar dates, not elapsed milliseconds')
