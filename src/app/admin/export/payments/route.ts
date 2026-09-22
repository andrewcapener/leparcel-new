import { NextResponse } from 'next/server'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import {
  PAYMENT_COLUMNS, paymentRows, paymentValues, toCsv,
} from '@/server/modules/roster/payment-export'

export const dynamic = 'force-dynamic'

/**
 * Who has paid, what, and by which of the four routes, as a file.
 *
 * The tab the girls watch all day. Downloaded again whenever they want it
 * fresh: this is a snapshot, not a feed, and the roster screen is the live
 * answer. Behind the /admin gate, which src/proxy.ts applies to
 * `/admin/:path*` and therefore to this route without it asking.
 *
 * It carries the pay links too, so a maker who has not paid can be chased
 * from the same row rather than by going back to the other file.
 */
export async function GET() {
  const show = await activeShow()
  if (!show) return NextResponse.json({ error: 'No active show.' }, { status: 404 })

  const rows = await paymentRows(db, show.id, siteUrl())
  const body = toCsv(PAYMENT_COLUMNS, rows.map(paymentValues))
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse('﻿' + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="mermade-${show.slug}-payments-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
