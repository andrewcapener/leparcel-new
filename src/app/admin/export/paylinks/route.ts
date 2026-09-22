import { NextResponse } from 'next/server'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import {
  LINK_COLUMNS, linkValues, paymentRows, toCsv,
} from '@/server/modules/roster/payment-export'

export const dynamic = 'force-dynamic'

/**
 * Every accepted maker's own pay link, as a file to mail merge from.
 *
 * Seventy eight links were seventy eight presses of a copy button before
 * this. Nothing in here goes stale, so it is downloaded once and the merge
 * runs off it.
 *
 * Only makers still holding a space. A released booking's link still works
 * and putting it in a merge is how somebody gets invited to pay for a space
 * they no longer have.
 *
 * The link is a capability: whoever holds it can open that maker's invoice
 * and pay it. That is what makes it worth emailing and what makes this file
 * worth not forwarding.
 */
export async function GET() {
  const show = await activeShow()
  if (!show) return NextResponse.json({ error: 'No active show.' }, { status: 404 })

  const rows = (await paymentRows(db, show.id, siteUrl()))
    .filter((r) => r.status !== 'Released' && r.payLink !== '')
  const body = toCsv(LINK_COLUMNS, rows.map(linkValues))
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse('﻿' + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="mermade-${show.slug}-pay-links-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
