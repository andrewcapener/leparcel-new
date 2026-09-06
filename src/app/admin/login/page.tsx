import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, adminConfigured, sessionToken, staffForPassword } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

async function signIn(fd: FormData) {
  'use server'
  const next = String(fd.get('next') || '/admin/jury')
  const target = next.startsWith('/admin') ? next : '/admin/jury'
  // Nobody configured. Locally that is the open-door dev default; in
  // production it is a misconfigured deployment, and saying so is the honest
  // answer to the question the old length-leak was trying to answer.
  if (!adminConfigured()) {
    redirect(process.env.NODE_ENV !== 'production' ? target : '/admin/login?err=unset')
  }
  // Trimmed on both sides: password managers and mobile keyboards append a
  // space often enough that it is worth not failing on it.
  const typed = String(fd.get('password')).trim()
  // One box, and which person you are is whichever secret matched. A username
  // field would be a second thing to get wrong for no security it does not
  // already have: the password is the whole credential either way.
  const who = await staffForPassword(typed)
  if (!who) {
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
  jar.set(ADMIN_COOKIE, await sessionToken(who.secret), {
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
    <div className="adm-login">
      <form action={signIn}>
        <span className="adm-plate plate">Mermade</span>
        <h1 className="adm-title" style={{ fontSize: 30 }}>Staff sign-in</h1>
        <p className="adm-sub">Mermade Market admin</p>
        <input type="hidden" name="next" value={sp.next ?? '/admin/jury'} />
        <label className="adm-field" htmlFor="password" style={{ marginTop: 26 }}>
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
        <button className="adm-btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
          Sign in
        </button>
      </form>
    </div>
  )
}
