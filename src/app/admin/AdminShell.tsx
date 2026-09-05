'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminNav, type NavCounts } from './AdminNav'
import { Icon } from './Icon'

/**
 * The admin shell: a fixed near-black sidebar against a near-white content
 * area, with a slim strip across the top of the content.
 *
 * On a phone the sidebar becomes a drawer. Closed, it is `visibility:hidden`
 * in CSS, which takes every link inside it out of the tab order — so the
 * only thing this component has to do is hold the open flag, set it back to
 * false when the route changes, and close on Escape. No focus trap, no
 * scroll lock, nothing to get wrong.
 *
 * Sign-in renders bare. It is inside /admin so it inherits this file's
 * stylesheet, but a sign-in screen wrapped in the navigation it is gating
 * would be absurd, so the chrome drops out on that one path.
 */
export function AdminShell({
  showName, counts, failedMail, children,
}: {
  showName?: string
  counts: NavCounts
  /** Messages that came back failed from the delivery provider. */
  failedMail: number
  children: React.ReactNode
}) {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (path === '/admin/login') return <div className="adm">{children}</div>

  return (
    <div className="adm" data-nav={open ? 'open' : 'shut'}>
      <div className="adm-shell">
        <aside className="adm-side" id="adm-side">
          <div className="adm-side-hd">
            <Link href="/" className="adm-plate">Mermade</Link>
            <span className="adm-side-kicker">Admin</span>
          </div>

          <AdminNav counts={counts} onNavigate={() => setOpen(false)} />

          <div className="adm-side-ft">
            <span className="show" data-warn={showName ? undefined : '1'}>
              {showName ?? 'No active show'}
            </span>
            <span className="who">
              Staff, on a shared password
              <br />until real accounts land
            </span>
          </div>
        </aside>

        {/* Tapping outside the drawer closes it. Hidden from assistive tech:
            Escape and the toggle already do this, and an unlabelled button
            over the whole page is noise in a rotor. */}
        <button
          className="adm-scrim" type="button" tabIndex={-1} aria-hidden="true"
          onClick={() => setOpen(false)}
        />

        <div className="adm-main">
          <div className="adm-top">
            <button
              className="adm-sq adm-burger" type="button"
              aria-expanded={open} aria-controls="adm-side"
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name="menu" size={18} />
              <span className="adm-sr">{open ? 'Close the menu' : 'Open the menu'}</span>
            </button>
            <span className="t">Admin panel</span>
            {showName && (
              <>
                <span className="sep" aria-hidden="true">/</span>
                <span className="now">{showName}</span>
              </>
            )}
            <span className="r">
              <Link className="adm-sq" href="/admin/outbox">
                <Icon name="bell" size={18} />
                {failedMail > 0 && <span className="dot" aria-hidden="true" />}
                <span className="adm-sr">
                  {failedMail > 0
                    ? `Outbox, ${failedMail} ${failedMail === 1 ? 'message' : 'messages'} failed to send`
                    : 'Outbox'}
                </span>
              </Link>
            </span>
          </div>

          <main className="adm-body">{children}</main>
        </div>
      </div>
    </div>
  )
}
