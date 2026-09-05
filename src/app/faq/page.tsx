import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'

export const dynamic = 'force-dynamic'

/**
 * /pages/faq on the live site: two headed groups, "Shop Small" and
 * "Merchants", then the two rules-page links and a get-in-touch band.
 *
 * The answers are the market's own words. The only edits are the ones
 * CLAUDE.md rule 6 forces: capacities read off the Show record instead of
 * being typed in, because the live copy says 35-40 here and 45 / 25 on the
 * indoor and outdoor pages, and one of those numbers is stale.
 */
export default async function FAQ() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const shoppers: Array<[string, React.ReactNode]> = [
    ['What is Mermade Market', <>
      Mermade Market is a 3-day, free, heavily curated, fresh, twice a year
      show. We believe strongly in shopping local &amp; small &amp; we love
      that our community is on board with us. Half of our makers are inside
      the whale room and the rest are outside in our Mermade Market tents.
      {' '}
      Much different than shows around here in So. Cal, the inside portion is
      a central checkout. Shoppers come in, grab a basket (and some taffy for
      kids &amp; kicks), and shop without the makers there. Our customers
      really love this because they can shop as they please. Our inside makers
      find that they love it too because they don&rsquo;t have to be sales
      people for 3 days and can also keep their day job and family life
      doesn&rsquo;t need to be interrupted. The other portion of the market is
      outside, with {show.outdoorCapacity} rotating makers each day! These are
      the makers that love to talk to you &amp; show you their amazing goods.
      We also like to call it a festival of sorts with our live music,
      delicious food &amp; misc events like bubbles, hair wraps &amp; others
      that show up! It&rsquo;s a real good time and we are thrilled to have you
      with us! Come say hi!
    </>],
    ['Is Mermade Market free', 'Free to shop! Bring your favorite shopping friends and stay all day!'],
    ['Stroller / dog friendly', <>
      Yes! Single strollers are highly suggested &amp; or baby carriers because
      it can get busy, especially the morning hours.
      {' '}
      Well mannered dogs are also warmly welcomed at Mermade Market, please
      keep them close to you &amp; be aware the other dogs will be there! Pick
      up after them, and keep them on a leash please!
    </>],
  ]

  const makers: Array<[string, React.ReactNode]> = [
    ['What are my chances of being accepted as a merchant?', <>
      Our inside space (all 3 days) only allows {show.indoorCapacity}. Outside,
      {' '}{show.outdoorCapacity} each day. If you create a fresh product we
      haven&rsquo;t seen before, or put a new spin to something we have seen,
      chances are high you&rsquo;ll get in. You have great branding &amp; a
      vision for your online brand? Yes, can&rsquo;t wait to have you.
    </>],
    ['How are merchants selected?', <>
      The moment applications open &amp; start coming in, we get the wheels
      turning. We are emailing applicants, requesting new content or a
      photographs we can&rsquo;t find online, and we have them categorized. New
      makers / repeat makers / need improvement makers. We choose the freshest,
      best branded shops that come in. We also only select 1-3 makers in each
      category.
    </>],
    ['Do you accept painters / artists?', <>
      Depends on the art. If your art is being sold in galleries, let&rsquo;s
      just tell you right now, our show is NOT a gallery. While some of our
      customers love taking home a special piece, if you&rsquo;re expecting
      every customer to be ready to throw down some money for an amazing
      original, it might not happen. If you MUST come to Mermade for networking
      and some ad space, then great, we can provide that, but please apply for
      the outside section and keep your prices realistic. If you want to be an
      &ldquo;inside maker&rdquo;, you must make your work under $100, even
      maybe under $50. Prints are fine but don&rsquo;t sell like they do
      outside.
    </>],
    ['Does my product need to be handmade?', <>
      For the most part, yes. We do not allow for &ldquo;MLM&rdquo; companies.
      If you have a curated shop where you wholesale items from a factory (like
      clothing) or wholesale from other shops, it&rsquo;s all good. We
      understand a lot of shops do that and it makes sense that not everyone can
      handmake everything. If we think you have a vision &amp; are working hard
      to sell that product, let&rsquo;s do this.
    </>],
    ['If I’m not accepted this time, can I apply again?', <>
      Yes! We don&rsquo;t <em>want</em> to accept our old vendors a million
      times. We gotta keep it FRESH. If you weren&rsquo;t accepted, you were
      most likely given a reason why so that you can fix it by the next time!
      That&rsquo;s the great thing about being a creator. Creating &amp;
      changing often is a beautiful work of art! Or you weren&rsquo;t accepted
      because there simply was too many jewelry makers and we just can&rsquo;t
      have you all! No hard feelings!
    </>],
    ['Indoor merchant info', <>
      For information about being an indoor merchant{' '}
      <Link href="/makers/indoor">click here</Link>.
    </>],
    ['Outdoor merchant info', <>
      For information about being an outdoor merchant{' '}
      <Link href="/makers/outdoor">click here</Link>.
    </>],
  ]

  return (
    <>
      <Masthead show={show} />
      <section className="claim">
        <div className="k">Mermade Market FAQ</div>
        <h1 className="lede">Questions,<br /><em>answered.</em></h1>
        <p>Frequently asked questions for both shoppers and merchants.</p>
      </section>

      <section className="sec">
        <div className="shead"><span className="k">01</span><h2>Shop small</h2></div>
        <div className="prows air flow">
          {shoppers.map(([q, a]) => (
            <div className="row" key={q}><span className="q">{q}</span><span className="a">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="sec" id="makers" style={{ paddingTop: 0 }}>
        <div className="shead"><span className="k">02</span><h2>Merchants</h2></div>
        <div className="prows air flow">
          {makers.map(([q, a]) => (
            <div className="row" key={q}><span className="q">{q}</span><span className="a">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="apply">
        <div className="k">Get in touch</div>
        <h2 style={{ marginTop: 18 }}>Didn&rsquo;t answer your question? <em>Reach out.</em></h2>
        <div className="cta">
          <Link href="/contact" className="btn">Contact us</Link>
          <Link href="/apply" className="btn-o">Apply to sell</Link>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
