import { intakeMode, intakeAccepts, intakeStatus, intakeWords } from './intake'

/**
 * Which of three things the form is doing, and what a submission becomes.
 * Getting this wrong either loses an application or files one in the jury's
 * queue for a show whose roster is already set.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

check('an open window takes applications', intakeMode('open') === 'open')
check('a closed window takes waitlist entries', intakeMode('closed') === 'waitlist')
/* Before a window opens there is nothing to apply to: no dates, no prices and
   no spaces on the next show. A form there collects answers to unset
   questions. */
check('before the window there is nothing to apply to', intakeMode('before') === 'shut')

/* A staff rehearsal submits a REAL application whatever the window says, or
   it stops rehearsing the thing it exists to test. */
check('a rehearsal before launch is a real application', intakeMode('before', true) === 'open')
check('and so is one after close', intakeMode('closed', true) === 'open')
check('a rehearsal never lands on the waitlist', intakeMode('closed', true) !== 'waitlist')

check('open accepts', intakeAccepts('open'))
check('waitlist accepts', intakeAccepts('waitlist'))
check('shut is the only one that refuses', !intakeAccepts('shut'))

check('an application is new', intakeStatus('open') === 'new')
/* Not 'new': the review queue's undecided badge is the jury's workload for a
   show whose roster is already set, and a maker who applied the morning after
   close is not part of it. */
check('a waitlist entry is waitlist', intakeStatus('waitlist') === 'waitlist')
check('and never new', intakeStatus('waitlist') !== 'new')

check('the waitlist says what it is', intakeWords('waitlist').submit === 'Join the waitlist')
check('the form says what it is', intakeWords('open').submit === 'Submit application')
check('the two never share a button', intakeWords('open').submit !== intakeWords('waitlist').submit)
/* docs/12-VOICE: no exclamation marks in this copy. Dashes are not checked
   here on purpose: src/lib/dashes.test.ts scans every file in src/, which
   includes intake.ts AND this one, so a dash written here to test for a dash
   fails that guard on its own test. One guard, in one place. */
for (const [k, v] of Object.entries(intakeWords('waitlist'))) {
  check(`waitlist ${k} is not shouting`, !v.includes('!'))
}

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('intake: a closed window still collects, and never as the jury’s problem')
export {}
