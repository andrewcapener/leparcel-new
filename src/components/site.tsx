import Link from 'next/link'
import { Wordmark } from './Wordmark'
import type { Show } from '@/db/schema'
import { applicationWindow, fmtDate } from '@/lib/dates'

/**
 * Site chrome. Everything dated or priced comes off the Show record —
 * there are no hardcoded dates in this file (CLAUDE.md rule 6).
 */

export function Masthead({ show }: { show: Show }) {
  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)
  const applyNote =
    win === 'before'
      ? `Applications open ${fmtDate(show.applicationsOpenAt, { year: undefined })}`
      : win === 'open'
        ? `Applications close ${fmtDate(show.applicationsCloseAt, { year: undefined })}`
        : 'Applications closed — join the waitlist'

  return (
    <>
      <div className="util">
        <span>Est. 2015 · Dana Point, California</span>
        <span className="mid">{show.numeral === 'XXII' ? 'Twenty-second show' : `Show ${show.numeral}`}</span>
        <span>{applyNote}</span>
      </div>
      <div className="mast">
        <Link href="/" aria-label="Mermade Market — home">
          <Wordmark className="wm" />
        </Link>
        <div className="tag">A juried market of independent makers</div>
        <div className="r">
          <Link href="/#visiting">The Market</Link>
          <Link href="/#merchants">Merchants</Link>
          <Link href="/#archive">Archive</Link>
          <Link href="/apply" className="btn">
            Apply to sell
          </Link>
        </div>
      </div>
    </>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="fgrid">
        <div>
          <Wordmark className="wm" />
          <div className="bl">
            A juried market of independent makers. Dana Point, California, since 2015.
          </div>
        </div>
        <div>
          <h4>The market</h4>
          <Link href="/#visiting">Visiting</Link>
          <Link href="/#merchants">Merchants</Link>
          <Link href="/#archive">Archive</Link>
        </div>
        <div>
          <h4>Makers</h4>
          <Link href="/apply">Apply to sell</Link>
          <Link href="/apply#indoor">Indoor consignment</Link>
          <Link href="/apply#outdoor">Outdoor tents</Link>
        </div>
        <div>
          <h4>Staff</h4>
          <Link href="/admin/jury">Jury queue</Link>
          <Link href="/admin/roster">Roster</Link>
          <Link href="/admin/outbox">Outbox</Link>
        </div>
        <div>
          <h4>Contact</h4>
          <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>
          <a href="https://instagram.com/mermademarket">Instagram</a>
        </div>
      </div>
      <div className="colophon">
        <span>© {new Date().getFullYear()} Mermade Market</span>
        <span>Set in EB Garamond &amp; Libre Franklin</span>
        <span>Dana Point, California</span>
      </div>
    </footer>
  )
}
