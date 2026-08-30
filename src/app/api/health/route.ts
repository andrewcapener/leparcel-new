import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  const bundled = join(process.cwd(), 'mermade.db')
  const diag: Record<string, unknown> = {
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    cwd: process.cwd(),
    hasDatabaseUrlEnv: Boolean(process.env.DATABASE_URL),
    bundledDb: existsSync(bundled),
    tmpDb: existsSync('/tmp/mermade.db'),
    lastRequestError: (globalThis as Record<string, unknown>).__lastRequestError ?? null,
  }
  if (diag.bundledDb) {
    const st = statSync(bundled)
    diag.bundledDbSize = st.size
    diag.bundledDbMtime = st.mtime.toISOString()
    try {
      const { default: Database } = await import('better-sqlite3')
      const raw = new Database(bundled, { readonly: true })
      diag.bundledTables = raw
        .prepare("select name from sqlite_master where type='table' order by name")
        .all()
        .map((r) => (r as { name: string }).name)
      for (const t of ['shows', 'applications', 'bookings']) {
        if ((diag.bundledTables as string[]).includes(t)) {
          diag[`bundled_${t}`] = (raw.prepare(`select count(*) c from ${t}`).get() as { c: number }).c
        }
      }
      raw.close()
    } catch (e) {
      diag.bundledReadError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    }
  }
  try {
    const { db, schema } = await import('@/db')
    diag.appDbShowCount = db.select().from(schema.shows).all().length
  } catch (e) {
    diag.ok = false
    diag.appDbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return NextResponse.json(diag)
}
