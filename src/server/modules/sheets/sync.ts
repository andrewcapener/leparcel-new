/**
 * Sync an application to the owner's Google Sheet.
 *
 * The pieces: row.ts maps an application to a flat row (pure), gather.ts reads
 * it out of the database, transport.ts posts it (Sheets API, else Apps Script,
 * else nothing), retry.ts decides what happens after a failure (pure), and
 * state.ts remembers. This file is the only thing that calls all five.
 *
 * Two promises hold everywhere in here:
 *
 *   1. A submission never fails because of the Sheet. The application is
 *      already committed before this runs; Google being down, slow, or
 *      misconfigured costs a sheet row and nothing else. Nothing throws.
 *   2. A row is never silently lost. Every application is queued in
 *      sheet_syncs first, so anything that did not land is still listed as
 *      pending, retried by `npx tsx scripts/sync-sheets.ts`, and counted at
 *      /api/health.
 *
 * With neither transport configured this is a silent no-op, exactly the way
 * email behaves without RESEND_API_KEY.
 */
import { randomUUID } from 'crypto'
import type { db as Db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { gatherRow } from './gather'
import type { SheetRow } from './row'
import { selectTransport, sheetsConfigured, type Transport } from './transport'
import { ensureQueued, recordAttempt } from './state'
import { MAX_ATTEMPTS, type SyncState } from './retry'

export type DbHandle = typeof Db

export type SyncOutcome =
  | { outcome: 'skipped' }                          // no transport configured
  | { outcome: 'missing' }                          // no such application
  | { outcome: 'sent'; state: SyncState }
  | { outcome: 'queued'; state: SyncState }         // failed, will be retried
  | { outcome: 'failed'; state: SyncState }         // gave up, needs a person

export { sheetsConfigured }

/**
 * Post one row and fold the result into sheet_syncs. Never throws.
 *
 * `notify` writes a line into the email outbox, which /admin/outbox counts
 * under "Failed" on its front page. It fires on the first failure and again if
 * the sync gives up, and never in between, so an outage costs two rows rather
 * than one per retry.
 */
export async function syncRow(
  db: DbHandle,
  row: SheetRow,
  opts: { timeoutMs?: number; notify?: boolean; transport?: Transport } = {},
): Promise<SyncOutcome> {
  const transport = opts.transport ?? selectTransport()
  if (!transport) return { outcome: 'skipped' }

  await ensureQueued(db, row.applicationId)

  const result = await transport.send(row, { timeoutMs: opts.timeoutMs })
  const state = await recordAttempt(db, row.applicationId, transport.name, result, new Date().toISOString())

  if (result.ok) return { outcome: 'sent', state }

  console.error(
    `[sheets] ${transport.name} attempt ${state.attempts} failed for application `
    + `${row.applicationId}: ${result.detail}`,
  )

  const gaveUp = state.status === 'failed'
  if (opts.notify !== false && (gaveUp || state.attempts === 1)) {
    await notifyFailure(db, row, result.detail, state, transport)
  }
  return { outcome: gaveUp ? 'failed' : 'queued', state }
}

/** One application, gathered and posted. Never throws. */
export async function syncApplication(
  db: DbHandle,
  applicationId: string,
  opts: { timeoutMs?: number; notify?: boolean; transport?: Transport } = {},
): Promise<SyncOutcome> {
  try {
    if (!opts.transport && !sheetsConfigured()) return { outcome: 'skipped' }
    // Queue first, then read. If the process dies between here and the POST,
    // the application is still listed as pending and the script will find it.
    await ensureQueued(db, applicationId)
    const row = await gatherRow(db, applicationId)
    if (!row) return { outcome: 'missing' }
    return await syncRow(db, row, opts)
  } catch (err) {
    // The belt on top of the braces: nothing in this module is worth failing a
    // submission for.
    console.error('[sheets] sync threw, which it should not:', String(err).slice(0, 300))
    return { outcome: 'queued', state: { status: 'pending', attempts: 0, lastError: '', lastAttemptAt: null, nextAttemptAt: null, sentAt: null } }
  }
}

/**
 * Make a failure visible. Three places, in increasing order of how likely
 * someone is to see it: the server log (redacted), the sheet_syncs row (which
 * /api/health counts and quotes), and a row in the email outbox, which
 * /admin/outbox shows under "Failed" on its front page.
 *
 * The notice carries the application id and its admin link. Never the maker's
 * email, phone, or anything else out of the row (CLAUDE.md rule 9).
 */
async function notifyFailure(
  db: DbHandle, row: SheetRow, detail: string, state: SyncState, transport: Transport,
): Promise<void> {
  const gaveUp = state.status === 'failed'
  try {
    await db.insert(emailOutbox).values({
      id: randomUUID(),
      toEmail: process.env.CONTACT_TO ?? 'hello@mermademarket.com',
      subject: gaveUp
        ? `Google Sheet sync gave up on application ${row.applicationId}`
        : `Google Sheet sync failed for application ${row.applicationId}`,
      body:
        'The application saved normally. Only the Google Sheet row is missing.\n\n'
        + `Application: ${row.adminLink}\n`
        + `Transport: ${transport.describe}\n`
        + `Attempt: ${state.attempts} of ${MAX_ATTEMPTS}\n`
        + `What came back: ${detail}\n\n`
        + (gaveUp
          ? 'It will not retry on its own. Fix the cause, then run:\n'
          : 'It stays queued and will be retried. To push it now, run:\n')
        + '  npx tsx scripts/sync-sheets.ts\n\n'
        + 'That is safe to run as many times as you like: the sheet row is keyed '
        + 'on the application id, so a re-send updates the row rather than adding '
        + 'a second one.',
      template: 'sheets_sync_failed',
      deliveryStatus: 'failed',
      deliveryDetail: detail,
    })
  } catch (err) {
    console.error('[sheets] could not record the failure in the outbox:', String(err).slice(0, 200))
  }
}
