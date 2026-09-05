import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { FOUNDED_YEAR } from '@/lib/content'

export const dynamic = 'force-dynamic'

/**
 * Ported from the old site's FAQ + indoor/outdoor merchant pages, rewritten
 * to the voice doc. Facts (dogs, payout timing, tent dimensions, rotation)
 * come from mermademarket.com; nothing dated or priced is hardcoded.
 */
export default async function FAQ() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const shoppers: Array<[string, React.ReactNode]> = [
    ['What is this exactly', `Three days, twice a year, free to walk in. Half the makers set up shop inside the Community House, where you shop with a basket and pay once at the register. The other half sell in person from market tents outside, and the outside changes every day. Live music and food run the weekend.`],
    ['Do I pay to get in', `No. Free, every show since ${FOUNDED_YEAR}.`],
    ['Strollers', 'Yes. A single stroller or a carrier is easiest in the morning crowd.'],
    ['Dogs', 'Well-mannered dogs on leash are welcome. Keep them close and pick up after them.'],
    ['How the register works', 'Inside, there is one checkout at the front, run by our staff. Grab a basket, shop the whole room, pay once.'],
    ['Should I come more than once', 'People do. The outdoor tents change daily, so Saturday is a different market than Friday.'],
  ]

  const makers: Array<[string, React.ReactNode]> = [
    ['What are my chances', 'We take one to three makers per category. A fresh product, or a new spin on a familiar one, puts you at the front. Strong photography helps more than anything else you control.'],
    ['How merchants are chosen', 'We read applications as they come in and we look hard at your Instagram. Fresh work and clear branding get in. A crowded category is the most common reason good work does not.'],
    ['Does everything need to be handmade', 'Mostly. A thoughtfully curated shop can work, especially outside. MLM and direct-sales brands are a no, always.'],
    ['I make original art', <>The indoor room is not a gallery: work under $100 sells there, and originals do better outside where you can talk about them. Apply for the track that fits your prices.</>],
    ['How indoor consignment works', <>You set up your space on load-in day, then leave the selling to us. Our staff runs the registers, every item carries your tag, and we pay you within a week of the show&rsquo;s last day. We ask for your inventory list two weeks before the show. <Link href="/makers/indoor" style={{ color: 'var(--deep)', textDecoration: 'underline' }}>The full indoor rules</Link> cover load-in, display and labeling.</>],
    ['How outdoor works', <>We set up the tents for you, roughly six and a half feet square. You pick the day or days that fit your life, sell in person, and keep everything. Checking more days tells us you are flexible, which helps your odds. <Link href="/makers/outdoor" style={{ color: 'var(--deep)', textDecoration: 'underline' }}>The full outdoor rules</Link> cover what to bring and what happens if it rains.</>],
    ['Can I do indoor and outdoor', 'A few makers do each show. Check both on the application and we will place you where it works, though not both at once.'],
    ['Can I share a space', 'Yes, inside or out. Both makers apply, you tell us who you want to share with, and there is a fee for the second name. The space is still one space.'],
    ['Do I need a seller’s permit', 'If you are accepted, yes, or a written statement that you qualify as an occasional seller. We collect it before load-in, not before the jury. Cottage food makers also need a permit for treats, and you should wait until you are in to apply for it.'],
    ['If I am not accepted, can I apply again', 'Yes, and people get in on the second try often. We tell you why either way, so you know what to change or that it was just a crowded season.'],
    ['What if it rains', 'If we call off an outdoor day, you get the same day at the next show at no charge, or 30% of the fee back. If the show runs in imperfect weather, it runs.'],
    ['Can my kid sell', 'Yes. Junior makers are 14 and under, with a small shelf space of their own, and we run it when at least two get in. If your business is already going and you happen to be 17, apply for a regular space.'],
  ]

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">Good to know</div>
        <p className="lede" style={{ maxWidth: '20ch' }}>Questions, <em>answered.</em></p>
      </section>

      <section className="sec">
        <div className="shead"><span className="k">01</span><h2>Coming to the show</h2></div>
        <div className="prows air">
          {shoppers.map(([q, a]) => (
            <div className="row" key={q}><span className="q">{q}</span><span className="a">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="sec" id="makers" style={{ paddingTop: 0 }}>
        <div className="shead"><span className="k">02</span><h2>Selling at the show</h2></div>
        <div className="prows air">
          {makers.map(([q, a]) => (
            <div className="row" key={q}><span className="q">{q}</span><span className="a">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="apply">
        <div className="k">Still wondering</div>
        <h2 style={{ marginTop: 18 }}>Ask us the thing.</h2>
        <p>
          <a href="mailto:hello@mermademarket.com" style={{ textDecoration: 'underline' }}>hello@mermademarket.com</a>
          {' '}reaches a person.
        </p>
        <div className="cta">
          <Link href="/apply" className="btn">Apply to sell</Link>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
