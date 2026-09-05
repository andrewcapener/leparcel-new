import Link from 'next/link'
import { Wordmark } from './Wordmark'
import { SubscribeForm } from './SubscribeForm'
import type { Show } from '@/db/schema'
import { fmtRange } from '@/lib/dates'

/**
 * The venue as the live site writes it, in the announcement bar and the
 * footer: "Dana Point Community House". The Show record stores the venue on
 * its own ("Community House") so the city is not baked into the name, so the
 * two are joined here rather than in the database.
 */
const VENUE_LONG = (show: Show) =>
  show.venueName.toLowerCase().startsWith('dana point')
    ? show.venueName
    : `Dana Point ${show.venueName}`

/**
 * Site chrome. Everything dated or priced comes off the Show record —
 * there are no hardcoded dates in this file (CLAUDE.md rule 6).
 */

export function Masthead({ show }: { show: Show }) {
  return (
    <>
      {/* Announcement bar. mermademarket.com runs one line here and nothing
          else: "Next Show! May 15-17, 2026 Dana Point Community House". The
          dates come off the Show record; the sentence is theirs. */}
      <div className="util">
        <span>Next Show! {fmtRange(show.startsOn, show.endsOn)} {VENUE_LONG(show)}</span>
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
          nav moves to its own row — the same three links the live site puts in
          its mobile drawer. Everything else is in the footer, as it is there. */}
      <nav className="mnav" aria-label="Sections">
        <Link href="/faq">FAQ</Link>
        <Link href="/merchants">Merchants</Link>
        <Link href="/schedule">Schedule</Link>
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
            Mermade Market is a hand curated market. Uniting creators with
            community, we feature 100+ indoor &amp; outdoor merchants every
            spring &amp; winter!
          </div>
        </div>
        <div>
          <h2 className="fh">{VENUE_LONG(show)}</h2>
          <div className="bl" style={{ marginTop: 0 }}>{show.venueAddress}</div>
          <a href="https://www.facebook.com/mermademarketoc">Facebook</a>
          <a href="https://instagram.com/mermademarket">Instagram</a>
        </div>
        <div>
          <h2 className="fh">Stay hooked</h2>
          <div className="bl" style={{ marginTop: 0, marginBottom: 10 }}>
            We send show dates, and important VIP info to our subscribers.
          </div>
          <SubscribeForm compact />
        </div>
        {/* The live footer runs this column unlabelled, so the heading is
            for screen readers only. */}
        <nav aria-label="More pages">
          <Link href="/contact">Contact</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/journal">Journal</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/collaborate">Collaborate</Link>
        </nav>
      </div>
      <div className="colophon">
        <span>&copy; {new Date().getFullYear()} Mermade Market</span>
      </div>
    </footer>
  )
}
