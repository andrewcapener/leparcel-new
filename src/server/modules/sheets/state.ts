/**
 * The durable half: sheet_syncs, one row per application.
 *
 * Every function takes the db handle (CLAUDE.md rule 10) and none of them
 * throws at the caller. A database one migration behind the deploy is a real
 * state on this project (see src/db/queries.ts), and it must cost a queued
 * sheet row, never a maker's application.
 *
 * Nothing PII-shaped is written here. `last_error` is redacted by the
 * transport before it arrives (CLAUDE.md rule 9).
 */
import { and, eq, isNull, lte, or, sql, desc, ne } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { applications, sheetSyncs } from '@/db/schema'
import { pgCode } from '@/db/queries'
import { initialState, nextState, type AttemptResult, type SyncState } from './retry'
import type { TransportName } from './transport'

export type DbHandle = typeof Db

const MISSING_TABLE = '42P01'

/** True when the failure is only "migration 0003 has not run here yet". */
function tolerable(err: unknown, where: string): boolean {
  if (pgCode(err) !== MISSING_TABLE) return false
  console.warn(`[sheets] ${where}: sheet_syncs is missing; run drizzle/0003_sheet-syncs.sql`)
  return true
}

/** Queue an application for the Sheet. Idempotent: an application has one row. */
export async function ensureQueued(db: DbHandle, applicationId: string): Promise<void> {
  const s = initialState(new Date().toISOString())
  try {
    await db.insert(sheetSyncs).values({
      applicationId,
      status: s.status,
      attempts: 0,
      nextAttemptAt: s.nextAttemptAt,
    }).onConflictDoNothing()
  } catch (err) {
    if (!tolerable(err, 'queue')) console.error('[sheets] could not queue:', String(err).slice(0, 200))
  }
}

export async function readState(
  db: DbHandle, applicationId: string,
): Promise<SyncState | undefined> {
  try {
    const [row] = await db
      .select()
      .from(sheetSyncs)
      .where(eq(sheetSyncs.applicationId, applicationId))
      .limit(1)
    if (!row) return undefined
    return {
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      lastAttemptAt: row.lastAttemptAt,
      nextAttemptAt: row.nextAttemptAt,
      sentAt: row.sentAt,
    }
  } catch (err) {
    if (!tolerable(err, 'read')) throw err
    return undefined
  }
}

/**
 * Fold one attempt into the record and return the state it landed in. The
 * decision itself is the pure state machine in retry.ts; this only persists it.
 */
export async function recordAttempt(
  db: DbHandle,
  applicationId: string,
  transport: TransportName,
  result: AttemptResult,
  nowIso = new Date().toISOString(),
): Promise<SyncState> {
  const prev = (await readState(db, applicationId)) ?? initialState(nowIso)
  const next = nextState(prev, result, nowIso)
  try {
    await db.insert(sheetSyncs).values({
      applicationId,
      status: next.status,
      transport,
      attempts: next.attempts,
      lastError: next.lastError,
      lastAttemptAt: next.lastAttemptAt,
      nextAttemptAt: next.nextAttemptAt,
      sentAt: next.sentAt,
    }).onConflictDoUpdate({
      target: sheetSyncs.applicationId,
      set: {
        status: next.status,
        transport,
        attempts: next.attempts,
        lastError: next.lastError,
        lastAttemptAt: next.lastAttemptAt,
        nextAttemptAt: next.nextAttemptAt,
        sentAt: next.sentAt,
      },
    })
  } catch (err) {
    if (!tolerable(err, 'record')) {
      console.error('[sheets] could not record the attempt:', String(err).slice(0, 200))
    }
  }
  return next
}

/**
 * Applications the Sheet is still missing.
 *
 * `dueOnly` respects the backoff, for anything running on a timer. The script
 * defaults to everything not sent, because a person running it by hand has
 * decided the outage is over and should not be told to wait four more hours.
 */
export async function unsentApplicationIds(
  db: DbHandle,
  opts: { dueOnly?: boolean; limit?: number; nowIso?: string } = {},
): Promise<string[]> {
  const now = opts.nowIso ?? new Date().toISOString()
  try {
    const where = opts.dueOnly
      ? and(
        eq(sheetSyncs.status, 'pending'),
        or(isNull(sheetSyncs.nextAttemptAt), lte(sheetSyncs.nextAttemptAt, now)),
      )
      : ne(sheetSyncs.status, 'sent')
    const rows = await db
      .select({ id: sheetSyncs.applicationId })
      .from(sheetSyncs)
      .where(where)
      .limit(opts.limit ?? 500)
    return rows.map((r) => r.id)
  } catch (err) {
    if (!tolerable(err, 'list')) throw err
    return []
  }
}

/**
 * Queue every application that has no sync record at all.
 *
 * This is what makes a backfill possible: applications submitted before the
 * Sheet was configured, or before migration 0003 ran, were never queued, and
 * nothing else would ever look at them. Returns how many were added.
 */
export async function queueMissing(db: DbHandle, showId?: string): Promise<number> {
  try {
    const rows = await db
      .select({ id: applications.id })
      .from(applications)
      .where(showId ? eq(applications.showId, showId) : undefined)
      .orderBy(applications.submittedAt)
    const queued = await db.select({ id: sheetSyncs.applicationId }).from(sheetSyncs)
    const known = new Set(queued.map((r) => r.id))
    const missing = rows.filter((r) => !known.has(r.id))
    for (const r of missing) await ensureQueued(db, r.id)
    return missing.length
  } catch (err) {
    if (!tolerable(err, 'backfill')) throw err
    return 0
  }
}

/**
 * Counts by status and the last error, for /api/health. Counts and reasons
 * only: no shop names, no addresses, nothing a public endpoint should not
 * carry.
 */
export async function syncDiagnostics(db: DbHandle) {
  try {
    const rows = await db
      .select({ status: sheetSyncs.status, n: sql<number>`count(*)` })
      .from(sheetSyncs)
      .groupBy(sheetSyncs.status)
    const counts = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]))
    const [last] = await db
      .select({
        at: sheetSyncs.lastAttemptAt,
        detail: sheetSyncs.lastError,
        attempts: sheetSyncs.attempts,
        status: sheetSyncs.status,
      })
      .from(sheetSyncs)
      .where(ne(sheetSyncs.lastError, ''))
      .orderBy(desc(sheetSyncs.lastAttemptAt))
      .limit(1)
    return {
      counts,
      pending: Number(counts.pending ?? 0),
      failed: Number(counts.failed ?? 0),
      lastFailure: last ?? null,
    }
  } catch (err) {
    if (pgCode(err) !== MISSING_TABLE) throw err
    return { counts: {}, pending: 0, failed: 0, lastFailure: null, note: 'run drizzle/0003_sheet-syncs.sql' }
  }
}
