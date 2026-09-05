import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { FOUNDED_YEAR } from '@/lib/content'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Sponsorships',
  description: 'Partner with a hand-curated market in Dana Point. The locals-only advantage.',
}

/** Ported from mermademarket.com/pages/sponsorships. The detail — the four
 *  tiers and what each includes — lives on /collaborate, as it does there. */
export default async function Sponsorships() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />

      <section className="claim" style={{ paddingBottom: 56 }}>
        <div className="k">Sponsorships</div>
        <p className="lede" style={{ maxWidth: '20ch' }}>The <em>locals-only</em> advantage.</p>
      </section>

      <section className="mission">
        <p style={{ marginTop: 0 }}>
          Mermade is a hand-curated market that unites creators with community. Two
          shows a year in Dana Point, a following that has been with us since{' '}
          {FOUNDED_YEAR}, and a room full of people who came on purpose.
        </p>
        <div style={{ marginTop: 30, display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/collaborate" className="btn">What a partner gets</Link>
          <a href="mailto:hello@mermademarket.com?subject=Sponsorship" className="btn line">Write to us</a>
        </div>
      </section>

      <Footer show={show} />
    </>
  )
}
