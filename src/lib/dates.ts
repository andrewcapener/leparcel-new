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

export function applicationWindow(openAt: string, closeAt: string, nowIso?: string): WindowState {
  const n = nowIso ? new Date(nowIso) : new Date()
  if (n < new Date(openAt)) return 'before'
  if (n > new Date(closeAt)) return 'closed'
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
