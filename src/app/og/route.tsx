import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { activeShow } from '@/db/queries'
import { cityOf, datesNoYear } from '@/server/modules/og/facts'
import { brandFonts } from '@/server/modules/og/fonts'
import { BandCard, SHOW_CREAM, type CardFacts } from '@/server/modules/og/card'

/**
 * The picture a shared link shows, drawn from the Show record.
 *
 * This used to be public/photos/og.jpg: the painted backdrop and the market's
 * name, which tells somebody who already knows the market nothing new and
 * tells everybody else nothing at all. No date, no venue, no "free". The
 * whole reason a person taps a link is on this card now.
 *
 * Drawn rather than baked, because the alternative is a JPEG with November
 * 13-15 inside it that somebody has to remember to re-cut the day the show
 * moves. It has moved three times in three shows. CLAUDE.md rule 6.
 *
 * The photograph is Drew's pick, 24 Sept 2026, and it is a full 1200x1800
 * portrait, so the band is a straight crop out of it with nothing upscaled.
 * Picking it mattered more than the layout did: most of public/photos is from
 * a venue this market has left (photos/tents.jpg still has RIVER STREET on
 * the building behind it), so a link to a Dana Point market was advertising
 * the old address.
 *
 * Cached for a day at the edge. A scraper is the least patient client there
 * is, and none of them will wait for a cold function to load three fonts and
 * a photograph.
 */
export const revalidate = 86400

/** Satori will not fetch a relative url, so everything is inlined. */
async function dataUri(rel: string, mime: string) {
  const b = await readFile(join(process.cwd(), 'public', rel))
  return `data:${mime};base64,${b.toString('base64')}`
}

/**
 * The wordmark in the season's cream, off the one master.
 *
 * public/mermade-wordmark.svg is drawn in `currentColor`, which is what makes
 * this honest: it is the same artwork as every other lockup with a colour
 * substituted, the way scripts/build-brand-assets.ts makes the committed
 * ones. The committed white is #FFFFFF, and pure white against this olive is
 * a slightly different mark to the one the season's posters use.
 */
async function creamWordmark() {
  const svg = await readFile(join(process.cwd(), 'public/mermade-wordmark.svg'), 'utf8')
  const tinted = svg.replaceAll('currentColor', SHOW_CREAM)
  return `data:image/svg+xml;base64,${Buffer.from(tinted).toString('base64')}`
}

/* 1200x1800, and the card needs the shape to work out the crop. */
const PHOTO = 'photos/lot.jpg'
const PHOTO_ASPECT = 1200 / 1800

export async function GET() {
  const show = await activeShow()
  if (!show) return new Response('No active show.', { status: 404 })

  /* "November 13-15 · Dana Point" over "Community House · Free to attend".
     The year was the least useful thing on it, and the town is what somebody
     deciding whether to come actually needs. The town moves up rather than
     being said twice: it reads badly directly above "Dana Point Community
     House", and the venue line still names the building. */
  const town = cityOf(show.venueAddress)
  const facts: CardFacts = {
    dates: town
      ? `${datesNoYear(show.startsOn, show.endsOn)} · ${town}`
      : datesNoYear(show.startsOn, show.endsOn),
    venue: show.venueName,
    /* Unused by this layout, and required by the type. */
    kicker: '',
    photo: await dataUri(PHOTO, 'image/jpeg'),
    photoAspect: PHOTO_ASPECT,
    /* The band is 412 of 1800, so most of this photograph is not on the card
       and which slice is chosen is the whole decision. Higher is sky and an
       empty canopy; lower crops through the shoppers' heads. Here you get
       both of them, the maker at her stands, and the tents behind. */
    photoOffsetY: 0.50,
    wordmark: await creamWordmark(),
  }

  return new ImageResponse(<BandCard {...facts} />, {
    width: 1200, height: 630, fonts: await brandFonts(),
  })
}
