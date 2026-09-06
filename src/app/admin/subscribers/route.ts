import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { subscribers } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'

/**
 * Everyone waiting to be told, as a CSV.
 *
 * While applications are shut, /apply says "join the list and we'll email you
 * the morning they open", and the home page and the pop-up say much the same.
 * Those addresses have been collecting in the subscribers table since the site
 * went up, and until now the only way to read them was a SQL client: the
 * promise was made on the site and could only be kept from the database.
 *
 * Sorted oldest first, because the person who signed up in July has been
 * waiting longest and should be at the top of the send.
 *
 * Same shape as the applications export: quoted RFC 4180, a BOM so Excel reads
 * UTF-8, Pacific times (CLAUDE.md rule 8). Behind the /admin gate, which
 * src/proxy.ts applies to `/admin/:path*` and so to this route without it
 * asking.
 */

export const dynamic = 'force-dynamic'

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET() {
  const rows = await db
    .select({
      email: subscribers.email,
      source: subscribers.source,
      createdAt: subscribers.createdAt,
    })
    .from(subscribers)
    .orderBy(asc(subscribers.createdAt))

  const body = [
    ['Email', 'Signed up from', 'When (PT)'].map(csvCell).join(','),
    ...rows.map((r) => [
      r.email,
      r.source,
      r.createdAt ? fmtDateTime(String(r.createdAt)) : '',
    ].map(csvCell).join(',')),
  ].join('\r\n')

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mermade-waiting-list-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
