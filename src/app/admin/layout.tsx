import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { AdminNav } from './AdminNav'
// The admin's own stylesheet. Imported here rather than in the root layout so
// the public site gets the vendored Symmetry theme and nothing else, and so
// this one loads after it and wins inside /admin.
import '../globals.css'

export const dynamic = 'force-dynamic'

/**
 * The admin register: dense and precise, not warm and photographic.
 * docs/08-DESIGN-SYSTEM.md — "Institutional is for the vendors and for a
 * future buyer, not for the shoppers." Two registers, one system: the same
 * two faces as the public site, set tighter and smaller.
 *
 * The bar names the show every screen below it is operating on. Everything in
 * this app is scoped to a show_id, and staff were being asked to hold that in
 * their heads while editing dates and prices that only apply to one of them.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Never let a missing show take the whole admin down: /admin/show is where
  // you would go to fix it.
  const show = await activeShow().catch(() => undefined)

  return (
    <div className="adm">
      <div className="adm-bar">
        <Link href="/" className="brand">Mermade</Link>
        <AdminNav />
        {/* Applications only render the form inside the window, which is the
            right public behaviour and means there is no way for staff to look
            at the form in the weeks before it opens. `?preview=1` renders it
            read-only. It was reachable only by knowing to type it. */}
        {/* Two different previews, and they are not the same thing.
            `?preview=1` renders just the form, read only, outside the window.
            The launch preview shows the WHOLE site as it will read once
            applications open: the announcement bar, the home page, the live
            form. It is a cookie on this browser only, and the server action
            still refuses a real submission until the real window opens. */}
        <Link href="/apply?preview=1" target="_blank" rel="noreferrer">
          Preview application ↗
        </Link>
        <Link href="/api/preview?on=1&to=%2F" target="_blank" rel="noreferrer">
          Preview launch ↗
        </Link>
        <span className="who">
          {/* `.chip` already carries the small uppercase pill this wants, and
              its data-warn variant is the red one, so the missing-show case
              reads as the problem it is without a new rule. */}
          <span className="chip" data-warn={show ? undefined : '1'}>
            {show ? show.name : 'No active show'}
          </span>
          <span aria-hidden="true"> · </span>
          Staff, on a shared password until real accounts land
        </span>
      </div>
      {children}
    </div>
  )
}
