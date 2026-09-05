import { activeShow } from '@/db/queries'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import { VideoBanner, VideoBand, RichText, MapSection, ScrollingBanner, ArticleRow } from '@/components/theme/Sections'
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
    <>
      <AnnouncementBar show={show} />
      <PageHeader transparent />

      <main id="content" role="main">
        <div className="container cf">
          <VideoBanner
            id="section-hero"
            poster="41df92641ed44b9c95d14621276977b2.thumbnail.0000000000.jpg"
            video={C.heroVideoId}
            subheading="HAND CURATED"
            title={<>SHOP SMALL <br /> MAKERS MARKET</>}
            cta={{ href: '/apply', label: 'APPLY NOW' }}
          >
            <p>
              {fmtRange(show.startsOn, show.endsOn)} | Dana Point {show.venueName}
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
            image="IMG_2793.jpg"
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

          <VideoBand
            id="section-film"
            poster="IMG_3335.jpg"
            video={C.films[1]?.youtubeId}
          />

          <ArticleRow heading="Mermade Journal" headingHref="/journal" articles={posts} />
        </div>
      </main>

      <PageFooter show={show} />
    </>
  )
}
