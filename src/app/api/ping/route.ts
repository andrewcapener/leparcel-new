import { NextResponse } from 'next/server'
import { desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Where the time goes on the database link, from inside the deployment.
 *
 * Drew, 2 November: "the site is loading VERY slow."
 *
 * The first version of this ran twenty-two trivial queries and hung past
 * seventy seconds in iad1 while /api/health, which runs a dozen real ones,
 * answered in about a second. That is not a slow link, it is one path that
 * stalls and another that does not, and the only way to tell them apart is
 * to time each shape separately and let none of them wait for ever.
 *
 * So: every probe is raced against a short timeout and reports its own
 * number or the word timeout. Nothing here can hang the route, which matters
 * because a public route that hangs holds a function open for a minute and
 * makes the thing it was meant to diagnose worse.
 *
 * No data, no names, no counts: durations and a region.
 */
const LIMIT_MS = 4_000

async function timed<T>(fn: () => Promise<T>): Promise<number | 'timeout' | 'error'> {
  const t = Date.now()
  try {
    const out = await Promise.race([
      fn().then(() => 'ok' as const),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), LIMIT_MS)),
    ])
    return out === 'timeout' ? 'timeout' : Date.now() - t
  } catch {
    return 'error'
  }
}

export async function GET() {
  /* The shape every page uses. */
  const selectCold = await timed(() => db.select().from(shows).orderBy(desc(shows.startsOn)).limit(1))
  const selectWarm = await timed(() => db.select().from(shows).orderBy(desc(shows.startsOn)).limit(1))
  /* The shape /api/ping used, and the one that hung. */
  const rawExecute = await timed(() => db.execute(sql`select 1`))
  /* Five of the ordinary shape in a row: a page's worth of round trips. */
  const fiveSerial = await timed(async () => {
    for (let i = 0; i < 5; i++) await db.select().from(shows).limit(1)
  })
  /* And the same five at once, which is what parallelising a page would buy. */
  const fiveParallel = await timed(() =>
    Promise.all(Array.from({ length: 5 }, () => db.select().from(shows).limit(1))))

  return NextResponse.json({
    selectCold, selectWarm, rawExecute, fiveSerial, fiveParallel,
    region: process.env.VERCEL_REGION ?? 'local',
    /* Which region the database is in, and nothing else about it. A round
       trip of 65ms is two coasts; knowing which two is what decides where
       this function should run. Supabase names the region in the pooler
       host, so it comes out of the host and the host itself never does:
       the project reference beside it identifies the database (rule 9). */
    dbRegion: (process.env.DATABASE_URL ?? '').match(/(?:aws|gcp)-\d+-([a-z]+-[a-z]+-\d+)/)?.[1] ?? 'unknown',
  }, { headers: { 'cache-control': 'no-store' } })
}
