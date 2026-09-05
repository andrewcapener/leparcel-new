import { eq, asc, and } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { shows, spaceTypes, addOns } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { Toc, Sec, Rules, Pull, Callout, Checklist, PriceTable } from '@/components/rules'
import { usd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Selling outside · Mermade Market',
  description:
    'How the outdoor tents work: pick your days, run your own register, keep everything. What it costs, what to bring, and what happens if it rains.',
}

/**
 * The outdoor maker rules, ported from the old Shopify site's "Outdoor
 * Merchants" page and rewritten to docs/12-VOICE.md. Prices, days and
 * capacity come off space_types and the Show record (CLAUDE.md rule 6).
 */
export default async function OutdoorRules() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await db.query.spaceTypes.findMany({
    where: and(eq(spaceTypes.showId, show.id), eq(spaceTypes.track, 'outdoor')),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = (await activeAddOns(show.id)).filter((a) => a.track === null || a.track === 'outdoor')

  const tents = Math.max(...spaces.map((s) => s.capacity))
  const low = Math.min(...spaces.map((s) => s.priceCents))
  const high = Math.max(...spaces.map((s) => s.priceCents))
  const days = show.hoursNote.split(' · ')

  const toc = [
    { id: 'how', label: 'How it works' },
    { id: 'fit', label: 'Is this you' },
    { id: 'cost', label: 'What it costs' },
    { id: 'when', label: 'The days' },
    { id: 'tent', label: 'Your tent' },
    { id: 'bring', label: 'What to bring' },
    { id: 'house', label: 'House rules' },
    { id: 'rain', label: 'Rain and refunds' },
  ]

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">For makers · Selling outside</div>
        <h1 className="lede">
          Your tent.<br /><em>Your register.</em>
        </h1>
        <p>
          {tents} tents go up outside each morning and a different set of makers is under
          them each day. We build them, you sell, and we take no commission on any of it.
        </p>
      </section>

      <div className="facts">
        <div><div className="k">Tents a day</div><div className="v num">{tents}</div></div>
        <div><div className="k">Our commission</div><div className="v num hl">0%</div></div>
        <div><div className="k">A day</div><div className="v num">{usd(low)}-{usd(high)}</div></div>
        <div><div className="k">Tent size</div><div className="v">6.5 ft square</div></div>
      </div>

      <Toc items={toc} />

      <Sec n="01" title="How the outside works" id="how">
        <Rules>
          <p>
            You pick your days, we set up the tent before you arrive, and you sell your own
            work with your own card reader. Nothing goes through our register, so nothing
            comes out of your total.
          </p>
          <p>
            The lineup changes every day, and the shoppers know it. The same faces come back
            Saturday to see who is new, which is why a maker who sells two days often does
            better on the second one.
          </p>
          <p>
            <strong>Checking more than one day helps your odds.</strong> It tells us you are
            flexible, and it lets us fill a category that thins out on a Sunday. Some makers
            get offered a day they did not ask for because of it.
          </p>
        </Rules>

        <Pull>The lineup changes. <em>They come back.</em></Pull>
      </Sec>

      <Sec n="02" title="Is this you" id="fit" tint>
        <div className="prows air">
          <div className="row">
            <span className="q">Yes, if</span>
            <span className="a">
              Your work needs explaining, or half of it is priced over $100, or half of it is
              custom. You like people. A whole day of talking about what you make sounds like
              a good day rather than a long one.
            </span>
          </div>
          <div className="row">
            <span className="q">Probably not, if</span>
            <span className="a">
              Selling face to face makes you want to hide behind your phone, or you cannot
              give up a full day, or you would rather your work spoke for itself. That is
              what the room inside is for, and there is no shame in it.
            </span>
          </div>
          <div className="row">
            <span className="q">One or the other</span>
            <span className="a">
              You can apply for both tracks and we will place you where you fit, but you
              cannot do both at the same show. If you only want to be outside, say so.
            </span>
          </div>
        </div>
      </Sec>

      <Sec n="03" title="What it costs" id="cost">
        <Rules>
          <p style={{ marginBottom: 26 }}>
            One tent, one day, one price. You run your own register and we take none of it.
          </p>
        </Rules>
        <PriceTable spaces={spaces} extras={extras} bare />
        <Rules>
          <p style={{ marginTop: 26 }}>
            If you want to add a day after you are booked we can sometimes do it at half the
            rate of that day, depending on what is left.
          </p>
        </Rules>
      </Sec>

      <Sec n="04" title="The days" id="when" tint>
        <div className="prows air">
          {days.map((d) => {
            const [day, ...rest] = d.split(', ')
            return (
              <div className="row" key={d}>
                <span className="q">{day}</span>
                <span className="a num">{rest.join(', ')}</span>
              </div>
            )
          })}
          <div className="row">
            <span className="q">Setup</span>
            <span className="a">
              Your tent is standing when you get there. We send call times with your
              acceptance, and they are early enough to build without rushing.
            </span>
          </div>
          <div className="row">
            <span className="q">The lineup</span>
            <span className="a">
              Music, food, and the rest of the day-by-day schedule go out the week of the
              show. Overnight storage in your tent is not allowed any more.
            </span>
          </div>
        </div>
      </Sec>

      <div className="plate">
        <Photo src="/photos/tents.jpg" alt="The outdoor tent run on a show morning." />
        <div className="cp">
          <span>The tent run, {show.name}</span>
          <span>{tents} a day, new makers each day</span>
        </div>
      </div>

      <Sec n="05" title="Building your tent" id="tent">
        <Rules>
          <p>
            Our tents are 6.5 feet square and 7.5 feet tall, which is smaller than the pop-up
            you own. Measure your display against that number before you pack the car. A few
            10 × 10 tents exist and you can ask for one on the application.
          </p>
          <p>
            <strong>A backdrop is required.</strong> It hides the tent behind you and turns
            three walls of canvas into a shop. Curtains with holes for zip ties do the job for
            twenty dollars.
          </p>
          <p>
            <strong>Your shop name goes up, and not on vinyl.</strong> Painted, stitched,
            burned, printed on paper, anything with a hand in it.
          </p>
          <p>
            Keep the front of your tent open. No table across the entrance: shoppers need to
            come in, and so does anyone with a reason to move fast. Bring lights and turn
            them on when the sun drops. The makers who skip lights are the ones who watch the
            evening happen two tents down.
          </p>
          <p>
            <Link href="/lookbook/outdoor">The outdoor lookbook</Link> is eighteen tents from
            past shows, with our notes on what each of them got right.
          </p>
        </Rules>
      </Sec>

      <Sec n="06" title="What to bring" id="bring" tint>
        <Checklist
          items={[
            'Your card reader, and a hotspot in case the signal goes',
            'Cash and change, enough to break a hundred',
            'Weights for the tent legs and anything tall',
            'A backdrop, plus zip ties, tape, scissors, a small tool kit',
            'Extension cords with your name on them, and lights',
            'A chair you can actually sit in for eight hours',
            'A friend who can hold the tent while you eat',
            'More inventory than you think, hidden or in the car',
          ]}
        />
      </Sec>

      <Sec n="07" title="House rules" id="house">
        <div className="prows air">
          <div className="row">
            <span className="q">Stay at your tent</span>
            <span className="a">
              No walking the market handing out flyers. Give things away at your own space,
              or put on something for the kids. Nobody minds generosity that stays put.
            </span>
          </div>
          <div className="row">
            <span className="q">No piggybacking</span>
            <span className="a">
              You cannot pull stock from a maker selling inside to fill your tent, even with
              their blessing. It ends your run with us.
            </span>
          </div>
          <div className="row">
            <span className="q">Music</span>
            <span className="a">We run the sound for the whole market. Leave the speaker at home.</span>
          </div>
          <div className="row">
            <span className="q">MLM brands</span>
            <span className="a">
              Almost always no. The exception is a real product you made yourself with those
              materials, sold under your own name.
            </span>
          </div>
          <div className="row">
            <span className="q">Which day is busiest</span>
            <span className="a">
              None of them. Our sales say the days are the same, which is why two of the
              three cost the same. Pick the day that fits your life.
            </span>
          </div>
        </div>
      </Sec>

      <Sec n="08" title="Rain and refunds" id="rain" tint>
        <Rules>
          <p>
            <strong>Booth fees are not refundable.</strong> Most of what you pay for happens
            before you arrive: the placement, the printing, and every post that puts your shop
            in front of our list.
          </p>
          <p>
            If we call off an outdoor day for weather, you get the same day at the next show
            at no charge. If you would rather have money back, we refund 30% of the fee. If
            the show runs in imperfect weather and you decide not to come, we cannot make it
            up to you.
          </p>
          <p>
            If your own plans change, tell us during the application window and we will
            usually carry the fee to the next show. Finding your own replacement does not
            work, because bringing a new maker up to speed is the work.
          </p>
        </Rules>
        <Callout label="Ask us early">
          Everything above bends further in September than it does in November. Once we have
          placed you on the map and printed you in the guide, our hands are tied.
        </Callout>
      </Sec>

      <section className="apply">
        <div className="k">Ready</div>
        <h2 style={{ marginTop: 18 }}>Pick your <em>days.</em></h2>
        <p>
          One application covers both tracks. Check every day you would say yes to, and we
          read all of it.
        </p>
        <div className="cta">
          <Link href="/apply" className="btn">Apply to sell</Link>
          <Link href="/makers/indoor" className="btn line">Indoor rules</Link>
        </div>
        <div className="fine">No application fee</div>
      </section>

      <Footer show={show} />
    </>
  )
}
