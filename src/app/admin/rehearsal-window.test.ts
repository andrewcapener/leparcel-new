/**
 * "Before the window opened" has to mean before the window opened.
 *
 * The purge on the dashboard decides what is a rehearsal by comparing an
 * application's submitted_at against the show's applications_open_at. Both are
 * text columns and they hold DIFFERENT SHAPES: Postgres writes
 * "2026-09-07 17:12:00.123+00" and the Show record carries ISO
 * "2026-09-07T09:00:00-07:00". A space sorts before a T, so compared as text
 * every application submitted today looked EARLIER than this morning's
 * opening, and a button whose whole promise is "this cannot touch a real
 * application" would have deleted the lot.
 *
 * This pins the property in JavaScript rather than in SQL, because the point
 * is the comparison, and a test that needs a database is a test nobody runs
 * before pressing the button.
 */

export {}   // a module, so its locals do not collide with the other test scripts

const OPEN = '2026-09-07T09:00:00-07:00'   // 16:00 UTC

/** What the query used to do. */
const asText = (submitted: string, open: string) => submitted < open
/** What it does now. */
const asTime = (submitted: string, open: string) =>
  new Date(submitted).getTime() < new Date(open).getTime()

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

// A real application, submitted an hour after the window opened.
const real = '2026-09-07 17:12:00.123+00'
check('the old text comparison called a real application a rehearsal', asText(real, OPEN))
check('the timestamp comparison does not', !asTime(real, OPEN))

// A real application submitted in the same minute the window opened.
check('nor one submitted at the opening minute',
  !asTime('2026-09-07 16:00:30.000+00', OPEN))

// The seed and the team's rehearsals, from the days before.
check('yesterday evening is a rehearsal', asTime('2026-09-06 20:41:43.991+00', OPEN))
check('two days before is a rehearsal', asTime('2026-09-05 18:48:35.478+00', OPEN))

// The boundary itself: a submission one second before opening.
check('one second before opening is a rehearsal',
  asTime('2026-09-07 15:59:59.000+00', OPEN))
check('one second after is not',
  !asTime('2026-09-07 16:00:01.000+00', OPEN))

// Late in the window, which is where a text comparison stays wrong all season.
check('an application on the last day is never a rehearsal',
  !asTime('2026-09-21 22:30:00.000+00', OPEN))

if (failures) { console.error(`rehearsal window: ${failures} failure(s)`); process.exit(1) }
console.log('rehearsal window: only what was submitted before the window opened')
