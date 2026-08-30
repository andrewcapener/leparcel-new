import { copyFileSync, existsSync, renameSync } from 'fs'
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

function connect(): Database.Database {
  try {
    return open(url)
  } catch (err) {
    // Read-only filesystem — the deployed Vercel function. The seeded demo db
    // (built by `npm run setup` in vercel.json's buildCommand, bundled via
    // outputFileTracingIncludes) is copied to /tmp where SQLite can write.
    // Staged copy + rename so a half-written file can never be opened.
    // /tmp is per-instance and ephemeral: acceptable only for the click-through
    // demo; production is Supabase Postgres per docs/02-ARCHITECTURE.md.
    if (process.env.DATABASE_URL) throw err
    const tmp = '/tmp/mermade.db'
    if (!existsSync(tmp)) {
      const staging = `${tmp}.staging-${process.pid}-${Date.now()}`
      copyFileSync(join(process.cwd(), 'mermade.db'), staging)
      renameSync(staging, tmp)
    }
    return open(tmp)
  }
}

// Connect lazily, on first use. An ESM module that throws during evaluation
// stays failed for the life of the process, so an eager connect turns one
// transient cold-start error into an instance that serves 500s until it is
// recycled. Lazy, an error surfaces on the request that hit it and the next
// request simply tries again.
let conn: Database.Database | undefined
const lazySqlite = new Proxy({} as Database.Database, {
  get(_target, prop) {
    conn ??= connect()
    const value = conn[prop as keyof Database.Database]
    return typeof value === 'function' ? (value as CallableFunction).bind(conn) : value
  },
})

export const db = drizzle(lazySqlite, { schema })
export const sqlite = lazySqlite
export { schema }
