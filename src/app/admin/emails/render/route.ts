import { NextResponse, type NextRequest } from 'next/server'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { previews } from '@/server/modules/email/previews'

/**
 * One email, as itself, for the iframe on /admin/emails.
 *
 * It is served from its own route rather than inlined into the page because an
 * email is a whole document with its own <body> and its own background, and
 * dropping that into the admin would mean two documents fighting over one page.
 * An iframe gives it the isolation a mail client would.
 *
 * Behind the /admin gate, which src/proxy.ts applies to `/admin/:path*` and so
 * to this route without it asking.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const show = await activeShow()
  if (!show) return new NextResponse('No active show.', { status: 404 })

  const id = req.nextUrl.searchParams.get('id')
  const found = previews(show, siteUrl()).find((p) => p.id === id)
  if (!found) return new NextResponse('No such email.', { status: 404 })

  return new NextResponse(found.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // It is our own markup, but it is markup built from data, and it is
      // rendered in a frame inside the admin. Nothing in it needs to run.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  })
}
