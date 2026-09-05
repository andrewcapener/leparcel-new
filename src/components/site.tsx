import Link from 'next/link'
import { Wordmark } from './Wordmark'
import type { Show } from '@/db/schema'
import { FOUNDED_YEAR } from '@/lib/content'
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
        : 'Applications closed · waitlist open'

  return (
    <>
      <div className="util">
        <span>Est. {FOUNDED_YEAR} · Dana Point, California</span>
        <span className="mid">Show {show.numeral}</span>
        <span>{applyNote}</span>
      </div>
      <div className="mast">
        <Link href="/" aria-label="Mermade Market, home">
          <Wordmark className="wm" />
        </Link>
        <div className="r">
          <Link href="/#visiting">Visiting</Link>
          <Link href="/schedule">Schedule</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/apply" className="btn">
            Apply to sell
          </Link>
        </div>
      </div>
    </>
  )
}

export function Footer({ show }: { show: Show }) {
  const month = new Date(show.startsOn).toLocaleDateString('en-US', {
    month: 'long', timeZone: 'America/Los_Angeles',
  })
  return (
    <footer className="foot">
      <div className="fgrid">
        <div>
          <Wordmark className="wm" />
          <div className="bl">
            A juried market of independent makers. Dana Point, California, since {FOUNDED_YEAR}.
          </div>
        </div>
        <div>
          <h4>The market</h4>
          <Link href="/#visiting">Visiting</Link>
          <Link href="/schedule">Schedule</Link>
          <Link href="/faq">FAQ</Link>
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
          <Link href="/contact">Say hi</Link>
          <Link href="/collaborate">Collaborate</Link>
          <a href="https://instagram.com/mermademarket">Instagram</a>
        </div>
      </div>
      <div className="colophon">
        <span>© {new Date().getFullYear()} Mermade Market</span>
        <span>You scrolled the whole way. Come say hi in {month}.</span>
        <span>Dana Point, California</span>
      </div>
    </footer>
  )
}
