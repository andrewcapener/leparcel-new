import { NextResponse, type NextRequest } from 'next/server'
import { PREVIEW_COOKIE } from '@/lib/preview'
import { checkRehearsalToken } from '@/lib/rehearsal'

/**
 * Redeem a rehearsal link: check the signature, set the preview cookie, and
 * put the person on the form.
 *
 * Public by design. The token is the credential, and it buys exactly one
 * thing, the same cookie /api/preview issues to staff. See src/lib/rehearsal.ts
 * for what that is worth to somebody who should not have it.
 *
 * The cookie outlives the token on purpose: the link is how you get in, not
 * something anyone should have to hold on to. Once it is spent, the browser
 * behaves like a member of staff who clicked "The site at launch", for the
 * same twelve hours.
 */
export const dynamic = 'force-dynamic'

const COOKIE_MAX_AGE_S = 12 * 60 * 60

function refused(message: string): NextResponse {
  return new NextResponse(message, {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const check = await checkRehearsalToken(token)

  if (!check.ok) {
    // Say which of the two it is, because they need different answers: an
    // expired link wants a new one from Drew, a bad one wants a closer look
    // at how it was pasted.
    if (check.reason === 'expired') {
      return refused('That rehearsal link has expired. Ask for a fresh one.')
    }
    return refused('That rehearsal link is not valid. Check it copied whole, including everything after the "=".')
  }

  const res = NextResponse.redirect(new URL('/apply', req.nextUrl.origin))
  res.cookies.set(PREVIEW_COOKIE, '1', {
    httpOnly: false,   // the banner reads it to say the preview is on
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  })
  return res
}
