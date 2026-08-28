import { existsSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  const diag: Record<string, unknown> = {
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    cwd: process.cwd(),
    bundledDb: existsSync(join(process.cwd(), 'mermade.db')),
    tmpDb: existsSync('/tmp/mermade.db'),
  }
  try {
    const { db, schema } = await import('@/db')
    const rows = db.select().from(schema.shows).all()
    diag.showCount = rows.length
  } catch (e) {
    diag.ok = false
    diag.dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return NextResponse.json(diag)
}
