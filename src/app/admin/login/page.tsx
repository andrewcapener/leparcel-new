import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, adminPassword, sessionToken } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

async function signIn(fd: FormData) {
  'use server'
  const password = adminPassword()
  const next = String(fd.get('next') || '/admin/jury')
  const target = next.startsWith('/admin') ? next : '/admin/jury'
  // No password configured. Locally that is the open-door dev default; in
  // production it is a misconfigured deployment, and saying so is the honest
  // answer to the question the old length-leak was trying to answer.
  if (!password) redirect(process.env.NODE_ENV !== 'production' ? target : '/admin/login?err=unset')
  // Trimmed on both sides: password managers and mobile keyboards append a
  // space often enough that it is worth not failing on it.
  const typed = String(fd.get('password')).trim()
  if (typed !== password) {
    // Only ever that it was wrong. This used to carry both the typed length
    // and the configured length back in the query string as a debugging aid,
    // which put the exact length of the production admin password into the
    // URL bar, browser history, the referrer on any outbound click, and every
    // access log in front of this app, on demand, to anyone. `empty` is the
    // one distinction worth keeping: it separates a password manager that
    // filled nothing from a password that is simply wrong.
    redirect(
      `/admin/login?err=${typed.length === 0 ? 'empty' : '1'}`
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
  searchParams: Promise<{ err?: string; next?: string }>
}) {
  const sp = await searchParams
  return (
    <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 26 }}>
      <form action={signIn} style={{ width: 320 }}>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 'var(--t-d3)', marginBottom: 6 }}>
          Staff sign-in
        </h1>
        <p style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)', marginBottom: 20 }}>
          Mermade Market admin
        </p>
        <input type="hidden" name="next" value={sp.next ?? '/admin/jury'} />
        <label className="field" htmlFor="password">
          <span className="lb">Password</span>
          <input className="inp" id="password" name="password" type="password" autoFocus required />
          {sp.err && (
            <span className="err" role="alert">
              {sp.err === 'empty' ? 'Enter the staff password.'
                : sp.err === 'unset' ? 'This deployment has no staff password set, so no password will work. Set ADMIN_PASSWORD and redeploy.'
                : 'That password is not right.'}
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
