import { NextResponse, type NextRequest } from 'next/server'
import { MAKER_COOKIE, SESSION_MAX_AGE_S, readLinkToken, signSession } from '@/lib/makerAuth'

/**
 * The other end of the emailed link.
 *
 * Verifies the token, sets the session cookie, and sends the maker to their
 * account. A token that is expired, edited or not ours lands on the same page
 * with `?expired=1`, which offers them another link rather than an error: a
 * maker who clicked a twenty-minute-old email has done nothing wrong and does
 * not need to be told off about it.
 *
 * A GET that changes state is normally a smell. Here it is unavoidable, because
 * the thing being clicked is a link in an email, and it is safe because the
 * token is the credential: there is nothing to forge from another site, and no
 * ambient authority to ride on.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const email = await readLinkToken(token)
  const to = req.nextUrl.clone()
  to.pathname = '/account'
  to.search = email ? '' : '?expired=1'

  const res = NextResponse.redirect(to)
  if (email) {
    res.cookies.set(MAKER_COOKIE, await signSession(email), {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: SESSION_MAX_AGE_S,
    })
  }
  return res
}
