import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const diag: Record<string, unknown> = {
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    lastRequestError: (globalThis as Record<string, unknown>).__lastRequestError ?? null,
    // Names only, never values: which non-platform env vars this deployment
    // actually carries, so a typo'd or wrongly-scoped variable is visible.
    envNames: Object.keys(process.env)
      .filter((k) => !/^(VERCEL|NEXT_|NODE|AWS_|TURBO|PATH$|PWD$|HOME$|HOSTNAME$|PORT$|LANG|SHLVL|_)/.test(k))
      .sort(),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
  }
  try {
    const { db, schema } = await import('@/db')
    const count = async (t: typeof schema.shows | typeof schema.applications | typeof schema.bookings) =>
      Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0]!.n)
    diag.shows = await count(schema.shows)
    diag.applications = await count(schema.applications)
    diag.bookings = await count(schema.bookings)
  } catch (e) {
    diag.ok = false
    diag.dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return NextResponse.json(diag, { status: diag.ok ? 200 : 500 })
}
