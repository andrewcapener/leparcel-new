import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? './mermade.db'

function open(path: string) {
  const d = new Database(path)
  // WAL needs to create -wal/-shm sidecars, so this throws on a read-only fs.
  d.pragma('journal_mode = WAL')
  d.pragma('foreign_keys = ON')
  return d
}

let sqlite: Database.Database
try {
  sqlite = open(url)
} catch (err) {
  // Read-only filesystem — the deployed Vercel function. The seeded demo db
  // (built by `npm run setup` in vercel.json's buildCommand, bundled via
  // outputFileTracingIncludes) is copied to /tmp where SQLite can write.
  // /tmp is per-instance and ephemeral — acceptable only for the click-through
  // demo; production is Supabase Postgres per docs/02-ARCHITECTURE.md.
  // Detection is by the failed open, not an env check: VERCEL=1 is also set
  // during builds, where the filesystem is writable and the seed must write
  // to the real file.
  if (process.env.DATABASE_URL) throw err
  const tmp = '/tmp/mermade.db'
  if (!existsSync(tmp)) copyFileSync(join(process.cwd(), 'mermade.db'), tmp)
  sqlite = open(tmp)
}

export const db = drizzle(sqlite, { schema })
export { schema, sqlite }
