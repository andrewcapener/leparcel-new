import { paymentDueAt, usingFixedDate } from './deadline'

/**
 * The deadline everybody is held to. Wrong in one direction it releases a
 * maker's space early; wrong in the other it quietly extends a show's cashflow
 * by days. Both are worth a test.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const FIXED = '2026-09-24T06:59:00.000Z'          // 23 Sept, 11:59pm Pacific
const MON = '2026-09-22T02:00:00.000Z'            // accepted the night before

/* The whole point: accepting early must not shorten anybody's deadline. */
check('a fixed date is used when it is further out',
  paymentDueAt({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: MON }) === FIXED)
check('and everybody accepted that night gets the same one',
  paymentDueAt({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: '2026-09-22T02:00:00.000Z' })
  === paymentDueAt({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: '2026-09-22T05:30:00.000Z' }))
check('the fixed date is what is doing the work',
  usingFixedDate({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: MON }))

/* The floor. A maker accepted off the waitlist the day before the fixed date
   must not inherit a deadline that has nearly gone. */
const LATE = '2026-09-24T00:00:00.000Z'           // seven hours before the fixed date
const due = paymentDueAt({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: LATE })
check('a late acceptance gets the full window instead', due === '2026-09-26T00:00:00.000Z')
check('which is later than the fixed date', Date.parse(due) > Date.parse(FIXED))
check('and the fixed date is no longer what decides it',
  !usingFixedDate({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: LATE }))
check('nobody ever gets less than the window',
  Date.parse(paymentDueAt({ fixedAt: FIXED, windowHours: 48, acceptedAtIso: LATE }))
  - Date.parse(LATE) >= 48 * 3600_000)

/* No fixed date is the old behaviour, unchanged. */
check('no fixed date rolls from acceptance',
  paymentDueAt({ fixedAt: null, windowHours: 48, acceptedAtIso: MON }) === '2026-09-24T02:00:00.000Z')
check('an empty string is not a date',
  paymentDueAt({ fixedAt: '', windowHours: 48, acceptedAtIso: MON }) === '2026-09-24T02:00:00.000Z')
/* A bad value in one column must never stop somebody being accepted. */
check('junk falls back to the window rather than throwing',
  paymentDueAt({ fixedAt: 'next tuesday', windowHours: 48, acceptedAtIso: MON })
  === '2026-09-24T02:00:00.000Z')

/* The window itself is read from a column too, so it can be wrong. */
check('a zero window falls back to 48 hours',
  paymentDueAt({ fixedAt: null, windowHours: 0, acceptedAtIso: MON }) === '2026-09-24T02:00:00.000Z')
check('a negative window does too',
  paymentDueAt({ fixedAt: null, windowHours: -5, acceptedAtIso: MON }) === '2026-09-24T02:00:00.000Z')
check('a longer window is honoured',
  paymentDueAt({ fixedAt: null, windowHours: 96, acceptedAtIso: MON }) === '2026-09-26T02:00:00.000Z')
/* An unreadable acceptance time must still produce a real date. */
check('an unreadable acceptance time still yields a date',
  Number.isFinite(Date.parse(paymentDueAt({ fixedAt: null, windowHours: 48, acceptedAtIso: 'nope' }))))

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('payment deadline: one date for everybody, and never less than the window')
export {}
