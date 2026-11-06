/**
 * The .ics a shopper gets from "Add to calendar", and the Google link beside
 * it.
 *
 * Drew, 6 November: "the add to calendar button is broken on the schedule
 * page." The route answered and the file downloaded, so what was broken was
 * the file, and two things in it are the kind a calendar rejects without
 * telling anybody why:
 *
 *   1. Long lines. RFC 5545 §3.1 caps a content line at 75 OCTETS and folds
 *      the rest onto continuation lines beginning with a space. Our
 *      DESCRIPTION ran past two hundred characters in one line. Apple and
 *      Google forgive it. Outlook and several Android importers do not.
 *   2. Half-escaped text. Only commas were escaped, so a semicolon or a
 *      backslash anywhere in a venue address or a show name silently ended
 *      the property value and took the rest of the line with it.
 *
 * Both are the sort of bug that cannot be caught by looking at the page, only
 * by reading the file, which is why the whole thing is a pure function with
 * a test rather than a template inside a route handler (CLAUDE.md rule 10).
 *
 * The Google link exists because an .ics is a download, and a download on a
 * phone lands in Files and looks exactly like nothing happening. Most people
 * who tap this are on a phone.
 */

export type CalendarShow = {
  slug: string
  name: string
  startsOn: string
  endsOn: string
  venueAddress: string
  hoursNote: string
}

/** A date property's YYYYMMDD, read off the stored day and never off a clock. */
export function ymd(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

/**
 * The exclusive DTEND for an all-day run: the day after the last day.
 *
 * Done on the date text rather than through a Date, because `new Date(iso)`
 * of a Pacific timestamp and `setUTCDate` is a UTC walk around a Pacific
 * day, and the two agree until the show falls across a daylight-saving
 * change or starts late enough in the evening. The show is in November.
 */
export function dayAfter(iso: string): string {
  const [y, m, d] = ymd(iso).match(/(\d{4})(\d{2})(\d{2})/)!.slice(1).map(Number) as [number, number, number]
  const walked = new Date(Date.UTC(y, m - 1, d + 1))
  return ymd(walked.toISOString())
}

/**
 * RFC 5545 §3.3.11 TEXT escaping. The backslash goes first or it escapes the
 * escapes that follow it.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
}

/**
 * Fold one content line to 75 octets, continuing with CRLF and one space.
 *
 * Octets, not characters: the line carries a middle dot and an address, and
 * splitting a multi-byte character in half produces a file that no client
 * will parse. So the measure is the UTF-8 length and a character is never
 * cut, which is why this walks code points instead of slicing.
 */
export function fold(line: string): string {
  const width = (s: string) => Buffer.byteLength(s, 'utf8')
  if (width(line) <= 75) return line
  const out: string[] = []
  let run = ''
  let limit = 75
  for (const ch of line) {
    if (width(run) + width(ch) > limit) {
      out.push(run)
      run = ''
      // A continuation line spends one octet on its leading space.
      limit = 74
    }
    run += ch
  }
  if (run) out.push(run)
  return out.join('\r\n ')
}

/** The whole calendar, folded, escaped and CRLF-terminated. */
export function icsForShow(show: CalendarShow, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mermade Market//EN',
    'CALSCALE:GREGORIAN',
    // Some importers treat a calendar with no METHOD as a subscription feed
    // rather than an event to add.
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${show.slug}@mermademarket.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(show.startsOn)}`,
    `DTEND;VALUE=DATE:${dayAfter(show.endsOn)}`,
    `SUMMARY:${escapeText(`Mermade Market · ${show.name}`)}`,
    `LOCATION:${escapeText(show.venueAddress)}`,
    `DESCRIPTION:${escapeText(`A juried market of independent makers. Free admission. ${show.hoursNote}`)}`,
    'URL:https://mermademarket.com/schedule',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // The trailing CRLF matters: a file ending on END:VCALENDAR with no line
  // break is rejected by stricter parsers.
  return lines.map(fold).join('\r\n') + '\r\n'
}

/**
 * The same event as a Google Calendar link. No download, no file, no guessing
 * what the phone did with it: it opens the event already filled in and the
 * person presses save.
 */
export function googleCalendarUrl(show: CalendarShow): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Mermade Market · ${show.name}`,
    dates: `${ymd(show.startsOn)}/${dayAfter(show.endsOn)}`,
    location: show.venueAddress,
    details: `A juried market of independent makers. Free admission. ${show.hoursNote}`,
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
