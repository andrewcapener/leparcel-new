import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Photo } from '@/components/Photo'
import { HeroVideo } from '@/components/HeroVideo'
import { Masthead, Footer } from '@/components/site'
import { fmtRange } from '@/lib/dates'
import * as C from '@/lib/content'
import { journal, excerpt } from '@/lib/journal'

export const dynamic = 'force-dynamic'

/**
 * The home page, matching mermademarket.com section for section.
 *
 * The live page renders six things and no more: the background-video hero,
 * the rich-text tagline, the map, the scrolling banner, an empty second
 * video block, and the featured blog. Everything dated reads from the Show
 * record instead of being typed in, which is the one deliberate difference
 * — the live site still says May 15-17.
 *
 * Sections this page used to carry (the fact bar, the founder letter, the
 * category shelf, visiting, the film block, the archive teaser, the
 * merchant directory, the apply band) are not on the live site and were
 * removed. They are in git history if any of them are wanted back.
 */
export default async function Home() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  return (
    <>
      <Masthead show={show} />

      {/* ── background-video ─────────────────────────────────────── */}
      <Photo src="/photos/hero.jpg" alt="" priority className="hero">
        <HeroVideo youtubeId={C.heroVideoId} />
        <div className="in">
          <div className="eyebrow">Hand curated</div>
          <h1>
            Shop small
            <br />
            <em>makers market</em>
          </h1>
          {/* One line, as the live site runs it: "May 15-17, 2026 | Dana Point
              Community House". */}
          <div className="when num" style={{ marginTop: 20 }}>
            {fmtRange(show.startsOn, show.endsOn)} <span aria-hidden="true">|</span>{' '}
            Dana Point {show.venueName}
          </div>
          <div className="bar">
            <Link href="/apply" className="btn">Apply now</Link>
          </div>
        </div>
      </Photo>

      {/* ── rich-text ────────────────────────────────────────────── */}
      <section className="mission">
        <h2>Shop small. <em>Think big.</em></h2>
        <p>{C.mission}</p>
      </section>

      {/* ── map ──────────────────────────────────────────────────── */}
      <section className="venue">
        <Photo src="/photos/venue.jpg" alt={`${show.venueName}, Dana Point`} sizes="(max-width:900px) 100vw, 52vw" />
        <div className="tx">
          <h2>Mermade Market {show.name} showcase</h2>
          <div className="ad">{show.venueAddress}</div>
          {/* One line a day, unsplit, the way the live map section writes it:
              "May 15, 9am - 6pm (Fri)". */}
          <div className="hrs">
            {show.hoursNote.split(' · ').map((d) => (
              <div key={d}><span className="num">{d}</span></div>
            ))}
          </div>
          <div>
            <a
              className="btn"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(show.venueAddress)}`}
            >
              Directions
            </a>
          </div>
        </div>
      </section>

      {/* ── scrolling-banner ─────────────────────────────────────── */}
      <div className="marquee" aria-hidden="true">
        <div className="track">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i}>Shop small · Think big · Mermade Market · </span>
          ))}
        </div>
      </div>

      {/* ── featured-blog ────────────────────────────────────────── */}
      <section className="sec">
        {/* The live featured-blog section is a centred linked heading and three
            cards carrying an excerpt. No eyebrow, no "all posts" link. */}
        <div className="shead center">
          <h2><Link href="/journal">Mermade Journal</Link></h2>
        </div>
        <div className="jgrid">
          {journal.slice(0, 3).map((jp) => (
            <Link href={`/journal/${jp.slug}`} key={jp.slug} className="jcard">
              {jp.image
                ? <Photo src={jp.image} alt="" tone="soft" sizes="(max-width:900px) 50vw, 30vw" />
                : <div className="jnone" aria-hidden="true" />}
              <div className="nm">{jp.title}</div>
              <p className="ex">{excerpt(jp)}</p>
            </Link>
          ))}
        </div>
      </section>

      <Footer show={show} />
    </>
  )
}
