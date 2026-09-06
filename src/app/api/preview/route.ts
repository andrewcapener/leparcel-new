import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidSession } from '@/lib/adminAuth'
import { PREVIEW_COOKIE } from '@/lib/preview'

/**
 * Turn the launch preview on and off. Staff only: the cookie changes what
 * every visitor-facing page says about the application window, so a stranger
 * must not be able to set it by visiting a URL.
 *
 * It used to be a session cookie, on the reasoning that a thing nobody should
 * leave on ought to switch itself off. In practice it switched off in the
 * middle of a rehearsal, twice, and the failure reads as a broken form:
 * "Applications are not open for this show" on the upload and again on
 * submit, with nothing on screen to say the preview had lapsed. So it lasts
 * twelve hours now, which covers an evening of testing and still expires by
 * itself, and the banner on every page says it is on with a link to turn it
 * off. Long enough to be useful, short enough that it cannot quietly outlive
 * the window it is standing in for.
 */
const PREVIEW_MAX_AGE_S = 12 * 60 * 60

export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value))) {
    return new NextResponse('Staff only. Sign in at /admin/login first.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const on = req.nextUrl.searchParams.get('on') !== '0'
  const to = req.nextUrl.searchParams.get('to') ?? '/'
  // Only ever back into this site.
  const dest = to.startsWith('/') && !to.startsWith('//') ? to : '/'

  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin))
  if (on) {
    res.cookies.set(PREVIEW_COOKIE, '1', {
      httpOnly: false,   // the banner reads it to say the preview is on
      sameSite: 'lax',
      path: '/',
      maxAge: PREVIEW_MAX_AGE_S,
    })
  } else {
    res.cookies.set(PREVIEW_COOKIE, '', { path: '/', maxAge: 0 })
  }
  return res
}
