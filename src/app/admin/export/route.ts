import { NextResponse } from 'next/server'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { gatherShowRows } from '@/server/modules/sheets/gather'
import { SHEET_HEADERS, sheetValues } from '@/server/modules/sheets/row'

/**
 * Every application for the active show, as a CSV, on demand.
 *
 * The fourth place an application lives, and the only one that is not a
 * service somebody else runs. Drew asked for the data to exist in several
 * places so it can never be lost; the database, the staff notification and the
 * Sheet are three, and each of them is a system that could be misconfigured,
 * suspended or paid for by an account nobody can get into. A file on a laptop
 * has none of those failure modes. One click, before the jury sits, and again
 * after.
 *
 * It is the same field list as the Sheet and the notification, so all four
 * copies say the same thing in the same order.
 *
 * Behind the /admin password gate, which src/proxy.ts applies to
 * `/admin/:path*` and therefore to this route without it asking.
 */

export const dynamic = 'force-dynamic'

/** RFC 4180: quote everything, double an embedded quote. Excel and Sheets both
 *  read this, and quoting unconditionally means a description containing a
 *  comma, a newline or a quotation mark cannot shift the columns. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET() {
  const show = await activeShow()
  if (!show) {
    return NextResponse.json({ error: 'No active show.' }, { status: 404 })
  }

  const rows = await gatherShowRows(db, show.id)
  const body = [
    SHEET_HEADERS.map(csvCell).join(','),
    ...rows.map((r) => sheetValues(r).map(csvCell).join(',')),
  ].join('\r\n')

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(
    // A BOM, so Excel opens UTF-8 as UTF-8. Without it a shop name with an
    // accent in it arrives mangled, and these are people's business names.
    '﻿' + body,
    {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition':
          `attachment; filename="mermade-${show.slug}-applications-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    },
  )
}
