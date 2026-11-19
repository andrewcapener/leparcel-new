import type { InferSelectModel } from 'drizzle-orm'
import type { shows, spaceTypes, addOns } from '@/db/schema'
import {
  addDays, clonedAddOns, clonedSpaceTypes, daysBetween, nextNumeral, nextShowRow,
  showSlug, suggestNextShow, type NextShowInput,
} from './clone'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

type Show = InferSelectModel<typeof shows>

/* Fall 2026 as it stands the week the statements went out. */
const fall = {
  id: 'show_fall26', slug: 'fall-2026', numeral: 'XXII', name: 'Fall 2026',
  season: 'fall', year: 2026,
  venueName: 'Community House', venueAddress: '24642 San Juan Ave, Dana Point, CA',
  startsOn: '2026-11-13', endsOn: '2026-11-15',
  hoursNote: 'Friday noon to 7pm', loadInNote: 'Thursday evening, in slots',
  outdoorLoadInNote: 'The morning of your day', loadInSlots: '1-3pm, 3-5pm, 5-7pm',
  takedownNote: 'Sunday after 4pm',
  applicationsOpenAt: '2026-09-07T09:00:00-07:00',
  applicationsCloseAt: '2026-09-18T23:59:00-07:00',
  rosterAnnouncedOn: '2026-09-25',
  decisionsFromOn: '2026-09-21', decisionsToOn: '2026-09-24',
  commissionBps: 2000,
  paymentDueAt: '2026-09-30T23:59:00-07:00', paymentWindowHours: 48,
  paymentMethods: 'card_and_bank',
  decisionEmails: 'on', paymentEmail: 'on', payoutSetup: 'on',
  paymentSheetId: 'sheet_fall_2026',
  venmoHandle: '@mermade', zelleContact: 'pay@mermademarket.com', zelleName: 'Mermade',
  onboardingSlotsIndoor: '', onboardingSlotsOutdoor: '',
  inventoryDueAt: '2026-11-01T23:59:00-07:00',
  indoorCapacity: 80, outdoorCapacity: 30,
  isActive: true, createdAt: new Date('2026-01-02T00:00:00Z'),
} as unknown as Show

const input: NextShowInput = {
  id: 'show_spring27', slug: 'spring-2027', name: 'Spring 2027',
  season: 'spring', year: 2027, numeral: 'XXIII',
  startsOn: '2027-04-23', endsOn: '2027-04-25',
  applicationsOpenAt: '2027-02-15T09:00:00-08:00',
  applicationsCloseAt: '2027-02-26T23:59:00-08:00',
  rosterAnnouncedOn: '2027-03-05',
}

const next = nextShowRow(fall, input)

/* ── what the caller asked for ─────────────────────────────────────────── */

check('the dates are the new ones', next.startsOn === '2027-04-23' && next.endsOn === '2027-04-25')
check('the window is the new one', next.applicationsOpenAt === '2027-02-15T09:00:00-08:00')
check('its own id', next.id === 'show_spring27')
check('its own slug', next.slug === 'spring-2027')

/* ── what carries forward, because it is about the market ──────────────── */

check('the venue carries', next.venueName === 'Community House')
check('the address carries', next.venueAddress === fall.venueAddress)
check('the load-in prose carries', next.loadInNote === 'Thursday evening, in slots')
check('the outdoor load-in carries', next.outdoorLoadInNote === fall.outdoorLoadInNote)
check('the slots carry', next.loadInSlots === '1-3pm, 3-5pm, 5-7pm')
/* The one that would cost real money to retype wrong. */
check('the commission carries', next.commissionBps === 2000)
check('the capacities carry', next.indoorCapacity === 80 && next.outdoorCapacity === 30)
check('the payment window carries', next.paymentWindowHours === 48)
check('the payment methods carry', next.paymentMethods === 'card_and_bank')

/* ── what resets, because it was a fact about the show that happened ───── */

/* A deadline from last September would mark every new acceptance overdue the
   moment it was made. */
check('the payment deadline is cleared', next.paymentDueAt === null)
check('last show’s payment sheet is dropped', next.paymentSheetId === null)
check('the inventory deadline is cleared', next.inventoryDueAt === null)
/* Null here is what makes the thank-you screen promise nothing, which is
   right for a jury that is not scheduled. */
check('the decision dates are cleared', next.decisionsFromOn === null && next.decisionsToOn === null)

/* The three that mail people. A new show starts silent. */
check('decision emails start off', next.decisionEmails === 'off')
check('payment emails start off', next.paymentEmail === 'off')
check('payout setup starts off', next.payoutSetup === 'off')

/* The one that would have pulled the public site off Fall while its
   statements were still being reconciled. */
check('planning the next show does not activate it', next.isActive === false)

/* And the row it was cloned from is untouched. */
check('the old show is not mutated', fall.isActive === true && fall.slug === 'fall-2026')
check('the old show keeps its dates', fall.startsOn === '2026-11-13')

/* ── numerals ──────────────────────────────────────────────────────────── */

check('XXII then XXIII', nextNumeral('XXII') === 'XXIII')
check('XXIII then XXIV', nextNumeral('XXIII') === 'XXIV')
check('IX then X', nextNumeral('IX') === 'X')
check('lower case still reads', nextNumeral('xxii') === 'XXIII')
check('nonsense gives nothing rather than a guess', nextNumeral('Q4') === '')
check('empty gives nothing', nextNumeral('') === '')

/* ── slugs ─────────────────────────────────────────────────────────────── */

check('slug', showSlug('spring', 2027) === 'spring-2027')
check('slug is lower case', showSlug('Spring', 2027) === 'spring-2027')

/* ── the rows that hang off a show ─────────────────────────────────────── */

let n = 0
const id = () => `new_${++n}`

const types = [
  { id: 'st_1', showId: 'show_fall26', track: 'indoor', code: 'SHELF', label: 'Shelf',
    dimensions: '', description: '', priceCents: 22500, capacity: 40, sortOrder: 1, isActive: true },
  { id: 'st_2', showId: 'show_fall26', track: 'outdoor', code: 'TENT', label: 'Tent day',
    dimensions: '', description: '', priceCents: 15000, capacity: 30, sortOrder: 2, isActive: true },
  /* Retired last show, so it should not come back. */
  { id: 'st_3', showId: 'show_fall26', track: 'indoor', code: 'OLD', label: 'Retired',
    dimensions: '', description: '', priceCents: 9900, capacity: 5, sortOrder: 3, isActive: false },
] as unknown as Array<InferSelectModel<typeof spaceTypes>>

const copied = clonedSpaceTypes(types, 'show_spring27', id)
check('only the live space types come across', copied.length === 2)
check('they point at the new show', copied.every((s) => s.showId === 'show_spring27'))
check('they get fresh ids', copied.every((s) => s.id.startsWith('new_')))
check('no id is reused from the old show', copied.every((s) => !['st_1', 'st_2'].includes(s.id)))
check('the ids are distinct', new Set(copied.map((s) => s.id)).size === 2)
/* A price that came back wrong would misprice every application for a season. */
check('the prices survive exactly', copied[0].priceCents === 22500 && copied[1].priceCents === 15000)
check('the codes survive', copied.map((s) => s.code).join() === 'SHELF,TENT')
check('the old rows are not mutated', types[0].showId === 'show_fall26' && types[0].id === 'st_1')

const addons = [
  { id: 'ao_1', showId: 'show_fall26', track: 'indoor', code: 'ENDCAP', name: 'Endcap',
    description: '', priceCents: 4000, maxQty: 1, isLimited: true, capacity: 6, isActive: true },
] as unknown as Array<InferSelectModel<typeof addOns>>

const ao = clonedAddOns(addons, 'show_spring27', id)
check('add-ons come across', ao.length === 1)
check('the add-on points at the new show', ao[0].showId === 'show_spring27')
check('the add-on price survives', ao[0].priceCents === 4000)
check('the add-on gets a fresh id', ao[0].id !== 'ao_1')


/* ── what the form opens prefilled with ────────────────────────────────── */

/* Fall 2026 as the Show record actually holds it: every date is a Pacific
   wall-clock stamp, not a bare date, because a show starts at its first
   public hour and a window shuts at a minute to midnight. */
const wall = (iso: string) => iso.slice(0, 16)
const sug = suggestNextShow({
  season: 'fall', year: 2026,
  startsOn: '2026-11-13T12:00', endsOn: '2026-11-15T16:00',
  applicationsOpenAt: '2026-09-07T09:00',
  applicationsCloseAt: '2026-09-18T23:59',
  rosterAnnouncedOn: '2026-09-25T09:00',
}, wall)

/* The dates Drew gave for Spring, reached from Fall's own rhythm rather than
   typed in here: 23 weeks on, same Friday-to-Sunday shape. */
check('spring follows fall', sug.season === 'spring')
check('and takes the next year', sug.year === 2027)
check('doors land on 23 April', sug.startsOn.startsWith('2027-04-23'))
check('and close on the 25th', sug.endsOn.startsWith('2027-04-25'))
check('still a Friday', new Date(`${sug.startsOn.slice(0, 10)}T00:00:00Z`).getUTCDay() === 5)
check('still three days', daysBetween(sug.startsOn, sug.endsOn) === 2)

/* The bug this file caught: a bare-date helper fed a wall-clock stamp
   returned its own input, so every suggestion came back as last season. */
check('the shift actually happened', sug.startsOn.slice(0, 10) !== '2026-11-13')

/* Each field keeps the hour it had, so noon stays noon and a deadline stays
   a minute to midnight. */
check('doors still open at noon', sug.startsOn.endsWith('T12:00'))
check('and the last day still ends at four', sug.endsOn.endsWith('T16:00'))
check('the window still opens at 9am', sug.applicationsOpenAt.endsWith('T09:00'))
check('and still closes at 23:59', sug.applicationsCloseAt.endsWith('T23:59'))

/* Drew: "we will wait until February to open them." Keeping Fall's 67 day
   lead puts it there without anybody choosing a date. */
check('applications open in February', sug.applicationsOpenAt.startsWith('2027-02-15'))
check('the window is still 11 days',
  daysBetween(sug.applicationsOpenAt, sug.applicationsCloseAt) === 11)
check('the lead to doors is unchanged',
  daysBetween(sug.applicationsOpenAt, sug.startsOn) === 67)
check('the roster still goes up a week after close',
  daysBetween(sug.applicationsCloseAt, sug.rosterAnnouncedOn) === 7)

/* Every field is in the shape a datetime-local input and laWallToIso want.
   A bare date here would be written into a column nothing else can read. */
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
for (const [k, v] of Object.entries(sug)) {
  if (typeof v === 'string' && k !== 'season') {
    check(`${k} is a wall-clock stamp`, WALL.test(v))
  }
}

/* The other leg, so a spring show suggests the following fall and the two
   legs stay whole weeks apart. */
const back = suggestNextShow({
  season: 'spring', year: 2027,
  startsOn: '2027-04-23T12:00', endsOn: '2027-04-25T16:00',
  applicationsOpenAt: '2027-02-15T09:00',
  applicationsCloseAt: '2027-02-26T23:59',
  rosterAnnouncedOn: '2027-03-05T09:00',
}, wall)
check('fall follows spring', back.season === 'fall')
check('in the same year', back.year === 2027)
check('and is still a Friday',
  new Date(`${back.startsOn.slice(0, 10)}T00:00:00Z`).getUTCDay() === 5)

/* ── the date helpers, which must never let a timezone move a day ──────── */

check('a day is a day', addDays('2027-04-23', 2) === '2027-04-25')
check('backwards too', addDays('2027-04-23', -67) === '2027-02-15')
check('a wall stamp is taken by its date', addDays('2027-04-23T12:00', 2) === '2027-04-25')
check('a full ISO is too', addDays('2027-04-23T12:00:00-07:00', 2) === '2027-04-25')
check('over a month end', addDays('2027-02-28', 1) === '2027-03-01')
/* The one a local-time parse gets wrong: spring forward in Los Angeles. */
check('across a DST boundary', addDays('2027-03-13', 1) === '2027-03-14')
check('across new year', addDays('2026-12-31', 1) === '2027-01-01')
check('a leap day exists', addDays('2028-02-28', 1) === '2028-02-29')
check('between', daysBetween('2026-11-13', '2027-04-23') === 161)
check('between ignores the clock',
  daysBetween('2026-11-13T23:59', '2027-04-23T00:00') === 161)
check('between, backwards', daysBetween('2027-04-23', '2026-11-13') === -161)
check('161 days is 23 whole weeks', 161 % 7 === 0)

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('next show: the rhythm of the last one, in whole weeks, with no timezone drift')
