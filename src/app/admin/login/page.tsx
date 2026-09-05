import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, adminPassword, sessionToken } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

async function signIn(fd: FormData) {
  'use server'
  const password = adminPassword()
  const next = String(fd.get('next') || '/admin/jury')
  const target = next.startsWith('/admin') ? next : '/admin/jury'
  if (!password) redirect(process.env.NODE_ENV !== 'production' ? target : '/admin/login?err=1')
  // Trimmed on both sides: password managers and mobile keyboards append a
  // space often enough that it is worth not failing on it.
  const typed = String(fd.get('password')).trim()
  if (typed !== password) {
    // Carry both lengths back. A mismatch there means the password being
    // typed is simply not the one configured, which is the difference
    // between "I need the right password" and "the admin is broken" — and
    // that difference is otherwise invisible from the outside.
    redirect(
      `/admin/login?err=1&len=${typed.length}&want=${password.length}`
      + `&next=${encodeURIComponent(target)}`,
    )
  }

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
  searchParams: Promise<{ err?: string; next?: string; len?: string; want?: string }>
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
          {sp.err && (
            <span className="err">
              That password is not right.
              {sp.len && sp.want && sp.len !== sp.want && (
                <> You typed {sp.len} characters; this deployment expects {sp.want}.</>
              )}
            </span>
          )}
        </label>
        <button className="btn" type="submit" style={{ marginTop: 14, width: '100%' }}>
          Sign in
        </button>
      </form>
    </div>
  )
}
