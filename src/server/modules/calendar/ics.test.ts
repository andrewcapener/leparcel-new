import assert from 'node:assert/strict'
import { dayAfter, escapeText, fold, googleCalendarUrl, icsForShow, ymd } from './ics'

/**
 * The file nobody looks at. A calendar that will not take it says nothing,
 * it just does not appear, which is exactly how this went unnoticed until a
 * week before the show.
 */

const show = {
  slug: 'fall-2026',
  name: 'Fall 2026',
  startsOn: '2026-11-13T12:00:00-08:00',
  endsOn: '2026-11-15T12:00:00-08:00',
  venueAddress: '24642 San Juan Avenue, Dana Point, CA 92629',
  hoursNote: 'Friday 13 November, 9am to 6pm · Saturday 14 November, 9am to 5pm',
}

/* The dates are the stored days, and DTEND is the day after the last one
   because an all-day end is exclusive. A show that ended on its own last day
   would land in a calendar as two days of a three-day market. */
assert.equal(ymd(show.startsOn), '20261113')
assert.equal(dayAfter(show.endsOn), '20261116')
/* Across a month and a year boundary, and across the end of February. */
assert.equal(dayAfter('2026-11-30T12:00:00-08:00'), '20261201')
assert.equal(dayAfter('2026-12-31T12:00:00-08:00'), '20270101')
assert.equal(dayAfter('2028-02-28T12:00:00-08:00'), '20280229')

/* The backslash is escaped first, or it escapes the escapes that follow. */
assert.equal(escapeText('a, b; c'), 'a\\, b\; c')
assert.equal(escapeText('back\\slash'), 'back\\\\slash')
assert.equal(escapeText('one\ntwo'), 'one\\ntwo')
assert.equal(escapeText('C:\\x, y'), 'C:\\\\x\\, y')

/* Folding is measured in octets and never cuts a character in half. */
assert.equal(fold('short'), 'short')
const long = 'DESCRIPTION:' + 'x'.repeat(200)
for (const part of fold(long).split('\r\n')) {
  assert.ok(Buffer.byteLength(part, 'utf8') <= 75, `line of ${part.length}`)
}
assert.equal(fold(long).split('\r\n').slice(1).every((l) => l.startsWith(' ')), true)
/* Unfolding is the inverse: strip the CRLF and the one leading space. */
assert.equal(fold(long).split('\r\n ').join(''), long)
const dots = 'SUMMARY:' + '·'.repeat(60)
for (const part of fold(dots).split('\r\n')) {
  assert.ok(Buffer.byteLength(part, 'utf8') <= 75)
  assert.ok(!part.includes('\uFFFD'))
}
assert.equal(fold(dots).split('\r\n ').join(''), dots)

const ics = icsForShow(show, new Date('2026-11-06T22:00:00Z'))

/* Every line within the limit, CRLF throughout, and a trailing break. */
for (const line of ics.split('\r\n')) {
  assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `too long: ${line}`)
}
assert.ok(!ics.includes('\n\n'))
assert.ok(ics.split('\n').every((l) => l === '' || l.endsWith('\r')))
assert.ok(ics.endsWith('\r\n'))

/* The parts a calendar reads. */
const flat = ics.split('\r\n ').join('')
assert.ok(flat.includes('BEGIN:VCALENDAR'))
assert.ok(flat.includes('METHOD:PUBLISH'))
assert.ok(flat.includes('DTSTART;VALUE=DATE:20261113'))
assert.ok(flat.includes('DTEND;VALUE=DATE:20261116'))
assert.ok(flat.includes('DTSTAMP:20261106T220000Z'))
assert.ok(flat.includes('UID:fall-2026@mermademarket.com'))
assert.ok(flat.endsWith('END:VCALENDAR\r\n'))
/* The address's commas are escaped and its text survives. */
assert.ok(flat.includes('LOCATION:24642 San Juan Avenue\\, Dana Point\\, CA 92629'))

/* A show whose name carries the characters that used to end a line early. */
const awkward = icsForShow({ ...show, name: 'Spring 2027; the one, with a \\ in it' })
const awkwardFlat = awkward.split('\r\n ').join('')
assert.ok(awkwardFlat.includes('Spring 2027\; the one\\, with a \\\\ in it'))

/* The Google link carries the same event, so the two buttons cannot disagree
   about when the show is. */
const url = new URL(googleCalendarUrl(show))
assert.equal(url.host, 'calendar.google.com')
assert.equal(url.searchParams.get('dates'), '20261113/20261116')
assert.equal(url.searchParams.get('action'), 'TEMPLATE')
assert.ok(url.searchParams.get('text')!.includes('Fall 2026'))
assert.equal(url.searchParams.get('location'), show.venueAddress)

console.log('calendar: every line folds inside 75 octets, and nothing a venue is called ends one early')
