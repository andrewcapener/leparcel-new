/**
 * Push every application the Google Sheet is still missing.
 *
 * This is the one command that fixes any outage. It queues applications that
 * were never recorded (submitted before the Sheet was configured, or before
 * migration 0003 ran), then posts everything that is pending or failed.
 *
 *   npx tsx scripts/sync-sheets.ts                 # the active show, then everything unsent
 *   npx tsx scripts/sync-sheets.ts --show fall-2026
 *   npx tsx scripts/sync-sheets.ts --all-shows     # queue every application in the database
 *   npx tsx scripts/sync-sheets.ts --id <application id>
 *   npx tsx scripts/sync-sheets.ts --due-only      # respect the retry backoff (for a cron)
 *   npx tsx scripts/sync-sheets.ts --dry-run       # list, post nothing
 *
 * Safe to run as many times as you like. The sheet row is keyed on the
 * application id, so a re-send updates the row it already wrote rather than
 * appending a second one.
 *
 * Needs DATABASE_URL plus whichever transport is configured: the service
 * account (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY,
 * SHEETS_SPREADSHEET_ID) or the webhook (SHEETS_WEBHOOK_URL,
 * SHEETS_WEBHOOK_SECRET). Same variables the deployed app reads.
 */
import { eq } from 'drizzle-orm'
import { db, sqlClient } from '../src/db'
import { shows } from '../src/db/schema'
import { syncApplication } from '../src/server/modules/sheets/sync'
import { selectTransport } from '../src/server/modules/sheets/transport'
import { queueMissing, unsentApplicationIds, readState } from '../src/server/modules/sheets/state'

/** Apps Script is rate limited and the Sheets API is not fast. One at a time,
 *  with a breath between, is well inside every quota and does 100 in a minute. */
const PAUSE_MS = 250

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}
const has = (name: string) => process.argv.includes(`--${name}`)

async function main(): Promise<number> {
  const dryRun = has('dry-run')
  const transport = selectTransport()
  if (!transport && !dryRun) {
    console.error('No Sheets transport is configured, so there is nowhere to post.')
    console.error('Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY + SHEETS_SPREADSHEET_ID,')
    console.error('or SHEETS_WEBHOOK_URL + SHEETS_WEBHOOK_SECRET. See README.md.')
    return 1
  }
  if (transport) console.log(`Transport: ${transport.describe}`)

  let ids: string[]
  const one = arg('id')
  if (one) {
    ids = [one]
  } else {
    if (has('all-shows')) {
      const added = await queueMissing(db)
      console.log(`Queued ${added} application${added === 1 ? '' : 's'} that had no sync record.`)
    } else {
      const wanted = arg('show')
      const show = wanted
        ? (await db.query.shows.findFirst({ where: eq(shows.slug, wanted) })
          ?? await db.query.shows.findFirst({ where: eq(shows.id, wanted) }))
        : await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
      if (!show) {
        console.error(wanted ? `No show "${wanted}".` : 'No active show. Try --all-shows.')
        return 1
      }
      console.log(`Show: ${show.name} (${show.slug})`)
      const added = await queueMissing(db, show.id)
      console.log(`Queued ${added} application${added === 1 ? '' : 's'} that had no sync record.`)
    }
    ids = await unsentApplicationIds(db, { dueOnly: has('due-only') })
  }

  console.log(`${ids.length} to send.`)
  if (ids.length === 0) return 0

  if (dryRun) {
    // Ids and status only. A dry run gets pasted into a chat, and a maker's
    // name, email and phone have no business being there (CLAUDE.md rule 9).
    for (const id of ids) {
      const s = await readState(db, id)
      console.log(`  ${id}  ${s?.status ?? 'unqueued'}  attempts=${s?.attempts ?? 0}`)
    }
    console.log('Dry run: nothing was posted. Anything not already recorded was queued,')
    console.log('which is harmless and is what makes the real run pick it up.')
    return 0
  }

  let sent = 0
  let queued = 0
  let failed = 0
  for (const [i, id] of ids.entries()) {
    // A person waiting on a command can wait longer than a maker waiting on a
    // form, so the timeout here is generous.
    const res = await syncApplication(db, id, { timeoutMs: 20_000, notify: false })
    if (res.outcome === 'sent') sent++
    else if (res.outcome === 'queued') { queued++; console.error(`  ↻ ${id}: ${res.state.lastError}`) }
    else if (res.outcome === 'failed') { failed++; console.error(`  ✗ ${id}: ${res.state.lastError}`) }
    else console.error(`  ? ${id}: ${res.outcome}`)
    if (i % 10 === 9) console.log(`  ${i + 1}/${ids.length}`)
    if (i < ids.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  console.log(`Sent ${sent}. Still queued ${queued}. Failed ${failed}.`)
  return sent === ids.length ? 0 : 1
}

main()
  .then(async (code) => { await sqlClient.end(); process.exit(code) })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : String(err))
    await sqlClient.end()
    process.exit(1)
  })
