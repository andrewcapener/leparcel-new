import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { LookbookGrid, LookbookFooterCta } from '@/components/Lookbook'
import { outdoorShots } from '@/lib/lookbook'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outdoor merchant lookbook',
  description:
    'Past outdoor tents at Mermade Market and what made each of them work: a backdrop, height, lights, and never a table across the front.',
}

/** /pages/outdoor-lookbook, photographs and captions intact. */
export default async function OutdoorLookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">For makers · Outdoor</div>
        <h1 className="lede">Outdoor merchant<br /><em>lookbook.</em></h1>
        <p>
          Our merchant tents are the bomb! They&rsquo;re 6.5 x 6.5 feet. We find
          that people with 10x10 tents have a hard time making every single inch
          intentional because it is quite large. Most makers that get the
          assignment of making their space creative &amp; unique find that they
          go to other shows with their original tents &amp; wish they had a
          smaller one. It helps curate your space and truly think of every inch
          you use!
        </p>
        <p>
          Below you will find the bold words we use to describe each image and
          why we think their space stood out from the others. Each one has
          something to inspire you &amp; make your space with us phenomenal!
        </p>
      </section>

      <section className="sec">
        <div className="prows air">
          <div className="row">
            <span className="q">A backdrop is required</span>
            <span className="a">
              If not all three sides, for sure the very back of your space so it
              doesn&rsquo;t distract our customers from focusing on YOUR shop,
              not your neighbors or what&rsquo;s happening behind them.
            </span>
          </div>
          <div className="row">
            <span className="q">It gets windy</span>
            <span className="a">
              We are right on top of the ocean. Remember this when displaying
              your products &amp; bring duct tape to literally tape your cutie
              displays down. We will have sandbags for each and every merchant.
            </span>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <LookbookGrid shots={outdoorShots} alt="A maker's outdoor tent at a past show." />
      </section>

      <LookbookFooterCta track="outdoor" />
      <Footer show={show} />
    </>
  )
}
