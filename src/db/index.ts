import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

let url = process.env.DATABASE_URL ?? './mermade.db'

// Vercel's deployed filesystem is read-only, so the seeded demo db (built by
// `npm run setup` in vercel.json's buildCommand, bundled via
// outputFileTracingIncludes) is copied to /tmp where SQLite can write.
// /tmp is per-instance and ephemeral — acceptable only for the click-through
// demo; production is Supabase Postgres per docs/02-ARCHITECTURE.md.
if (process.env.VERCEL && !process.env.DATABASE_URL) {
  const tmp = '/tmp/mermade.db'
  if (!existsSync(tmp)) copyFileSync(join(process.cwd(), 'mermade.db'), tmp)
  url = tmp
}
const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { schema, sqlite }
