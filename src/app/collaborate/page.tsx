import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { FOUNDED_YEAR } from '@/lib/content'

export const dynamic = 'force-dynamic'

/**
 * Ported from the old site's collaborate + sponsorships pages. The audience
 * numbers are the business's own published figures
 * (mermademarket.com/pages/collaborate, retrieved Sept 2026).
 */
export default async function Collaborate() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show.')

  const stats: Array<[string, string]> = [
    ['Repeat attendees', '6,000'],
    ['Instagram followers', '17K'],
    ['On the email list', '10,000'],
    ['Merchants a show', '100+'],
    ['Shows held', '22'],
    ['Since', String(FOUNDED_YEAR)],
  ]

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">Sponsorships &amp; collaborations</div>
        <p className="lede" style={{ maxWidth: '22ch' }}>Partner with <em>the market.</em></p>
      </section>

      <section className="sec">
        <p style={{ fontFamily: 'var(--font-g)', fontSize: 19.5, lineHeight: 1.62, color: 'var(--ink-2)', maxWidth: '58ch' }}>
          Twice a year we fill a room in Dana Point with people who came on purpose. They are
          loyal, local, and careful about what they buy, and they trust the market because we
          are careful about what we put in front of them. A partnership here borrows that
          trust, which is exactly why we say no to most of them.
        </p>
      </section>

      <div className="facts">
        {stats.map(([k, v]) => (
          <div key={k}>
            <div className="k">{k}</div>
            <div className="v num">{v}</div>
          </div>
        ))}
      </div>

      <section className="apply">
        <div className="k">Interested</div>
        <h2 style={{ marginTop: 18 }}>Tell us what you have in mind.</h2>
        <p>
          Write to{' '}
          <a href="mailto:hello@mermademarket.com?subject=Sponsorship" style={{ textDecoration: 'underline' }}>
            hello@mermademarket.com
          </a>{' '}
          with the word sponsorship, and we&rsquo;ll take it from there.
        </p>
      </section>
      <Footer show={show} />
    </>
  )
}
