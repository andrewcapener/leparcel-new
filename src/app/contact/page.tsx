import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'

export const dynamic = 'force-dynamic'

export default async function Contact() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">Contact</div>
        <p className="lede" style={{ maxWidth: '14ch' }}>Say <em>hi.</em></p>
      </section>

      <section className="sec">
        <div className="prows air">
          <div className="row">
            <span className="q">Email</span>
            <span className="a">
              <a href="mailto:hello@mermademarket.com" style={{ color: 'var(--deep)', textDecoration: 'underline' }}>
                hello@mermademarket.com
              </a>
              {' '}reaches a person, usually within a day or two.
            </span>
          </div>
          <div className="row">
            <span className="q">Instagram</span>
            <span className="a">
              <a href="https://instagram.com/mermademarket" target="_blank" rel="noreferrer" style={{ color: 'var(--deep)', textDecoration: 'underline' }}>
                @mermademarket
              </a>
              {' '}is where the show lives between shows.
            </span>
          </div>
          <div className="row">
            <span className="q">Before you write</span>
            <span className="a">
              Most maker and shopper questions are already answered on the{' '}
              <Link href="/faq" style={{ color: 'var(--deep)', textDecoration: 'underline' }}>FAQ</Link>.
            </span>
          </div>
          <div className="row">
            <span className="q">The show</span>
            <span className="a">{show.venueName}, {show.venueAddress}</span>
          </div>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
