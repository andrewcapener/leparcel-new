import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { LookbookGrid, LookbookFooterCta } from '@/components/Lookbook'
import { indoorShots } from '@/lib/lookbook'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Indoor merchant lookbook',
  description:
    'Past indoor spaces at Mermade Market, at 3x4, 3x6 and 3x8, and what made each of them work.',
}

/** /pages/indoor-lookbook, photographs and captions intact. */
export default async function IndoorLookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">For makers · Indoor</div>
        <h1 className="lede">Indoor merchant<br /><em>lookbook.</em></h1>
        <p>
          It is proven time &amp; time again that when our merchants&rsquo;
          spaces look their best, they sell more product. Indoor @ Mermade are
          much smaller spaces than any outdoor tent. But it doesn&rsquo;t mean
          they can&rsquo;t look good! See below of some past examples and see
          how big they actually are.
        </p>
        <p><strong>Remember, vertical space is everything!</strong></p>
      </section>

      <section className="sec">
        <LookbookGrid shots={indoorShots} alt="A maker's indoor space at a past show." />
      </section>

      <LookbookFooterCta track="indoor" />
      <Footer show={show} />
    </>
  )
}
