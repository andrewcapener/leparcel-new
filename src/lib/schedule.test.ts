import assert from 'node:assert/strict'
import { bookends, extras, extrasFor, hasExtras, splitDay, TBA, tidyDayHours, tidyHoursNote } from './schedule'

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

/* ---------------------------------------------------------------------------
   The lineup itself. This is typed off Hillary's plan once a season and read
   by a page a few thousand people see in the same week, so the shape is
   checked here rather than in a browser the day before the show. */

/* One entry a day, and the slug is what the page looks a day up by. */
assert.deepEqual(extras.map((d) => d.slug), ['Friday', 'Saturday', 'Sunday'])
assert.equal(new Set(extras.map((d) => d.slug)).size, extras.length)
for (const row of 'Friday 13 November · Saturday 14 November · Sunday 15 November'.split(' · ')) {
  assert.ok(extrasFor(splitDay(row).day), `no extras for ${row}`)
}
/* A day nobody has booked anything for prints no block, rather than a block
   of empty rows. */
assert.equal(hasExtras(undefined), false)
assert.equal(hasExtras({ slug: 'Monday', food: [], allDay: [], music: [] }), false)
assert.equal(hasExtras(extrasFor('Friday 13 November')), true)

for (const day of extras) {
  /* Nothing blank: a blank name renders as a stray separator on the page,
     which reads as a thing that is on and has no name. */
  for (const thing of [...day.food, ...day.allDay]) {
    assert.equal(thing.name, thing.name.trim())
    assert.ok(thing.name.length > 0, `${day.slug} has a nameless entry`)
    /* A link that is not a link is a dead button on a public page, and a
       link to somewhere that is not Instagram is not what any of these are. */
    if (thing.href !== undefined) {
      const u = new URL(thing.href)
      assert.equal(u.protocol, 'https:', `${thing.name} is not https`)
      assert.equal(u.host, 'www.instagram.com', `${thing.name} points at ${u.host}`)
    }
  }
  /* Coffee opens the food list on every day. Elise: "Start with coffee. Cuz
     its a morning thing." The order was Hillary's seating chart, which is not
     a sequence, so the day used to open with lunch. */
  assert.ok(day.food[0]?.name.includes('Coffee'), `${day.slug} does not open on coffee`)
  /* The one link Elise asked for by name. */
  const ohd = day.allDay.find((a) => a.name.startsWith('Oh Happy Day'))
  assert.ok(ohd?.href, `${day.slug} has Oh Happy Day with no link`)
  /* A set time without a performer, or a performer without a time, is the
     one way this page can lie to somebody who drove down for it. */
  for (const slot of day.music) {
    assert.ok(slot.time.trim().length > 0, `${day.slug} has a set with no time`)
    assert.ok(slot.what.trim().length > 0, `${day.slug} has a time with no performer`)
    /* "to", never a dash: src/lib/dashes.test.ts bans the long ones outright
       and a hyphen between two clock times reads as a subtraction. */
    assert.ok(!/\d\s*-\s*\d/.test(slot.time), `${day.slug} ${slot.time} needs "to"`)
  }
  /* Two performers cannot hold the same slot. Back-to-back sets by the same
     name are fine and Sunday has two. */
  const times = day.music.map((m) => m.time)
  assert.equal(new Set(times).size, times.length, `${day.slug} double-books a slot`)
}

/* The music starts when the doors do, and an hour nobody is booked for says
   TBA rather than going missing, which read as the music starting at
   lunchtime.

   Saturday and Sunday open at nine. Friday does not: the outdoor makers
   build their tents through the morning, so the doors wait until noon and
   the three TBA slots that used to sit before them were dropped. A page
   headed "Open noon to 6pm" above "live music 9 to 10am" reads as a bug. */
for (const day of [extrasFor('Saturday 14 November')!, extrasFor('Sunday 15 November')!]) {
  assert.equal(day.music[0]?.time, '9 to 10am', `${day.slug} has no nine o'clock`)
}

const friday = extrasFor('Friday 13 November')!
assert.ok(friday.music.length > 0, 'Friday lost all of its music')
/* Nothing before the doors. Every Friday slot is an afternoon one, so none
   of them may carry an am. */
assert.ok(
  friday.music.every((m) => !/\dam\b/.test(m.time)),
  'Friday has music before its noon opening',
)
assert.ok(extrasFor('Saturday 14 November')!.music.some((m) => m.what === TBA))
assert.ok(extrasFor('Sunday 15 November')!.music.every((m) => m.what !== TBA))

console.log('schedule: a bare opening time reads as the hour a person meant')
