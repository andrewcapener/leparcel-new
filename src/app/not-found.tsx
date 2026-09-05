import Link from 'next/link'

export const metadata = { title: 'Page not found' }

/**
 * There was no not-found.tsx, so a wrong URL fell through to Next's built-in
 * page: near-black text on a black ground, in whichever face happened to
 * load. Unreadable, and nothing to do from it but hit back.
 *
 * It cannot use SiteShell. That takes a Show, and the reason you are often
 * here is that the database is unreachable — a 404 page that queries is a
 * 404 page that can 500. So this is the theme's own type and colour, set by
 * hand, and no data.
 */
export default function NotFound() {
  return (
    /* No template class here on purpose. `template-page` is what makes
       `#content > .container` full-bleed on the real pages, and it strips the
       container's gutters with it, which left this text flush against the
       left edge of the screen. */
    <div>
      <main id="content" role="main">
        <div className="container container--reading-width nf">
          <p className="nf__code">404</p>
          <h1 className="nf__title">This page could not be found.</h1>
          <p className="nf__body">
            It may have moved, or the link that sent you here may be out of
            date. The show, the makers and the application are all a click
            away.
          </p>
          <ul className="nf__links">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/schedule">Schedule</Link></li>
            <li><Link href="/merchants">Merchants</Link></li>
            <li><Link href="/apply">Apply</Link></li>
            <li><Link href="/journal">Journal</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </div>
      </main>
    </div>
  )
}
