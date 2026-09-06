/** Timezone is America/Los_Angeles. Store UTC, render Pacific. (CLAUDE.md rule 8) */
const TZ = 'America/Los_Angeles'

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric', ...opts,
  })
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** "November 13-15, 2026" */
export function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso), e = new Date(endIso)
  const month = s.toLocaleDateString('en-US', { timeZone: TZ, month: 'long' })
  const d1 = s.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' })
  const d2 = e.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' })
  const yr = e.toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric' })
  return `${month} ${d1}-${d2}, ${yr}`
}

export type WindowState = 'before' | 'open' | 'closed'

/**
 * Which side of the application window we are on.
 *
 * The close is inclusive of its whole minute. Staff set the deadline at
 * /admin/show with a `datetime-local` input, which has no seconds field, so a
 * close is always stored at :00 and "11:59pm PT" really means 23:59:00. Against
 * a bare `>` that refused a submission at 23:59:01, while /apply printed
 * "September 20, 11:59pm PT" and the FAQ counted the day as whole. Applications
 * to a craft fair arrive in a rush in the last few minutes, so the difference is
 * not theoretical, and staff cannot fix it themselves because the input they use
 * cannot express :59.
 */
const MINUTE_MS = 60_000

export function applicationWindow(openAt: string, closeAt: string, nowIso?: string): WindowState {
  const n = nowIso ? new Date(nowIso) : new Date()
  if (n < new Date(openAt)) return 'before'
  const closesAfter = new Date(closeAt).getTime() + MINUTE_MS - 1
  if (n.getTime() > closesAfter) return 'closed'
  return 'open'
}

/** LA wall clock "YYYY-MM-DDTHH:mm" → ISO with the correct PT offset for that
 *  date (PDT -07:00 or PST -08:00). The admin edits wall time; storage keeps
 *  the offset explicit so nothing shifts when DST does. (CLAUDE.md rule 8.) */
export function laWallToIso(wall: string): string {
  for (const off of ['-08:00', '-07:00'] as const) {
    const candidate = new Date(`${wall}:00${off}`)
    if (isoToLaWall(candidate.toISOString()) === wall) return `${wall}:00${off}`
  }
  return `${wall}:00-08:00` // unreachable outside the one-hour DST gap
}

/** ISO → LA wall clock "YYYY-MM-DDTHH:mm", for datetime-local inputs. */
export function isoToLaWall(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T')
}

/**
 * The day before the show opens, which is indoor load-in.
 *
 * The maker rules name that day twice ("set-up runs Thursday Nov 12", "there
 * is no Friday morning set-up"), and CLAUDE.md rule 6 says a date never gets
 * typed into a page. Both come off `startsOn`: load-in is the day before,
 * Friday is the first show day.
 */
export function dayBefore(iso: string): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString()
}

/** "Thursday November 12". Composed rather than asked for in one call,
 *  because the locale puts a comma after the weekday and these read as prose:
 *  "runs Thursday November 12 until 7pm", not "runs Thursday, November 12". */
export function fmtWeekdayDate(iso: string): string {
  return `${fmtWeekday(iso)} ${fmtDate(iso, { year: undefined })}`
}

/** "Friday" */
export function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' })
}

/** "November 13" */
export function fmtDayMonth(iso: string): string {
  return fmtDate(iso, { year: undefined })
}

/**
 * "September 20, 11:59pm PT" — an application deadline, as a person says it.
 *
 * The time is read off the stored timestamp rather than typed beside it. A
 * deadline printed as a date plus a literal "11:59pm" is two facts that can
 * disagree, and staff move the close at /admin/show without touching any copy.
 * (CLAUDE.md rules 6 and 8.)
 */
export function fmtDeadline(iso: string): string {
  const time = new Date(iso)
    .toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .replace(/\s*AM$/, 'am')
    .replace(/\s*PM$/, 'pm')
  return `${fmtDate(iso, { year: undefined })}, ${time} PT`
}
