/**
 * Applies drizzle/*.sql to whatever DATABASE_URL points at, in filename order,
 * exactly once each. Runs as the first half of `npm run build`, which means
 * every Vercel deploy brings the database level with the code it is shipping.
 *
 * Why this exists: schema and content both live in the database, and until now
 * nothing applied either to production. A migration file was a note to a human
 * who had to remember to paste it into the Supabase SQL editor. Twice that did
 * not happen: the `capacity` column shipped in code before it existed in the
 * database and took /apply down, and priority placement sat in a file for a day
 * while the form kept not showing it.
 *
 * Baseline: a database that already has tables but no ledger was built by
 * `drizzle-kit push`, so the migrations that predate this file are recorded as
 * applied without being run. 0000_init would fail against a live schema and the
 * older ALTERs are not repeatable. That list is fixed and explicit on purpose:
 * baselining "every file present" would have swept up 0005 on its very first
 * run against production, and 0005 is the one that has to run.
 *
 * New migrations must be written idempotently anyway, since a file can be
 * re-run against a database restored from an older snapshot.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const DIR = join(process.cwd(), 'drizzle')
const LEDGER = '__migrations'

/**
 * What a `drizzle-kit push` database already contains. Everything here shipped
 * before the ledger existed. Never add to this list: a migration written after
 * this point must run, and 0005 restates 0004's column idempotently so a
 * database that never got 0004 is still brought level.
 */
const BASELINE = [
  '0000_init.sql',
  '0001_requested-spaces.sql',
  '0002_addons-and-loadin.sql',
  '0003_sheet-syncs.sql',
  '0004_addon-capacity.sql',
]

/** Every .sql file, in the order their numeric prefixes put them. */
function files(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    // A build without a database is a legitimate thing (a preview of a static
    // change, someone's first checkout). Say so and let the build carry on.
    console.warn('[migrate] DATABASE_URL is not set. Skipping migrations.')
    return
  }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 })
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(LEDGER)} (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`

    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM ${sql(LEDGER)}`).map((r) => r.name),
    )

    if (applied.size === 0) {
      const [{ exists }] = await sql<{ exists: boolean }[]>`
        SELECT to_regclass('public.shows') IS NOT NULL AS exists`
      if (exists) {
        for (const name of BASELINE) {
          await sql`INSERT INTO ${sql(LEDGER)} (name) VALUES (${name}) ON CONFLICT DO NOTHING`
          applied.add(name)
        }
        console.log(`[migrate] existing database: baselined ${BASELINE.length} migration(s).`)
      }
    }

    let ran = 0
    for (const name of files()) {
      if (applied.has(name)) continue
      const body = readFileSync(join(DIR, name), 'utf8')
      console.log(`[migrate] applying ${name}`)
      // One transaction per file: a migration lands whole or not at all.
      await sql.begin(async (tx) => {
        await tx.unsafe(body)
        await tx`INSERT INTO ${tx(LEDGER)} (name) VALUES (${name})`
      })
      ran += 1
    }
    console.log(ran ? `[migrate] applied ${ran} migration(s).` : '[migrate] up to date.')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  // A migration that fails is not survivable: the build that follows would ship
  // code against a schema it does not have, which is the exact outage this file
  // was written to stop. Fail loudly and leave the previous deploy serving.
  console.error('[migrate] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
