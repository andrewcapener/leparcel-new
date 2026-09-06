import { NextResponse, type NextRequest } from 'next/server'
import { MAKER_COOKIE } from '@/lib/makerAuth'

/** Sign out. POST only: a GET would let any page on the internet sign a maker
 *  out by embedding an image. */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const to = req.nextUrl.clone()
  to.pathname = '/account'
  to.search = '?signedout=1'
  const res = NextResponse.redirect(to, { status: 303 })
  res.cookies.set(MAKER_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
