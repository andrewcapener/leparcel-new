import Link from 'next/link'
import { Wordmark } from './Wordmark'
import { SubscribeForm } from './SubscribeForm'
import type { Show } from '@/db/schema'
import { FOUNDED_YEAR } from '@/lib/content'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'

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
      {/* announcement bar — the live site runs the next show's date here */}
      <div className="util">
        <span>
          Next Show! {fmtRange(show.startsOn, show.endsOn)} · {show.venueName}, Dana Point
        </span>
        <span className="mid">{applyNote}</span>
      </div>
      <div className="mast">
        <Link href="/" aria-label="Mermade Market, home">
          <Wordmark className="wm" />
        </Link>
        <div className="r">
          <Link href="/faq">FAQ</Link>
          <Link href="/merchants">Merchants</Link>
          <Link href="/schedule">Schedule</Link>
          <Link href="/apply" className="btn">
            Apply now
          </Link>
        </div>
      </div>
      {/* On a phone the masthead has room for the mark and one button, so the
          nav moves to its own scrollable row. Without it the only way off the
          home page is the footer. */}
      <nav className="mnav" aria-label="Sections">
        <Link href="/faq">FAQ</Link>
        <Link href="/merchants">Merchants</Link>
        <Link href="/schedule">Schedule</Link>
        <Link href="/journal">Journal</Link>
        <Link href="/makers/indoor">Sell inside</Link>
        <Link href="/makers/outdoor">Sell outside</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </>
  )
}

export function Footer({ show }: { show: Show }) {
  return (
    <footer className="foot">
      <div className="fgrid">
        <div>
          <Wordmark className="wm" />
          <div className="bl" style={{ fontStyle: 'italic', marginBottom: 6 }}>
            Shop small. Think big.
          </div>
          <div className="bl" style={{ marginTop: 0 }}>
            A hand-curated market uniting creators with community. Dana Point,
            California, since {FOUNDED_YEAR}.
          </div>
        </div>
        <div>
          <h2 className="fh">{show.venueName}</h2>
          <div className="bl" style={{ marginTop: 0 }}>{show.venueAddress}</div>
          <a href="https://www.facebook.com/mermademarketoc">Facebook</a>
          <a href="https://instagram.com/mermademarket">Instagram</a>
        </div>
        <div>
          <h2 className="fh">Stay hooked</h2>
          <div className="bl" style={{ marginTop: 0, marginBottom: 10 }}>
            We send show dates and important VIP info to our subscribers.
          </div>
          <SubscribeForm compact />
        </div>
        <div>
          <h2 className="fh">Pages</h2>
          <Link href="/contact">Contact</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/journal">Journal</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/collaborate">Collaborate</Link>
        </div>
      </div>
      <div className="colophon">
        <span>© {new Date().getFullYear()} Mermade Market</span>
        <span>Shop small · Think big</span>
        <span>Dana Point, California</span>
      </div>
    </footer>
  )
}
