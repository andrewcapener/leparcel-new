import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Sec, Rules, Checklist, PriceTable } from '@/components/rules'
import { ApplyForm } from './ApplyForm'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * /pages/merchant-application on the live site: the two pricing tables, the
 * show guidelines, the upcoming dates, the application FAQ, and then the
 * form.
 *
 * The live page is a hand-typed price list that goes stale between shows.
 * Here every price comes off space_types and add_ons and every date off the
 * Show record (CLAUDE.md rule 6), so /admin/show is the only place they are
 * edited. The prose is the market's own.
 */
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  // ?preview=1 shows the form outside the application window — view only.
  // Submission is still enforced server-side in actions.ts, which rejects
  // anything outside the window regardless of how the form was reached.
  const preview = (await searchParams).preview === '1'
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = await activeAddOns(show.id)

  const indoor = spaces.filter((s) => s.track === 'indoor')
  const outdoor = spaces.filter((s) => s.track === 'outdoor')
  // A null-track add-on is offered on both tables, as it is on the live page.
  const forTrack = (t: 'indoor' | 'outdoor') =>
    extras.filter((a) => a.track === null || a.track === t)
  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">Merchant application</div>
        <h1 className="lede">Show us<br /><em>what you make.</em></h1>
        <p>
          Market dates: {fmtRange(show.startsOn, show.endsOn)} at the Dana Point{' '}
          {show.venueName}. Applications are open{' '}
          {fmtDate(show.applicationsOpenAt, { year: undefined })} to{' '}
          {fmtDate(show.applicationsCloseAt, { year: undefined })} only.
        </p>
      </section>

      <Sec n="01" title="Indoor pricing" id="indoor">
        <Rules>
          <p>
            The inside space is register/retail style so you will not physically
            stand at your space to sell. We take {show.commissionBps / 100}% of
            each sale from our inside makers. Customers shop with a basket
            provided by Mermade and check out with our team at one exit point.{' '}
            <Link href="/makers/indoor">Read the inside maker rules</Link> before
            you apply.
          </p>
        </Rules>
        <PriceTable spaces={indoor} extras={forTrack('indoor')} />
      </Sec>

      <Sec n="02" title="Outdoor pricing" id="outdoor" tint>
        <Rules>
          <p>
            For the outside market space, you are right there, farmers market
            style, and you collect 100% of your sales via your preferred payment
            methods. No commission.{' '}
            <Link href="/makers/outdoor">Read the outside maker rules</Link>{' '}
            before you apply.
          </p>
        </Rules>
        <PriceTable spaces={outdoor} extras={forTrack('outdoor')} bare />
        <Rules>
          <p style={{ marginTop: 26 }}>
            If you choose only 1 day above, that tells us you will not be
            flexible. If you choose 2+ days to sell, you&rsquo;ll have a higher
            chance at getting in.
          </p>
        </Rules>
      </Sec>

      <Sec n="03" title="Show guidelines" id="guidelines">
        <Checklist items={[
          'No application fee',
          'No entrance fee for shoppers',
          'Free hugs + taffy',
          'Must read all maker rules before applying',
        ]} />
        <Rules>
          <p style={{ marginTop: 26 }}>
            <Link href="/makers/indoor">Inside maker rules</Link> ·{' '}
            <Link href="/makers/outdoor">Outside maker rules</Link> ·{' '}
            <Link href="/lookbook/indoor">Indoor lookbook</Link> ·{' '}
            <Link href="/lookbook/outdoor">Outdoor lookbook</Link>
          </p>
        </Rules>
      </Sec>

      <Sec n="04" title="Upcoming dates" id="dates" tint>
        <div className="prows air">
          <div className="row">
            <span className="q">Applications open</span>
            <span className="a num">{fmtDate(show.applicationsOpenAt)}</span>
          </div>
          <div className="row">
            <span className="q">Applications close</span>
            <span className="a num">{fmtDate(show.applicationsCloseAt)}, 11:59pm PT</span>
          </div>
          <div className="row">
            <span className="q">Maker line up announced</span>
            <span className="a num">{fmtDate(show.rosterAnnouncedOn)}</span>
          </div>
          {show.loadInNote && (
            <div className="row">
              <span className="q">Inside maker set up</span>
              <span className="a">{show.loadInNote}</span>
            </div>
          )}
          {show.takedownNote && (
            <div className="row">
              <span className="q">Inside maker take down</span>
              <span className="a">{show.takedownNote}</span>
            </div>
          )}
          <div className="row">
            <span className="q">Hours the show is open</span>
            <span className="a num">{show.hoursNote.split(' · ').join(' · ')}</span>
          </div>
          <div className="row">
            <span className="q">Booth fees due</span>
            <span className="a">
              Within {show.paymentWindowHours} hours of being accepted and
              invoiced. If you do not pay, we give your space to another willing
              maker. We always have a waitlist.
            </span>
          </div>
        </div>
      </Sec>

      <Sec n="05" title="Merchant application FAQ" id="faq">
        <Rules>
          <p>
            Mermade Market is a truly unique shopping experience, and
            we&rsquo;re thrilled that you&rsquo;re interested in becoming one of
            our official makers. Our upcoming {show.name} show will take place{' '}
            {fmtRange(show.startsOn, show.endsOn)} at the Dana Point{' '}
            {show.venueName}, a beautiful coastal venue just steps from the
            ocean. We work hard to curate an incredible mix of talented makers
            and passionate shoppers, creating an atmosphere that is both
            inspiring and profitable for our vendors.
          </p>
          <p>
            Our team prides itself on being organized, thorough, and supportive,
            from the application process all the way through market weekend. We
            actively promote our makers on social media before, during, and
            after the show, and we do everything we can to bring the right
            audience through the doors.
          </p>
          <p>
            Because our show operates a bit differently than many traditional
            markets, we want to make sure every maker understands exactly how
            things work and what will be expected. That&rsquo;s why our
            application is a bit detailed. Hang with us, it&rsquo;s worth it.
            Don&rsquo;t worry if you don&rsquo;t have every answer right away.
            If you&rsquo;re accepted, we&rsquo;ll provide a full vendor packet
            with all the details you&rsquo;ll need.
          </p>
        </Rules>

        <div className="prows air" style={{ marginTop: 40 }}>
          <div className="row">
            <span className="q">Our mission with applications</span>
            <span className="a">
              To bring our customers the freshest goods so they can feel great
              about buying for themselves and gifting to everyone they love. We
              keep the market curated and approachable so you aren&rsquo;t
              overwhelmed with too many options, and we avoid having multiple
              shops with similar product. We select only 1-3 makers within each
              category, so if we get 15 applications from shops selling leather
              goods, we will choose 1 or 2.
            </span>
          </div>
          <div className="row">
            <span className="q">How long are applications open</span>
            <span className="a">
              Only for the window above. Once they&rsquo;re closed, they remain
              closed until the following show. The review process starts the
              moment applications open. You are welcome to join the waitlist,
              although it&rsquo;s rare we glance at it once the ball gets
              rolling.
            </span>
          </div>
          <div className="row">
            <span className="q">What happens if I&rsquo;m not accepted</span>
            <span className="a">
              Because we get hundreds of applications, we can only accept a
              certain number for our specific vibe and market size. There may
              not be enough space, or your product may not quite fit our
              customer&rsquo;s style, or your brand may not be fully solidified
              yet. Please look at non-acceptance as a chance to learn, grow, and
              move forward. We especially love when we see makers re-apply with
              a stronger brand.
            </span>
          </div>
          <div className="row">
            <span className="q">If I&rsquo;m a food vendor do I need a permit</span>
            <span className="a">
              Yes. The Health Department requires us to gather applications and
              fees from each maker, and the deadline is enclosed in your vendor
              packet. If you are making your food at home and not using a
              commercial kitchen, you need a cottage food license: see{' '}
              <a href="http://www.ocfoodinfo.com/cottage" target="_blank" rel="noreferrer">
                ocfoodinfo.com/cottage
              </a>
              . Please do not apply for it until you are accepted.
            </span>
          </div>
          <div className="row">
            <span className="q">Inside merchants, when do I get paid</span>
            <span className="a">
              We send your payment 7-10 days after the last date of market with
              a detailed sales report.
            </span>
          </div>
          <div className="row">
            <span className="q">Want to promote your business</span>
            <span className="a">
              We have options on the application for social media shout outs,
              giveaways and swag. If you want to offer a free activity during
              the show, say so in your application and we&rsquo;ll take it from
              there.
            </span>
          </div>
        </div>
      </Sec>

      {win === 'open' || preview ? (
        <>
          {win !== 'open' && (
            <section className="apply" style={{ paddingBottom: 0 }}>
              <div className="k">
                Preview. Applications are not open, and submissions are disabled until{' '}
                {fmtDate(show.applicationsOpenAt)}.
              </div>
            </section>
          )}
          <ApplyForm show={show} spaces={spaces} extras={extras} />
        </>
      ) : (
        <section className="apply">
          <div className="k">{win === 'before' ? 'Not open yet' : 'Closed'}</div>
          <h2 style={{ marginTop: 18 }}>
            {win === 'before'
              ? `Applications open ${fmtDate(show.applicationsOpenAt)}.`
              : `Applications for ${show.name} closed ${fmtDate(show.applicationsCloseAt)}.`}
          </h2>
          <p>
            {win === 'before'
              ? 'Join the list and we’ll email you the morning they open.'
              : 'Join the list and we’ll email you the morning the next window opens.'}
          </p>
        </section>
      )}

      <Footer show={show} />
    </>
  )
}
