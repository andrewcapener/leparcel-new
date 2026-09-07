import { NextResponse, type NextRequest } from 'next/server'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { previews } from '@/server/modules/email/previews'
import { photoUploads } from '@/server/modules/uploads/config'

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
/**
 * The origin the maker photographs are served from, or nothing.
 *
 * Read off the same configuration the uploads use, so a project change moves
 * this with it and nobody has to remember a hostname in two places.
 */
function bucketOrigin(): string {
  try {
    const cfg = photoUploads()
    return cfg ? new URL(cfg.baseUrl).origin : ''
  } catch {
    return ''
  }
}

/**
 * The origin the emails' own images are written against.
 *
 * Same source as the urls in the mail itself, so the two cannot drift: if
 * SITE_URL changes, the allowance follows it in the same deploy.
 */
function siteOrigin(): string {
  try { return new URL(siteUrl()).origin } catch { return '' }
}

/* The outward emails link Oswald and Figtree from Google. Blocking them does
   not break the preview, it just renders it in a face no recipient with Apple
   Mail will see, which makes the preview a worse answer to the question it
   exists for. The stylesheet and the font files are two different hosts. */
const FONT_CSS = 'https://fonts.googleapis.com'
const FONT_FILES = 'https://fonts.gstatic.com'

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
      //
      // Images are allowed from this origin because the broadcast is mostly
      // photographs and a preview that cannot show them is not a preview. It
      // stays 'self' and data: only: the pictures are ours, out of
      // public/photos, and the maker photographs come from our own storage
      // bucket, whose host is named rather than assumed: without it the
      // internal notice previewed with every thumbnail broken, which is the
      // one part of that email somebody opens it to look at. Still no
      // third-party origin, and still nothing a maker typed can point this
      // frame anywhere, because every src is built by us.
      'Content-Security-Policy': [
        `default-src 'none'`,
        `style-src 'unsafe-inline' ${FONT_CSS}`,
        `font-src ${FONT_FILES}`,
        /* Every origin the pictures can legitimately come from, named.
           'self' alone was not enough and that is the bug: an email's
           <img> is an ABSOLUTE url built from SITE_URL, because a mail
           client has no origin to be relative to. So the pictures say
           https://mermademarket.com/photos/... while 'self' means
           whichever host you happen to have the admin open on. On the
           bare domain those agree and everything loads; on a Vercel
           deployment url they do not, every image is cross origin, and
           the preview renders with all of them broken. Naming the site
           origin makes the preview work wherever it is being viewed. */
        ['img-src', "'self'", 'data:', siteOrigin(), bucketOrigin()]
          .filter(Boolean).join(' '),
      ].join('; '),
    },
  })
}
