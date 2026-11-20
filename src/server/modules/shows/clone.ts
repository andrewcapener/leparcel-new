import type { InferSelectModel } from 'drizzle-orm'
import type { shows, spaceTypes, addOns } from '@/db/schema'

/**
 * Plan the next show from the one that just happened.
 *
 * Mermade runs two shows a year in the same hall at the same prices, so the
 * next record is almost entirely the last one. The build plan has had this as
 * "spring 2027 show cloned from fall in one click" since the start, and until
 * now the only screen that existed, /admin/show, edits the ACTIVE show.
 *
 * That matters more than it sounds. Editing Fall's row to hold Spring's dates
 * would be the obvious shortcut and it would quietly rewrite history:
 * bookings, applications, statements and payouts are all scoped to a
 * `show_id` (CLAUDE.md rule 6), so Fall's forty statements would start
 * reporting that they belong to a show in April. The statements have already
 * gone out. So the next show is a NEW row, always, and this module exists to
 * make the correct thing the easy thing.
 *
 * Pure on purpose: it takes rows and returns rows and touches no database, so
 * what carries forward and what resets is a thing you can read and test
 * rather than a thing you discover in April.
 */

type Show = InferSelectModel<typeof shows>
type SpaceType = InferSelectModel<typeof spaceTypes>
type AddOn = InferSelectModel<typeof addOns>

export type NextShowInput = {
  id: string
  slug: string
  name: string
  season: 'spring' | 'fall'
  year: number
  numeral: string
  startsOn: string
  endsOn: string
  applicationsOpenAt: string
  applicationsCloseAt: string
  rosterAnnouncedOn: string
}

/** Roman numeral for the show after `prev`, or '' if prev's is not one. */
export function nextNumeral(prev: string): string {
  const V: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  const s = prev.trim().toUpperCase()
  if (!/^M*(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || s === '') return ''
  let n = 0
  let i = 0
  while (i < s.length) {
    const two = V.find(([, r]) => r.length === 2 && s.startsWith(r, i))
    const one = V.find(([, r]) => r.length === 1 && s.startsWith(r, i))
    const hit = two ?? one
    if (!hit) return ''
    n += hit[0]
    i += hit[1].length
  }
  let out = ''
  let left = n + 1
  for (const [val, r] of V) {
    while (left >= val) { out += r; left -= val }
  }
  return out
}

/**
 * The next show's row, carrying forward what is about the market and
 * resetting what was about the last one.
 *
 * Carried: the venue, the prose notes (load-in, take-down, hours), the
 * commission, the capacities, the payment window and methods. These describe
 * how Mermade runs and they are what staff would otherwise retype from
 * memory, which is how a 20% commission becomes a 2% one.
 *
 * Reset: everything that is a fact about a show that happened. The dates and
 * the application window come from the caller. `paymentDueAt` is cleared
 * because a deadline in September is not a deadline, and a stale one would
 * mark every new acceptance overdue on arrival. `paymentSheetId` is cleared
 * because that sheet holds last show's payments. `decisionsFrom/To` are
 * cleared because no jury is scheduled yet, and the thank-you screen is
 * written to promise nothing when they are null.
 *
 * The three email switches and payoutSetup are deliberately forced OFF rather
 * than carried. They are the ones that mail makers, and the failure they
 * guard against is real: turning decision emails on mails everybody you have
 * already decided on, from that moment. A new show should start silent and
 * be switched on by somebody who means it.
 *
 * `isActive` is false. Creating the next show must never take the public site
 * off the current one as a side effect: Fall's statements were still being
 * reconciled the week Spring was planned.
 */
export function nextShowRow(prev: Show, input: NextShowInput): Omit<Show, 'createdAt'> {
  const { createdAt: _was, ...rest } = prev

  /* hoursNote, the two load-in notes and the take-down note read like policy
     and are not: they have the show's own dates written into them. Carried
     across word for word, Spring announced itself with November hours. Each
     is moved with the show, and cleared rather than left wrong when the move
     cannot be vouched for. See shiftNoteDates. */
  const days = daysBetween(prev.startsOn, input.startsOn)
  const fromYear = Number(prev.startsOn.slice(0, 4))
  const shift = (note: string) =>
    shiftNoteDates(note, days, fromYear, input.startsOn) ?? ''

  return {
    ...rest,
    hoursNote: shift(prev.hoursNote),
    loadInNote: shift(prev.loadInNote),
    outdoorLoadInNote: shift(prev.outdoorLoadInNote),
    takedownNote: shift(prev.takedownNote),
    id: input.id,
    slug: input.slug,
    numeral: input.numeral,
    name: input.name,
    season: input.season,
    year: input.year,

    startsOn: input.startsOn,
    endsOn: input.endsOn,
    applicationsOpenAt: input.applicationsOpenAt,
    applicationsCloseAt: input.applicationsCloseAt,
    rosterAnnouncedOn: input.rosterAnnouncedOn,

    decisionsFromOn: null,
    decisionsToOn: null,
    paymentDueAt: null,
    paymentSheetId: null,
    inventoryDueAt: null,

    decisionEmails: 'off',
    paymentEmail: 'off',
    payoutSetup: 'off',

    /* When the row was made is the database's to say, not ours, so the
       column is left off entirely and defaultNow() fills it. */
    isActive: false,
  }
}

/** The new show's space types: same shape, same prices, new ids. */
export function clonedSpaceTypes(
  prev: SpaceType[], showId: string, id: () => string,
): SpaceType[] {
  return prev
    .filter((s) => s.isActive)
    .map((s) => ({ ...s, id: id(), showId }))
}

/** The new show's add-ons: same shape, same prices, new ids. */
export function clonedAddOns(prev: AddOn[], showId: string, id: () => string): AddOn[] {
  return prev.map((a) => ({ ...a, id: id(), showId }))
}

/**
 * What a slug should be, so two shows never collide on it.
 * "spring" + 2027 -> "spring-2027".
 */
export function showSlug(season: string, year: number): string {
  return `${season.trim().toLowerCase()}-${year}`
}

/* ── what to suggest, when you open the form ───────────────────────────── */

/* Fall to spring and back, in whole weeks, so a suggested date always lands
   on the weekday the last one did. Fall 2026 opened Friday 13 November and
   Spring 2027 opens Friday 23 April: 161 days, exactly 23 weeks. The two
   legs add to 364 rather than 365, so the suggestion drifts a day earlier
   against the calendar each year and never drifts off a Friday. It is a
   starting point in an editable field, not a schedule. */
const AFTER_FALL = 161
const AFTER_SPRING = 203

/**
 * The date part plus n days, as 'YYYY-MM-DD'.
 *
 * Takes the first ten characters, so it is happy with either a bare date or
 * a wall-clock stamp like '2026-11-13T12:00'. Every Show date is stored as a
 * full Pacific ISO string rather than a date (the show "starts" at its first
 * public hour), so the bare-date version of this quietly returned its own
 * input and every suggestion came back as last season's.
 *
 * Parsed as UTC so that adding a day never crosses a daylight saving
 * boundary and lands on the same date it started (CLAUDE.md rule 8).
 */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date.slice(0, 10)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Whole days between two dates, b minus a, ignoring any time of day. */
export function daysBetween(a: string, b: string): number {
  const x = new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime()
  const y = new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime()
  if (Number.isNaN(x) || Number.isNaN(y)) return 0
  return Math.round((y - x) / 86_400_000)
}

/** Every field as LA wall clock, 'YYYY-MM-DDTHH:mm', which is what the
 *  datetime-local inputs on /admin/show take and what laWallToIso stores. */
export type Suggestion = {
  season: 'spring' | 'fall'
  year: number
  startsOn: string
  endsOn: string
  applicationsOpenAt: string
  applicationsCloseAt: string
  rosterAnnouncedOn: string
}

/**
 * The next show, as the last one would have it.
 *
 * Every interval is measured off the show that just happened rather than
 * written down here: how long the show runs, how far ahead applications
 * opened, how long the window stayed open, how long after it closed the
 * roster went up. Fall 2026 opened applications 67 days before doors and
 * kept them open 11, so Spring is offered the same, which puts it in
 * February. Change any of it in the form.
 *
 * Each field keeps its own time of day, in LA wall time, so a window that
 * opened at 9am opens at 9am and a show whose first public hour was noon
 * still starts at noon, with no hour lost when the suggestion crosses
 * daylight saving (CLAUDE.md rule 8).
 */
export function suggestNextShow(
  prev: Pick<Show,
    'season' | 'year' | 'startsOn' | 'endsOn'
    | 'applicationsOpenAt' | 'applicationsCloseAt' | 'rosterAnnouncedOn'>,
  toWall: (iso: string) => string,
): Suggestion {
  const season = prev.season === 'fall' ? 'spring' : 'fall'
  const shift = prev.season === 'fall' ? AFTER_FALL : AFTER_SPRING

  const wasStart = toWall(prev.startsOn)
  const startsOn = `${addDays(wasStart, shift)}${wasStart.slice(10)}`

  /* Everything else keeps the gap it had to the first day of the show, and
     its own clock time. A negative gap simply lands after it, which is what
     the last day of the show is. */
  const move = (iso: string) => {
    const w = toWall(iso)
    const lead = daysBetween(w, wasStart)
    return `${addDays(startsOn, -lead)}${w.slice(10)}`
  }

  return {
    season,
    /* Spring follows the fall of the year before it. */
    year: season === 'spring' ? prev.year + 1 : prev.year,
    startsOn,
    endsOn: move(prev.endsOn),
    applicationsOpenAt: move(prev.applicationsOpenAt),
    applicationsCloseAt: move(prev.applicationsCloseAt),
    rosterAnnouncedOn: move(prev.rosterAnnouncedOn),
  }
}

/* ── the notes that quietly contain dates ──────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_RE = MONTHS.map((m) => `${m.slice(0, 3)}(?:${m.slice(3)})?`).join('|')
/* "13 November" and "November 13", with or without an ordinal suffix. */
const DATE_RE = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b|\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
  'gi',
)

/**
 * Move the dates written inside a Show note, or refuse to.
 *
 * hoursNote, loadInNote and takedownNote read like policy and are not. They
 * are prose with dates baked into them: "Friday 13 November, 9am to 6pm",
 * "Thursday 12 November, 1-7pm", "Sunday 15 November at 5pm sharp". The
 * first clone carried them across word for word, so Spring 2027 announced
 * itself on the homepage with November hours. Drew spotted it: "you haven't
 * fully switched all the dates."
 *
 * Returns null when it will not vouch for the result, and null means the
 * note is cleared rather than left wrong. Two things make it refuse:
 *
 *  - A move that is not a whole number of weeks. Every weekday NAME in the
 *    note ("Friday") is only still true if the shift preserves weekdays.
 *  - A shifted date that does not land within three weeks of the new show.
 *    That means something was parsed that was not a show date, and a
 *    confidently rewritten wrong date is worse than a blank field.
 *
 * A note with no dates in it ("7am on your day") comes back untouched.
 */
export function shiftNoteDates(
  note: string, days: number, fromYear: number, newStart: string,
): string | null {
  if (!note.trim()) return note
  if (days % 7 !== 0) return null

  let refused = false
  const out = note.replace(DATE_RE, (whole, d1, m1, m2, d2) => {
    const day = Number(d1 ?? d2)
    const name = String(m1 ?? m2)
    const month = MONTHS.findIndex((m) => m.toLowerCase().startsWith(name.slice(0, 3).toLowerCase()))
    if (month < 0 || !Number.isInteger(day)) { refused = true; return whole }

    const was = new Date(Date.UTC(fromYear, month, day))
    if (Number.isNaN(was.getTime())) { refused = true; return whole }
    const moved = addDays(was.toISOString().slice(0, 10), days)

    if (Math.abs(daysBetween(moved, newStart)) > 21) { refused = true; return whole }

    const dd = Number(moved.slice(8, 10))
    const mm = MONTHS[Number(moved.slice(5, 7)) - 1]
    /* Written back the way it was found, so "13 November" and "November 13"
       each keep their own shape. */
    return d1 != null ? `${dd} ${mm}` : `${mm} ${dd}`
  })

  return refused ? null : out
}
