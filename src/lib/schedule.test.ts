import assert from 'node:assert/strict'
import { bookends, splitDay, tidyDayHours, tidyHoursNote } from './schedule'

/**
 * The hours note is typed by a person at /admin/show, and the one thing every
 * person does is write the meridiem once, at the end. These are the readings
 * the site prints from that.
 */

/* A bare opening time borrows the closing meridiem, unless borrowing makes the
   day impossible. This is the "9pm to 6pm" Drew caught on the live schedule. */
assert.deepEqual(bookends('9 - 6pm'), { opens: '9am', closes: '6pm' })
assert.deepEqual(bookends('9 to 6pm'), { opens: '9am', closes: '6pm' })
assert.deepEqual(bookends('5 - 9pm'), { opens: '5pm', closes: '9pm' })
assert.deepEqual(bookends('11 - 1pm'), { opens: '11am', closes: '1pm' })
assert.deepEqual(bookends('12 - 5pm'), { opens: '12pm', closes: '5pm' })
/* A phone turns a typed hyphen into an en dash, which is how the record got
   one in the first place. Both ends still have to come back. */
assert.deepEqual(bookends('10am – 5pm'), { opens: '10am', closes: '5pm' })

/* A row is only rewritten when both ends are real clock times. */
assert.equal(tidyDayHours('Friday 13 November, 9 to 6pm'), 'Friday 13 November, 9am to 6pm')
assert.equal(tidyDayHours('Saturday 14th, 9am to 5pm'), 'Saturday 14th, 9am to 5pm')
assert.equal(tidyDayHours('Sunday 15th, noon to 4pm'), 'Sunday 15th, noon to 4pm')
assert.equal(tidyDayHours('Friday, by appointment'), 'Friday, by appointment')
assert.equal(tidyDayHours('Thursday'), 'Thursday')
assert.equal(tidyDayHours(''), '')

/* The day is everything before the first comma, so a date that carries one
   survives the round trip. */
assert.equal(
  tidyDayHours('Friday, 13 November, 9 to 6pm'),
  'Friday, 13 November, 9am to 6pm',
)

/* Five pages split the note on " · ", so the separator is not to be touched,
   and running the tidy twice must change nothing the second time. */
const note = 'Friday 13 November, 9 to 6pm · Saturday 14th, 9am to 5pm · Sunday 15th, 9am to 5pm'
const once = tidyHoursNote(note)
assert.equal(
  once,
  'Friday 13 November, 9am to 6pm · Saturday 14th, 9am to 5pm · Sunday 15th, 9am to 5pm',
)
assert.equal(tidyHoursNote(once), once)
assert.equal(once.split(' · ').length, 3)

/* And the split the pages do still finds the same days. */
assert.equal(splitDay(once.split(' · ')[0]!).day, 'Friday 13 November')

console.log('schedule: a bare opening time reads as the hour a person meant')
