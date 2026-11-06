/**
 * The run of show, day by day, as mermademarket.com/pages/schedule lays it
 * out: each day is a heading, a set of timed rows, the things that run all
 * day, the music, and a closing time.
 *
 * The lineup lands about a week out, which is when Hillary finishes booking
 * the music and the trucks, so this module holds one season's worth and the
 * page reads it. Nothing here is invented and nothing is a placeholder: a
 * day with nothing booked prints no block at all, and a slot nobody is
 * playing yet is simply absent, because a shopper reading a name on this page
 * will drive down for it.
 *
 * No dates or hours live in this file. The day headings come off the Show
 * record's hoursNote (CLAUDE.md rule 6); `slug` matches its first word so a
 * day's extras can be attached without repeating the date.
 */

export type Slot = { time: string; what: string }

/** An hour Hillary has held but not booked. Printed, never guessed at. */
export const TBA = 'TBA'

/**
 * Something on for the day, and where to look it up.
 *
 * Elise, 6 November: "Oh happy hair lounge needs a link." She is right, and
 * it generalises: a shopper reading a name she does not know has nowhere to
 * go, and a maker reposting the day wants the handle. The href is optional
 * because most of these are a truck in a car park with nothing to link to.
 */
export type Named = { name: string; href?: string }

export type DayExtras = {
  /** Matches the first word of the day in the Show record's hoursNote. */
  slug: string
  /**
   * The coffee, the trucks and the trailers, in the order a day is eaten.
   *
   * Elise: "Start with coffee. Cuz its a morning thing." The order was the
   * order they sat in Hillary's plan, which is a seating chart and not a
   * sequence, so it opened with lunch.
   */
  food: Named[]
  /** Things that run from open to close. */
  allDay: Named[]
  /** The live-music set times. */
  music: Slot[]
}

/**
 * Fall 2026, from Hillary's outdoor plan, 6 November.
 *
 * Three things a shopper plans a day around: who is playing and when, what
 * there is to eat, and what is there from open to close. Everything else on
 * the day, which is to say the makers, is generated from bookings on /makers,
 * so no name is typed twice.
 *
 * The music is as Hillary scheduled it. Friday's three morning slots and
 * Saturday's nine o'clock were still open when this went up, and they are
 * here as TBA rather than missing: Drew, 6 November, "maybe we fill 1. with
 * TBA on those sections?" He is right that a gap reads worse than an
 * admission. A shopper looking at ten o'clock on Friday can see there is a
 * slot and that we have not named it yet, instead of guessing whether the
 * music starts at lunchtime. Put a name in and the TBA goes.
 *
 * TBA is a constant and not a typed string, so the page can tell a booked
 * set from an open one without matching on words.
 *
 * The carts are the same three every day and the truck changes, which is why
 * they are one list per day rather than a truck field and a shared tail: the
 * day is the unit a shopper reads, and a shared tail would have read as
 * "today, plus some other things" on every day of the show.
 */
export const extras: DayExtras[] = [
  {
    slug: 'Friday',
    food: [
      { name: 'JC Beans Coffee', href: 'https://www.instagram.com/jc_beanscoffee/' },
      { name: 'EatsyJoon empanadas' },
      { name: 'Stix & Cones', href: 'https://www.instagram.com/stixcones/' },
      { name: 'Sweet’n Cloud Co.', href: 'https://www.instagram.com/sweetncloudco/' },
      { name: 'Alohana Acai', href: 'https://www.instagram.com/alohanaacaibowls/' },
    ],
    allDay: [
      { name: 'Oh Happy Day Hair Lounge', href: 'https://www.instagram.com/ohhappydayhairlounge/' },
      { name: 'Face painting' },
    ],
    music: [
      { time: '9 to 10am', what: TBA },
      { time: '10:15 to 11:15am', what: TBA },
      { time: '11:30am to 1pm', what: TBA },
      { time: '1:15 to 2:45pm', what: 'Emily Halverson' },
      { time: '3 to 4:30pm', what: 'Andrew Lavin' },
      { time: '4:45 to 6pm', what: 'Hector Lavin' },
    ],
  },
  {
    slug: 'Saturday',
    food: [
      { name: 'JC Beans Coffee', href: 'https://www.instagram.com/jc_beanscoffee/' },
      { name: 'Baby’s Badass Burgers' },
      { name: 'Stix & Cones', href: 'https://www.instagram.com/stixcones/' },
      { name: 'Sweet’n Cloud Co.', href: 'https://www.instagram.com/sweetncloudco/' },
      { name: 'Alohana Acai', href: 'https://www.instagram.com/alohanaacaibowls/' },
    ],
    allDay: [
      { name: 'Oh Happy Day Hair Lounge', href: 'https://www.instagram.com/ohhappydayhairlounge/' },
      { name: 'Face painting' },
    ],
    music: [
      { time: '9 to 10am', what: TBA },
      { time: '10:15am to 12:15pm', what: 'Still Summer' },
      { time: '12:30 to 2:30pm', what: 'Ella Wu' },
      { time: '2:45 to 3:45pm', what: 'Katie Miller' },
      { time: '4 to 5pm', what: 'Paul & Maylee Giddings' },
    ],
  },
  {
    slug: 'Sunday',
    food: [
      { name: 'JC Beans Coffee', href: 'https://www.instagram.com/jc_beanscoffee/' },
      { name: 'Baby’s Badass Burgers' },
      { name: 'Stix & Cones', href: 'https://www.instagram.com/stixcones/' },
      { name: 'Sweet’n Cloud Co.', href: 'https://www.instagram.com/sweetncloudco/' },
      { name: 'Alohana Acai', href: 'https://www.instagram.com/alohanaacaibowls/' },
    ],
    allDay: [
      { name: 'Oh Happy Day Hair Lounge', href: 'https://www.instagram.com/ohhappydayhairlounge/' },
      { name: 'Face painting' },
    ],
    music: [
      { time: '9 to 10am', what: 'Piper Kuhn' },
      { time: '10:15 to 11:15am', what: 'Hector Lavin' },
      { time: '11:30am to 1pm', what: 'Ella Wu' },
      { time: '1:15 to 2:30pm', what: 'Andrew Lavin' },
      { time: '2:45 to 3:45pm', what: 'Paul Jackson' },
      { time: '4 to 5pm', what: 'Paul Jackson' },
    ],
  },
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

/** A clock time that carries its own meridiem: "9am", "12:30pm". */
const CLOCK = /^\d{1,2}(:\d{2})?(am|pm)$/i

/**
 * One day of the hours note, with a bare opening time given its meridiem.
 *
 * Staff type the hours at /admin/show and every human writes a nine-to-six day
 * as "9 - 6pm", so that is what the record holds. `bookends` already works out
 * that this means 9am, but only the schedule page was asking: /apply, both
 * maker pages and the home page printed the row as typed, so Friday read
 * "9 to 6pm" next to a Saturday that read "9am to 5pm".
 *
 * A row is only rewritten when both ends come back as real clock times.
 * Anything else, "noon to 4pm", "by appointment", a row with no comma in it,
 * is returned exactly as it was typed.
 */
export function tidyDayHours(row: string): string {
  // The last comma, not the first: `splitDay` wants the day and takes the
  // first, but "Friday, 13 November, 9 to 6pm" puts a comma inside the date
  // and the hours are always what follows the last one.
  const cut = row.lastIndexOf(',')
  if (cut < 0) return row
  const day = row.slice(0, cut)
  const { opens, closes } = bookends(row.slice(cut + 1).trim())
  if (!CLOCK.test(opens) || !CLOCK.test(closes)) return row
  return `${day}, ${opens} to ${closes}`
}

/** Every day of the hours note, tidied. The separator is untouched: five
 *  pages split on " · " and the Show record's field is documented by it. */
export function tidyHoursNote(note: string): string {
  return note.split(' · ').map(tidyDayHours).join(' · ')
}

export function extrasFor(day: string): DayExtras | undefined {
  const first = day.split(' ')[0]?.toLowerCase()
  return extras.find((e) => e.slug.toLowerCase() === first)
}

/** True when a day has something of its own to print. */
export function hasExtras(x: DayExtras | undefined): x is DayExtras {
  return !!x && (x.food.length > 0 || x.allDay.length > 0 || x.music.length > 0)
}
