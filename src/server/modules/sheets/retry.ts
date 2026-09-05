/**
 * When to try again, and how a sync record moves between states.
 *
 * Pure: no clock, no database, no network. Every input is an argument, so the
 * whole retry policy is unit-tested in retry.test.ts rather than inferred from
 * production behaviour at 2am.
 *
 * The states are the ones a person would draw:
 *
 *   pending ──sent──▶ sent
 *      │  ▲
 *      │  └── a retryable failure, with a longer wait each time
 *      └──── attempts exhausted, or an error a human has to fix ──▶ failed
 *
 * `failed` is not the end of the road: scripts/sync-sheets.ts picks up
 * everything that is not `sent`, so the fix for any outage is one command.
 */

export type SyncStatus = 'pending' | 'sent' | 'failed'

export type SyncState = {
  status: SyncStatus
  attempts: number
  lastError: string
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  sentAt: string | null
}

export type AttemptResult = { ok: true } | { ok: false; detail: string; retryable: boolean }

/** After this many tries something is wrong that waiting will not fix. */
export const MAX_ATTEMPTS = 8

/**
 * Wait before attempt n (1-based), in ms. A minute, then five, then a quarter
 * hour, then hours: long enough to ride out a Google incident, short enough
 * that a five-minute blip is invisible to the team.
 */
const SCHEDULE_MS = [
  60_000,          // 1 min
  5 * 60_000,      // 5 min
  15 * 60_000,     // 15 min
  60 * 60_000,     // 1 h
  4 * 60 * 60_000, // 4 h
  12 * 60 * 60_000,
  24 * 60 * 60_000,
]

export function backoffMs(attempts: number): number {
  const i = Math.max(0, Math.min(attempts - 1, SCHEDULE_MS.length - 1))
  return SCHEDULE_MS[i]!
}

/** The empty state for an application that has never been posted. */
export function initialState(nowIso: string): SyncState {
  return {
    status: 'pending',
    attempts: 0,
    lastError: '',
    lastAttemptAt: null,
    nextAttemptAt: nowIso,
    sentAt: null,
  }
}

/**
 * The state machine. Given where a sync was and what the last attempt did,
 * where it goes next. Deterministic, so a test can walk a whole outage.
 */
export function nextState(prev: SyncState, result: AttemptResult, nowIso: string): SyncState {
  const attempts = prev.attempts + 1

  if (result.ok) {
    return {
      status: 'sent',
      attempts,
      lastError: '',
      lastAttemptAt: nowIso,
      nextAttemptAt: null,
      sentAt: nowIso,
    }
  }

  const giveUp = !result.retryable || attempts >= MAX_ATTEMPTS
  return {
    status: giveUp ? 'failed' : 'pending',
    attempts,
    // The caller redacts before it gets here; this only bounds the length so
    // one enormous HTML error page cannot bloat every row.
    lastError: result.detail.slice(0, 400),
    lastAttemptAt: nowIso,
    nextAttemptAt: giveUp
      ? null
      : new Date(new Date(nowIso).getTime() + backoffMs(attempts)).toISOString(),
    sentAt: prev.sentAt,
  }
}

/** Is this record ready for another automatic attempt? */
export function isDue(
  rec: Pick<SyncState, 'status' | 'nextAttemptAt'>,
  nowIso: string,
): boolean {
  if (rec.status !== 'pending') return false
  if (!rec.nextAttemptAt) return true
  return new Date(nowIso).getTime() >= new Date(rec.nextAttemptAt).getTime()
}

/**
 * The idempotency key: the application's own id, which travels in the row's
 * last column. It is deterministic (the same application always produces the
 * same key), it is already unique, and both transports key on it, so a retry
 * after a timeout that actually went through updates the existing row instead
 * of adding a second one.
 */
export function idempotencyKey(applicationId: string): string {
  return applicationId
}
