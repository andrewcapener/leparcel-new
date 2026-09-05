/**
 * The run of show, day by day, as mermademarket.com/pages/schedule lays it
 * out: each day is a heading, a set of timed rows, the things that run all
 * day, the music, and a closing time.
 *
 * The live page is edited by hand every season and its lineup lands about a
 * week out. So this module carries the shape and the fixed rows, and the
 * variable ones — the food truck, the musicians, the extras — stay empty
 * until they are booked. Nothing here is invented: an empty `music` array
 * renders as "posted closer to the show", which is what the live outdoor page
 * promises.
 *
 * No dates or hours live in this file. The day headings come off the Show
 * record's hoursNote (CLAUDE.md rule 6); `slug` matches its first word so a
 * day's extras can be attached without repeating the date.
 */

export type Slot = { time: string; what: string }

export type DayExtras = {
  /** Matches the first word of the day in the Show record's hoursNote. */
  slug: string
  /** "Food Truck: Baby's Badass Burgers" — one truck a day on the live site. */
  foodTruck?: string
  /** Things that run from open to close. */
  allDay: string[]
  /** The live-music set times. */
  music: Slot[]
}

/**
 * Fall 2026. Empty on purpose — the trucks and the musicians are not booked
 * yet. Fill a day in here as it is confirmed and the page picks it up.
 */
export const extras: DayExtras[] = [
  { slug: 'Friday', allDay: [], music: [] },
  { slug: 'Saturday', allDay: [], music: [] },
  { slug: 'Sunday', allDay: [], music: [] },
]

/** Splits "Friday 13 November, 5-9pm" into its day and its hours. */
export function splitDay(row: string): { day: string; hours: string } {
  const [day, ...rest] = row.split(', ')
  return { day: day ?? row, hours: rest.join(', ') }
}

/** "6pm" and "9am" as minutes past midnight, or null if it is not a time. */
function minutes(time: string): number | null {
  const m = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (!m) return null
  const hour12 = Number(m[1])
  if (hour12 < 1 || hour12 > 12) return null
  const pm = m[3]!.toLowerCase() === 'pm'
  const hour = hour12 === 12 ? (pm ? 12 : 0) : hour12 + (pm ? 12 : 0)
  return hour * 60 + Number(m[2] ?? 0)
}

/** "9" -> "9am" / "9pm". */
function withMeridiem(time: string, meridiem: string): string {
  return time + meridiem
}

/**
 * The open and close times inside "5-9pm", "9am - 6pm" or "9 - 6pm".
 *
 * A range usually writes the meridiem once, on the closing time, so a bare
 * opening time borrows it: "5-9pm" opens at 5pm, not at 5.
 *
 * Borrowing alone is not enough. A show that runs 9 in the morning to 6 in the
 * evening is written "9 - 6pm" by every human who has ever written it, and
 * borrowing turned that into "9pm to 6pm" on the live schedule page: a market
 * that closes three hours before it opens. So the borrowed meridiem has to
 * survive a sanity check. If it puts the opening at or after the close, the
 * range is impossible and the other meridiem is the one that was meant.
 *
 * That rule holds both ways round. "5 - 9pm" borrows pm and 5pm is before 9pm,
 * so it stands. "9 - 6pm" borrows pm, 9pm is after 6pm, so it flips to 9am.
 * "11 - 1pm" flips to 11am. "12 - 5pm" stays at noon.
 */
export function bookends(hours: string): { opens: string; closes: string } {
  // Any dash, and the word. This split on a plain hyphen only, and the Show
  // record is typed by a person at /admin/show: the moment someone wrote
  // "10am – 5pm" with an en dash, which is what a phone and most editors
  // produce, the close time came back empty and the page printed a closing
  // row with no time in it.
  const [rawOpen, rawClose] = hours.split(/\s*(?:[-\u2010-\u2015\u2212]|\bto\b)\s*/i)
  const closes = (rawClose ?? '').trim()
  let opens = (rawOpen ?? '').trim()
  const meridiem = closes.match(/(am|pm)$/i)?.[1]
  // Only a bare clock number borrows. "noon - 4pm" is already a time and
  // appending to it produced "noonpm".
  if (opens && meridiem && /^\d{1,2}(:\d{2})?$/.test(opens)) {
    const borrowed = withMeridiem(opens, meridiem)
    const other = withMeridiem(opens, meridiem.toLowerCase() === 'pm' ? 'am' : 'pm')
    const close = minutes(closes)
    const asBorrowed = minutes(borrowed)
    const asOther = minutes(other)
    // Only overrule the borrow when both readings parse and the borrowed one
    // is genuinely impossible. Anything unparseable is left exactly as typed.
    opens = close !== null && asBorrowed !== null && asOther !== null
      && asBorrowed >= close && asOther < close
      ? other
      : borrowed
  }
  return { opens, closes }
}

export function extrasFor(day: string): DayExtras | undefined {
  const first = day.split(' ')[0]?.toLowerCase()
  return extras.find((e) => e.slug.toLowerCase() === first)
}
