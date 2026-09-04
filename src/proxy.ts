import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, adminPassword, isValidSession } from '@/lib/adminAuth'

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()

  if (process.env.NODE_ENV === 'production' && !adminPassword()) {
    return new NextResponse('Admin is locked: ADMIN_PASSWORD is not configured.', { status: 503 })
  }

  const ok = await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)
  if (ok) return NextResponse.next()

  const login = req.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(login)
}

export const config = { matcher: '/admin/:path*' }
