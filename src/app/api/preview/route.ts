import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, isValidSession } from '@/lib/adminAuth'
import { PREVIEW_COOKIE } from '@/lib/preview'

/**
 * Turn the launch preview on and off. Staff only: the cookie changes what
 * every visitor-facing page says about the application window, so a stranger
 * must not be able to set it by visiting a URL.
 *
 * It is a session cookie on purpose. Close the browser and the preview is
 * gone, which is the right default for a thing nobody should leave on.
 */
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
    })
  } else {
    res.cookies.set(PREVIEW_COOKIE, '', { path: '/', maxAge: 0 })
  }
  return res
}
