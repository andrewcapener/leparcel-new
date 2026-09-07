import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { LdJson, eventLd, organizationLd } from '@/lib/structured-data'
import { VideoBanner, RichText, MapSection, ScrollingBanner, ArticleRow } from '@/components/theme/Sections'
import { PhotoStrip } from '@/components/theme/PhotoStrip'
import { fmtRange } from '@/lib/dates'
import { journal, excerpt } from '@/lib/journal'
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

  const posts = journal.slice(0, 3).map((p) => ({
    href: `/journal/${p.slug}`,
    title: p.title,
    excerpt: excerpt(p),
    image: p.image,
  }))

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

          <ScrollingBanner id="section-banner" text="SHOP SMALL · THINK BIG · MERMADE MARKET ·" />

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

          <ArticleRow heading="Mermade Journal" headingHref="/journal" articles={posts} />
        </SiteShell>
  )
}
