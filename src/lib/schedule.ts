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

/**
 * The open and close times inside "5-9pm" or "9am - 6pm".
 *
 * A range usually writes the meridiem once, on the closing time, so a bare
 * opening time borrows it: "5-9pm" opens at 5pm, not at 5.
 */
export function bookends(hours: string): { opens: string; closes: string } {
  const [rawOpen, rawClose] = hours.split('-')
  const closes = (rawClose ?? '').trim()
  let opens = (rawOpen ?? '').trim()
  const meridiem = closes.match(/(am|pm)$/i)?.[1]
  if (opens && meridiem && !/(am|pm)$/i.test(opens)) opens += meridiem
  return { opens, closes }
}

export function extrasFor(day: string): DayExtras | undefined {
  const first = day.split(' ')[0]?.toLowerCase()
  return extras.find((e) => e.slug.toLowerCase() === first)
}
