import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { Banner, FaqHeader, CollapsibleTabs, RichText, type Tab } from '@/components/theme/Sections'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'FAQ',
  description:
    'Answers for shoppers and for makers: parking, admission, dogs and strollers, how the indoor register works, and what it costs to sell at Mermade Market.',
  alternates: { canonical: '/faq' },
}

/**
 * /pages/faq — their banner, their two accordion groups, their get-in-touch
 * block. The questions and answers are theirs, unedited, except that the
 * capacities read off the Show record: their copy says 35-40 here and 45 / 25
 * on the maker pages, and one of those numbers is stale (CLAUDE.md rule 6).
 */
export default async function FAQ() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const shoppers: Tab[] = [
    {
      q: 'What is Mermade Market',
      a: <>
        <p>Mermade Market is a 3-day, free, <em>heavily curated</em>, fresh, twice a year- show. </p>
        <p>We believe strongly in shopping local &amp; small &amp; we love that our community is on board with us. Half of our makers are inside the whale room and the rest are outside in our Mermade Market tents. </p>
        <p>Much different than shows around here in So. Cal, the inside portion is a central checkout..shoppers come in, grab a basket (and some taffy for kids &amp; kicks), and shop without the makers there. Our customers really love this because they can shop as they please. Our inside makers find that they love it too because they don&#39;t have to be sales people for 3 days and can also keep their day job and family life doesn&#39;t need to be interrupted. The other portion of the market is outside.. with {show.outdoorCapacity} rotating makers each day! These are the makers that love to talk to you &amp; show you their amazing goods. We also like to call it a festival of sorts with our live music, delicious food &amp; misc events like bubbles, hair wraps &amp; others that show up! It&#39;s a real good time and we are thrilled to have you with us! Come say hi!</p>
      </>,
    },
    {
      q: 'Is Mermade Market Free',
      a: <p> Free to shop! Bring your favorite shopping friends and stay all day!</p>,
    },
    {
      q: 'Stroller / Dog Friendly',
      a: <>
        <p>Yes! Single strollers are highly suggested &amp; or baby carriers because it can get busy, especially the morning hours.</p>
        <p>Well mannered dogs are also warmly welcomed at Mermade Market, please keep them close to you &amp; be aware the other dogs will be there! Pick up after them, and keep them on a leash please!</p>
      </>,
    },
  ]

  const merchants: Tab[] = [
    {
      q: 'What are my chances of being accepted as a Merchant?',
      a: <p>Our inside space (all 3 days) only allows {show.indoorCapacity}.. Outside, {show.outdoorCapacity} each day. If you create a fresh product we haven&#39;t seen before, or put a new spin to something we have seen, chances are high you&#39;ll get in. You have great branding &amp; a vision for your online brand? Yes.. can&#39;t wait to have you.</p>,
    },
    {
      q: 'How are merchants selected?',
      a: <p>The moment applications open &amp; start coming in, we get the wheels turning. We are emailing applicants, requesting new content or a photographs we can&#39;t find online... and we have them categorized. New Makers/Repeat Makers/Need improvement makers. We choose the freshest, best branded shops that come in. We also only select 1-3 makers in each category.</p>,
    },
    {
      q: 'Do you accept painters / Artists?',
      a: <p>Depends on the art. If your art is being sold in galleries, let&rsquo;s just tell you right now&hellip; our show is NOT a gallery. While some of our customers love taking home a special piece.. if you&#39;re expecting every customer to be ready to throw down some money for an amazing original, it might not happen. If you MUST come to Mermade for networking and some ad space, then great, we can provide that, but please apply for the outside section and keep your prices realistic. If you want to be an &ldquo;inside maker&rdquo;, you must make your work under $100, even maybe under $50. Prints are fine but don&#39;t sell like they do outside.</p>,
    },
    {
      q: 'Does my product need to be handmade?',
      a: <p>For the most part, yes. We do not allow for &ldquo;MLM&rdquo; companies. If you have a curated shop where you wholesale items from a factory (like clothing) or wholesale from other shops, it&rsquo;s all good. We understand a lot of shops do that and it makes sense that not everyone can handmake everything. If we think you have a vision &amp; are working hard to sell that product, let&#39;s do this.</p>,
    },
    {
      q: "If I'm not accepted this time, can I apply again?",
      a: <p>Yes! We don&#39;t <em>want</em> to accept our old vendors a million times. We gotta keep it FRESH. If you weren&#39;t accepted, you were most likely given a reason why so that you can fix it by the next time! That&#39;s the great thing about being a creator. Creating &amp; changing often is a beautiful work of art! Or you weren&#39;t accepted because there simply was too many jewelry makers and we just can&#39;t have you all! No hard feelings!</p>,
    },
    {
      q: 'Outdoor Merchant Info',
      a: <p>For information about being an outdoor merchant <Link href="/makers/outdoor">click here</Link></p>,
    },
    {
      q: 'Indoor Merchant Info',
      a: <p>For information about being an indoor merchant <Link href="/makers/indoor">click here</Link></p>,
    },
  ]

  return (
    <SiteShell show={show} template="page template-suffix-faq">
          <Banner
            id="section-faq-banner"
            image="/photos/merch.jpg"
            subheading="Mermade Market FAQ"
            title="Frequently asked questions for both shoppers and merchants"
            heightMobile={300}
            heightDesktop={400}
            heading={[32, 36.4, 52]}
            priority
          />

          <FaqHeader />
          <CollapsibleTabs heading="Shop Small" id="faq-shop-small" tabs={shoppers} />
          <CollapsibleTabs heading="Merchants" id="faq-merchants" tabs={merchants} />

          <RichText
            title="Get in touch"
            icon={<ChatIcon />}
            cta={{ href: '/contact', label: 'Contact us' }}
          >
            <p>Didn&#39;t answer your question - reach out</p>
          </RichText>
        </SiteShell>
  )
}

/** Their `icon--type-chat_bubble`, copied from the live page. */
function ChatIcon() {
  return (
    <svg className="icon icon--medium icon--type-chat_bubble" strokeWidth="1" aria-hidden="true" focusable="false" role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path fill="currentColor" d="M11.3 13.02a6 6 0 111.72-1.72L14 14l-2.7-.98zm2.82-1.62a7 7 0 10-2.72 2.72l2.26.82a1 1 0 001.28-1.28l-.82-2.26z" />
      <path fill="currentColor" d="M4.9 9.16c.52 0 .86-.36.86-.85 0-.5-.34-.85-.87-.85-.52 0-.86.36-.86.85 0 .5.34.85.86.85zM7.88 9.16c.53 0 .87-.36.87-.85 0-.5-.34-.85-.87-.85-.52 0-.87.36-.87.85 0 .5.35.85.87.85zM10.87 9.16c.52 0 .87-.36.87-.85 0-.5-.35-.85-.87-.85s-.87.36-.87.85c0 .5.35.85.87.85z" />
    </svg>
  )
}
