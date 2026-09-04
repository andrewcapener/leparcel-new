import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, sessionToken } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

async function signIn(fd: FormData) {
  'use server'
  const password = process.env.ADMIN_PASSWORD
  const next = String(fd.get('next') || '/admin/jury')
  const target = next.startsWith('/admin') ? next : '/admin/jury'
  if (!password) redirect(process.env.NODE_ENV !== 'production' ? target : '/admin/login?err=1')
  if (String(fd.get('password')) !== password) redirect(`/admin/login?err=1&next=${encodeURIComponent(target)}`)

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, await sessionToken(password!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect(target)
}

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string }>
}) {
  const sp = await searchParams
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 26 }}>
      <form action={signIn} style={{ width: 320 }}>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 28, marginBottom: 6 }}>
          Staff sign-in
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 20 }}>
          Mermade Market admin
        </p>
        <input type="hidden" name="next" value={sp.next ?? '/admin/jury'} />
        <label className="field" htmlFor="password">
          <span className="lb">Password</span>
          <input className="inp" id="password" name="password" type="password" autoFocus required />
          {sp.err && <span className="err">That password is not right.</span>}
        </label>
        <button className="btn" type="submit" style={{ marginTop: 14, width: '100%' }}>
          Sign in
        </button>
      </form>
    </div>
  )
}
