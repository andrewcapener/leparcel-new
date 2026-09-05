import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { MessageForm } from '@/components/MessageForm'

export const dynamic = 'force-dynamic'

/**
 * /pages/contact on the live site: a heading, a "reach out" subhead, a line
 * pointing at the FAQ first, and the three-field form. The rest of the ways
 * to reach the market sit under the form rather than replacing it.
 */
export default async function Contact() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />
      <section className="claim">
        <div className="k">Reach out</div>
        <h1 className="lede">We&rsquo;re here<br /><em>for you.</em></h1>
        <p>
          Didn&rsquo;t find what you need on our{' '}
          <Link href="/faq">FAQ page</Link>? Reach out below.
        </p>
      </section>

      <section className="sec" style={{ background: 'var(--paper-2)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <MessageForm topic="contact" />
        </div>
      </section>

      <section className="sec">
        <div className="prows air">
          <div className="row">
            <span className="q">Email</span>
            <span className="a">
              <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>
              {' '}reaches a person, usually within a day or two.
            </span>
          </div>
          <div className="row">
            <span className="q">Instagram</span>
            <span className="a">
              <a href="https://instagram.com/mermademarket" target="_blank" rel="noreferrer">
                @mermademarket
              </a>
              {' '}is where the show lives between shows.
            </span>
          </div>
          <div className="row">
            <span className="q">Selling with us</span>
            <span className="a">
              Start with the rules for <Link href="/makers/indoor">inside</Link>{' '}
              or <Link href="/makers/outdoor">outside</Link>. They answer most of
              it before you write.
            </span>
          </div>
          <div className="row">
            <span className="q">Sponsorship</span>
            <span className="a">
              Read <Link href="/collaborate">what a partnership looks like</Link>,
              then write to us from that page.
            </span>
          </div>
          <div className="row">
            <span className="q">The show</span>
            <span className="a">Dana Point {show.venueName}, {show.venueAddress}</span>
          </div>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
