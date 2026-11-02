import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * How long the database link actually takes, from inside the deployment.
 *
 * Drew, 2 November: "the site is loading VERY slow."
 *
 * Nothing on this deployment could answer the first question that matters,
 * which is whether a slow page is slow because of what it asks for or
 * because every question costs a round trip to another region. /api/health
 * runs a dozen queries and reports one number, so it cannot tell those
 * apart, and a page cannot either.
 *
 * This runs the cheapest query there is, twice. The first pays whatever the
 * connection costs if the pool had gone idle; the second is the round trip
 * alone. One slow and one fast means the connection is being re-established
 * and the fix is the pool. Both slow means the link itself is slow, which is
 * a region problem and no amount of query tidying will help. Both fast means
 * the page is at fault and the queries it runs are worth counting.
 *
 * No data, no names, no counts: two durations and the region this ran in.
 */
export async function GET() {
  const t0 = Date.now()
  await db.execute(sql`select 1`)
  const first = Date.now() - t0

  const t1 = Date.now()
  await db.execute(sql`select 1`)
  const second = Date.now() - t1

  /* Ten in a row, to separate a steady cost from one unlucky query. */
  const t2 = Date.now()
  for (let i = 0; i < 10; i++) await db.execute(sql`select 1`)
  const tenSerial = Date.now() - t2

  /* The same ten at once. On a link where each question costs a round trip,
     the gap between these two is what parallelising a page would win. */
  const t3 = Date.now()
  await Promise.all(Array.from({ length: 10 }, () => db.execute(sql`select 1`)))
  const tenParallel = Date.now() - t3

  return NextResponse.json({
    firstMs: first,
    secondMs: second,
    tenSerialMs: tenSerial,
    tenParallelMs: tenParallel,
    region: process.env.VERCEL_REGION ?? 'local',
  }, { headers: { 'cache-control': 'no-store' } })
}
