import { eq, asc, and } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { shows, spaceTypes, addOns } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { Toc, Sec, Rules, Pull, Callout, PriceTable } from '@/components/rules'
import { usd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Selling inside · Mermade Market',
  description:
    'How the indoor consignment room works: what it costs, when to load in, how to build and label your space, and how you get paid.',
}

/**
 * The indoor maker rules, ported from the old Shopify site's "Indoor
 * Merchants" page and rewritten to docs/12-VOICE.md. Every date, price,
 * rate and capacity is read from the Show record and space_types
 * (CLAUDE.md rule 6). Nothing here is typed in by hand.
 */
export default async function IndoorRules() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await db.query.spaceTypes.findMany({
    where: and(eq(spaceTypes.showId, show.id), eq(spaceTypes.track, 'indoor')),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = (await activeAddOns(show.id)).filter((a) => a.track === null || a.track === 'indoor')

  const shops = spaces.reduce((n, s) => n + s.capacity, 0)
  const low = Math.min(...spaces.map((s) => s.priceCents))
  const high = Math.max(...spaces.map((s) => s.priceCents))
  const days = show.hoursNote.split(' · ')

  const toc = [
    { id: 'how', label: 'How it works' },
    { id: 'cost', label: 'What it costs' },
    { id: 'when', label: 'The calendar' },
    { id: 'space', label: 'Your space' },
    { id: 'tags', label: 'Tags' },
    { id: 'special', label: 'Special spaces' },
    { id: 'fine', label: 'The fine print' },
  ]

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">For makers · Selling inside</div>
        <h1 className="lede">
          Drop it off.<br /><em>We sell it.</em>
        </h1>
        <p>
          {shops} shops fill the {show.venueName} for the whole weekend and the makers are
          not in the room. Our staff merchandises the floor, runs the register, and restocks
          your shelves while you are somewhere else.
        </p>
      </section>

      <div className="facts">
        <div><div className="k">Shops inside</div><div className="v num">{shops}</div></div>
        <div><div className="k">Our commission</div><div className="v num hl">{show.commissionBps / 100}%</div></div>
        <div><div className="k">Booth fees</div><div className="v num">{usd(low)}-{usd(high)}</div></div>
        <div><div className="k">Days on site</div><div className="v">Load-in</div></div>
      </div>

      <Toc items={toc} />

      <Sec n="01" title="How the room works" id="how">
        <Rules>
          <p>
            Half of Mermade is a shop. You build your space on load-in day, hand us your
            inventory list, and go home. Shoppers walk the room with a basket, pick from
            every maker at once, and pay in one place at the front.
          </p>
          <p>
            Every item carries a tag with your code on it, so every sale lands against your
            name. We keep <strong>{show.commissionBps / 100}%</strong> of what sells. You
            keep the rest, and it is paid within a week of the last day of the show.
          </p>
          <p>
            This is the part of the market we built first, and it exists for the maker with
            a day job, a toddler, or no interest in standing behind a table for three days.
            If selling face to face is the part you love, read{' '}
            <Link href="/makers/outdoor">the outdoor rules</Link> instead.
          </p>
        </Rules>

        <Pull>Shop the whole room, <em>pay once.</em></Pull>

        <div className="prows air">
          <div className="row">
            <span className="q">You bring</span>
            <span className="a">
              Your work, your display, your extension cord, and enough backstock to survive
              a good weekend. Makers do sell out.
            </span>
          </div>
          <div className="row">
            <span className="q">We bring</span>
            <span className="a">
              The floor, the staff, the registers, the bags, the music, power at every
              space, and overnight security between show days.
            </span>
          </div>
          <div className="row">
            <span className="q">Restocking</span>
            <span className="a">
              We hold your backstock and refill your shelves as things sell. You are welcome
              to come do it yourself in the quiet hours, late afternoon is best.
            </span>
          </div>
        </div>
      </Sec>

      <Sec n="02" title="What it costs" id="cost" tint>
        <PriceTable spaces={spaces} extras={extras} />
      </Sec>

      <Sec n="03" title="The calendar" id="when">
        <div className="prows air">
          <div className="row">
            <span className="q">Load-in</span>
            <span className="a">
              {show.loadInNote || 'Announced with your acceptance.'} There is no second
              load-in and no Friday morning setup. If you cannot be there and cannot send
              someone, take the outdoor track or the next show.
            </span>
          </div>
          <div className="row">
            <span className="q">Show hours</span>
            <span className="a num">{days.join(' · ')}</span>
          </div>
          <div className="row">
            <span className="q">Take-down</span>
            <span className="a">{show.takedownNote || 'Announced with your acceptance.'}</span>
          </div>
          <div className="row">
            <span className="q">Inventory list</span>
            <span className="a">
              Due two weeks out: every item and its price. It is what the registers ring
              against, so a price that is not on the list cannot be sold at that price.
            </span>
          </div>
          <div className="row">
            <span className="q">Getting paid</span>
            <span className="a">
              Within a week of the last day, with a statement showing every sale under your
              code and the commission taken out.
            </span>
          </div>
        </div>
      </Sec>

      <div className="plate">
        <Photo src="/photos/floor.jpg" alt="The indoor room during a show, shops built out along the floor." />
        <div className="cp">
          <span>The room, mid-show</span>
          <span>{show.venueName}, Dana Point</span>
        </div>
      </div>

      <Sec n="04" title="Building your space" id="space" tint>
        <Rules>
          <p>
            The first number in a space size is depth, the second is width. A{' '}
            {spaces.find((s) => s.code === 'IN-3x6')?.label ?? "3' × 6' space"} is three feet
            deep and six feet wide, and it is yours to build up as well as out.
          </p>
          <p>
            Think in vertical shapes. Shelving, crates, a pegboard, a slim pipe hung across
            the top for shirts, lights of any kind. A table with the work laid flat is the
            one setup that reliably underperforms, and it is what most first-timers bring.
          </p>
          <p>
            <strong>Put your shop name in your space.</strong> Our floor staff answer
            questions about you all weekend, and a shopper who can read your name is a
            shopper who can find you again in March.
          </p>
          <p>
            Power runs to every space. Bring your own extension cord with your name taped to
            it. If it is your first show and you want help planning the space, ask us before
            load-in rather than at 6pm on load-in day.
          </p>
          <p>
            <Link href="/lookbook/indoor">The indoor lookbook</Link> is twenty-three real
            spaces from past shows at every size, with our notes on what each one got right.
          </p>
        </Rules>
      </Sec>

      <Sec n="05" title="Tags and labels" id="tags">
        <Rules>
          <p>
            You get a Mermade code when you are accepted, and it goes on everything. A tag
            reads like <strong>MM34 $15</strong>: your code, then the price, large enough to
            read across a counter and never bigger than the thing it is tied to.
          </p>
          <p>
            Attach them neatly and attach them well. A tag that falls off is a sale we cannot
            credit to you, and a price we cannot read is a price we have to guess at with six
            people in line.
          </p>
        </Rules>
        <Callout label="Where money comes off">
          Unlabeled or badly labeled goods cost {usd(10_000)} off your payout, because our
          staff end up pricing your work for you. Jewelry needs a box or a bag left at your
          space for shoppers to take: no box costs {usd(2_000)}, since we supply them for
          three days instead.
        </Callout>
      </Sec>

      <Sec n="06" title="The special spaces" id="special" tint>
        <div className="prows air">
          <div className="row">
            <span className="q">Treats on a shelf</span>
            <span className="a">
              Five shelves next to the register, sized for something a shopper adds on the
              way out. Keep items under $10. We take four treat makers, one per kind, so
              two people are not both selling caramels. You will need a cottage food permit,
              and you should wait until you are accepted to apply for it.
            </span>
          </div>
          <div className="row">
            <span className="q">Junior makers</span>
            <span className="a">
              14 and under, two feet wide, shelf provided, bring finished work. We run it
              when at least two juniors get in. If your business is already running and you
              happen to be 17, this is not your space. Look at the boutique footprint.
            </span>
          </div>
          <div className="row">
            <span className="q">Jewelry</span>
            <span className="a">
              Out of the plastic bags. They read as tidy to the maker and as tacky to the
              shopper, and the sales bear it out every single show.
            </span>
          </div>
          <div className="row">
            <span className="q">Art and prints</span>
            <span className="a">
              The room is not a gallery. Work under $100 moves here, originals do better
              outside where you can talk about them, and prints sit somewhere in between.
            </span>
          </div>
        </div>
      </Sec>

      <Sec n="07" title="The fine print" id="fine">
        <Rules>
          <p>
            <strong>Booth fees are not refundable.</strong> The work of placing you, printing
            you, and promoting you happens long before the doors open. If something goes
            wrong on your end, talk to us during the application window and we will usually
            carry your fee to the next show.
          </p>
          <p>
            <strong>We cannot insure your work.</strong> We have security overnight and staff
            on the floor all day, and things still occasionally break or go missing. Your own
            liability insurance is a good idea and it is not required to sell with us.
          </p>
          <p>
            <strong>Custom orders are hard to take inside.</strong> There is nobody at your
            space to have that conversation. A sign that says you take commissions works;
            counting on order forms does not.
          </p>
        </Rules>
      </Sec>

      <section className="apply">
        <div className="k">Ready</div>
        <h2 style={{ marginTop: 18 }}>Show us <em>what you make.</em></h2>
        <p>
          One application covers both tracks. Check every space you would say yes to, and
          we read all of it.
        </p>
        <div className="cta">
          <Link href="/apply" className="btn">Apply to sell</Link>
          <Link href="/makers/outdoor" className="btn line">Outdoor rules</Link>
        </div>
        <div className="fine">No application fee</div>
      </section>

      <Footer show={show} />
    </>
  )
}
