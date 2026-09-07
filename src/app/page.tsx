import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { LdJson, eventLd, organizationLd } from '@/lib/structured-data'
import { VideoBanner, RichText, MapSection } from '@/components/theme/Sections'
import { PhotoStrip } from '@/components/theme/PhotoStrip'
import { ApplyBand } from '@/components/theme/ApplyBand'
import { activeSpaceTypes } from '@/db/queries'
import { fmtRange, fmtDeadline, daysUntil } from '@/lib/dates'
import { usd, bpsLabel } from '@/lib/money'
import * as C from '@/lib/content'

export const dynamic = 'force-dynamic'

/**
 * The home page, in mermademarket.com's own sections and in their order:
 * the background-video hero, the rich-text line, the map, the scrolling
 * banner, a second full-bleed video band, and the featured blog.
 *
 * Their store-messages strip ("Free shipping on orders over $100") is on the
 * live page but their own header CSS hides it, so it is not here either.
 *
 * The only edits are the ones CLAUDE.md rule 6 forces: the dates and the
 * venue read off the Show record instead of being typed into the section.
 */
export default async function Home() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  /* The apply band's numbers, all read rather than written. The cheapest way
     in on each track is the honest headline figure: a maker deciding whether
     to bother wants to know what it costs at the bottom, not the average. */
  const spaces = await activeSpaceTypes(show.id)
  const cheapest = (track: string) =>
    spaces.filter((s) => s.track === track).reduce<number | null>(
      (low, s) => (low === null || s.priceCents < low ? s.priceCents : low), null)
  const indoorFrom = cheapest('indoor')
  const outdoorFrom = cheapest('outdoor')

  /* Days to the deadline, as Pacific calendar dates rather than as elapsed
     time. Dividing milliseconds gave FIFTEEN on opening morning, against a
     window Elise called fourteen days and the FAQ now states, so the homepage
     would have contradicted the FAQ on day one. See daysUntil and its test. */
  const daysLeft = daysUntil(show.applicationsCloseAt)
  const open = new Date(show.applicationsCloseAt).getTime() > Date.now()

  return (
    <SiteShell show={show} template="index" transparentHeader>
      {/* The show as an Event, so a search result can carry the dates and the
          venue instead of only a title. Built from the Show record, so moving
          the show at /admin/show moves this with it. */}
      <LdJson data={organizationLd()} />
      <LdJson data={eventLd(show)} />
      
          <VideoBanner
            id="section-hero"
            poster="/photos/shelf.jpg"
            video={C.heroVideoId}
            subheading="HAND CURATED"
            title={<>SHOP SMALL <br /> MAKERS MARKET</>}
            cta={{ href: '/apply', label: 'APPLY NOW' }}
          >
            {/* docs/08-DESIGN-SYSTEM.md §6 rule 1: dates, venue and "free"
                above the fold. "Free" appeared nowhere on the home page — only
                inside a collapsed accordion on /faq. */}
            <p>
              {fmtRange(show.startsOn, show.endsOn)} · Dana Point {show.venueName} · Free to attend
            </p>
          </VideoBanner>

          <RichText
            title={<>SHOP SMALL. Think BIG.</>}
            mark="Screen_Shot_2024-01-24_at_4.04.24_PM.png"
          >
            <p>{C.mission}</p>
          </RichText>

          <MapSection
            id="section-map"
            title={`Mermade Market ${show.name} showcase`}
            directionsTo={show.venueAddress}
            image="/photos/register.jpg"
            map="/photos/lot.jpg"
          >
            <p />
            <p>{show.venueAddress}</p>
            <p>
              {show.hoursNote.split(' · ').map((d, i, all) => (
                <span key={d}>{d}{i < all.length - 1 && <br />}</span>
              ))}
            </p>
          </MapSection>

          {/* The text ticker that used to run here is gone.

              It said SHOP SMALL · THINK BIG · MERMADE MARKET, and it sat
              directly on top of the filmstrip, which put two moving things
              within a few hundred pixels of each other and made the page feel
              busy rather than alive. Drew: "the ticker tape above, should we
              move that somewhere?"

              Moving it would only have relocated the problem, because there
              is nowhere on this page a second marquee earns its keep. The
              ticker existed to make the page feel alive and the strip now
              does that with a hundred real makers instead of three slogans.
              It still runs on /collaborate and /sponsorships, where there is
              no strip to compete with it. */}

          {/* The ask, on paper, between the two picture bands.

              It does two jobs that turned out to be one job. The page had no
              way to apply below the hero, and it had the map's photographs
              touching the filmstrip. A block made of type separates the two
              picture bands AND is the thing the page was failing to ask for.

              Only while the window is open. A dead form is worse than no
              form: it asks somebody to do a thing and then refuses them. */}
          {open && indoorFrom !== null && outdoorFrom !== null && (
            <ApplyBand
              id="section-apply"
              deadline={fmtDeadline(show.applicationsCloseAt)}
              commission={bpsLabel(show.commissionBps)}
              indoorFrom={usd(indoorFrom)}
              outdoorFrom={usd(outdoorFrom)}
              daysLeft={daysLeft}
            />
          )}

          {/* The filmstrip that replaced the second background video.

              That band ran the clip from the old Shopify site, which is why
              it was full of a venue Mermade left. Drew asked for a slider;
              this is a marquee instead, because a slider shows one
              photograph at a time and the argument this band has to make is
              quantity. It also rhymes with the text ticker directly above
              it, so it reads as part of the page rather than as a widget. */}
          <PhotoStrip
            id="section-strip"
            /* Started on a different frame each visit. The cycle is fixed, so
               rotating it cannot put the same maker beside herself again;
               see the note on stripFrames. */
            frames={C.rotated(C.stripFrames, Math.floor(Math.random() * C.stripFrames.length))}
          />

          {/* The Mermade Journal row used to close this page, and it was the
              biggest block on it: three full article cards, 1480px of them on
              a phone, in the position of emphasis right above the footer.
              Elise asked for it off the homepage. The journal itself is
              unchanged and still linked from the footer, so nothing is lost
              except the weight it was carrying here. */}
        </SiteShell>
  )
}
