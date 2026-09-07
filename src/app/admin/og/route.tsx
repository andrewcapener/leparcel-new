import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { NextRequest } from 'next/server'
import { activeShow } from '@/db/queries'
import { fmtRange } from '@/lib/dates'
import { brandFonts } from '@/server/modules/og/fonts'
import { PosterCard, SplitCard, BroadsideCard, type CardFacts } from '@/server/modules/og/card'

/**
 * The social card, rendered for choosing between. Behind the /admin gate.
 *
 * ?v=a|b|c picks the design, ?photo= picks the photograph. It exists so a
 * design decision gets made by looking at the three at 1200x630 rather than
 * from a description, and it stays afterwards because the card is generated
 * from the Show record and somebody will want to see what it says now.
 */
export const dynamic = 'force-dynamic'

/** Satori will not fetch a relative url, so everything is inlined. */
async function dataUri(rel: string, mime: string) {
  const b = await readFile(join(process.cwd(), 'public', rel))
  return `data:${mime};base64,${b.toString('base64')}`
}

export async function GET(req: NextRequest) {
  const show = await activeShow()
  if (!show) return new Response('No active show.', { status: 404 })

  const v = req.nextUrl.searchParams.get('v') ?? 'a'
  const photo = req.nextUrl.searchParams.get('photo') ?? 'photos/crowd.jpg'

  const facts: CardFacts = {
    dates: fmtRange(show.startsOn, show.endsOn),
    venue: `Dana Point ${show.venueName}`,
    kicker: 'Applications open',
    photo: await dataUri(photo, 'image/jpeg'),
    wordmark: await dataUri(
      v === 'a' ? 'brand/mermade-wordmark-white.svg' : 'brand/mermade-wordmark-ink.svg',
      'image/svg+xml',
    ),
  }

  const Card = v === 'b' ? SplitCard : v === 'c' ? BroadsideCard : PosterCard
  return new ImageResponse(<Card {...facts} />, {
    width: 1200, height: 630, fonts: await brandFonts(),
  })
}
