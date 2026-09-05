import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, adminPassword, isValidSession } from '@/lib/adminAuth'

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()

  if (process.env.NODE_ENV === 'production' && !adminPassword()) {
    // Naming the environment matters: the usual cause is a preview or
    // branch deployment that never got the variable, which from the outside
    // is indistinguishable from the admin being broken.
    const envName = process.env.VERCEL_ENV ?? 'this deployment'
    return new NextResponse(
      `Admin is locked: neither ADMIN_PASSWORD nor ADMIN_PASS is set for ${envName}. `
      + 'Set one in the hosting environment and redeploy.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    )
  }

  const ok = await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (ok) return NextResponse.next()

  const login = req.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(login)
}

export const config = { matcher: '/admin/:path*' }
