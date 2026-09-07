/* eslint-disable @next/next/no-img-element */
/**
 * The social card: what a shared link looks like in a text, a Slack, a feed.
 *
 * Three things this has to survive, and they drive every decision below.
 *
 * 1 · It is read at THUMBNAIL SIZE. Slack renders it about 360px wide, which
 *     is a 3.3x reduction, so 36px type arrives at 11px. Nothing here is set
 *     below 30px and the headline is set enormous, because a card that needs
 *     to be opened to be read has already failed.
 * 2 · It has to say something. The old card was a photograph of the backdrop
 *     and the market's name, which is what somebody who already knows the
 *     market would recognise and tells everybody else nothing. The dates, the
 *     venue and "free" are the whole reason a person taps.
 * 3 · Those facts come off the SHOW RECORD, never a string typed in here.
 *     CLAUDE.md rule 6. A card with a date baked into a JPEG goes stale the
 *     moment somebody edits /admin/show, and nobody would notice for a month.
 *
 * Photographs are passed in as data URIs because satori will not fetch a
 * relative url, and a card that depends on the network to draw renders empty
 * the one time the network is slow.
 */

export type CardFacts = {
  /** "November 13-15, 2026" */
  dates: string
  /** "Dana Point Community House" */
  venue: string
  /** The line that changes with the season: a deadline, or the standing note. */
  kicker: string
  /** Optional second line under the dates. */
  standfirst?: string
  photo: string
  wordmark: string
}

const GOLD = '#BC9658'
const INK = '#171717'
const PAPER = '#FAFAF8'

/** A · Poster. The photograph carries it, the facts sit in the dark. */
export function PosterCard(f: CardFacts) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', backgroundColor: INK }}>
      <img src={f.photo} width={1200} height={630} style={{ position: 'absolute', objectFit: 'cover' }} alt="" />
      {/* A scrim, not a tint: type over a photograph needs a floor under it or
          it is legible on this picture and gone on the next one. */}
      <div style={{
        position: 'absolute', width: 1200, height: 630, display: 'flex',
        background: 'linear-gradient(180deg, rgba(10,10,10,0.18) 0%, rgba(10,10,10,0.42) 42%, rgba(10,10,10,0.86) 100%)',
      }} />
      <div style={{
        position: 'absolute', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        width: 1200, height: 630, padding: '0 72px 62px',
      }}>
        <img src={f.wordmark} width={300} style={{ marginBottom: 26 }} alt="Mermade Market" />
        <div style={{ display: 'flex', fontFamily: 'Oswald', fontSize: 78, lineHeight: 1, color: '#fff', letterSpacing: 1 }}>
          {f.dates.toUpperCase()}
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontFamily: 'Figtree', fontSize: 34, color: 'rgba(255,255,255,0.92)' }}>
          {f.venue} · Free to attend
        </div>
        <div style={{ display: 'flex', marginTop: 22, fontFamily: 'Oswald', fontSize: 26, letterSpacing: 3.4, color: GOLD }}>
          {f.kicker.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

/** B · Split. Half paper, half photograph. The most legible at thumbnail. */
export function SplitCard(f: CardFacts) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: PAPER }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        width: 690, height: 630, padding: '0 60px', backgroundColor: PAPER,
      }}>
        <img src={f.wordmark} width={268} style={{ marginBottom: 34 }} alt="Mermade Market" />
        <div style={{ display: 'flex', width: 62, height: 3, backgroundColor: GOLD, marginBottom: 30 }} />
        <div style={{ display: 'flex', fontFamily: 'Oswald', fontSize: 56, lineHeight: 1.02, color: INK, letterSpacing: 0.6, whiteSpace: 'nowrap' }}>
          {f.dates.toUpperCase()}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontFamily: 'Figtree', fontSize: 31, color: '#5C5C5C' }}>
          {f.venue}
        </div>
        <div style={{ display: 'flex', marginTop: 30, fontFamily: 'Oswald', fontSize: 24, letterSpacing: 3.2, color: GOLD }}>
          {f.kicker.toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', width: 510, height: 630 }}>
        <img src={f.photo} width={510} height={630} style={{ objectFit: 'cover' }} alt="" />
      </div>
    </div>
  )
}

/** C · Broadside. Paper, rules, the date enormous. No photograph at all. */
export function BroadsideCard(f: CardFacts) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
      backgroundColor: PAPER, padding: '54px 72px', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src={f.wordmark} width={232} alt="Mermade Market" />
        <div style={{ display: 'flex', fontFamily: 'Oswald', fontSize: 22, letterSpacing: 3.6, color: GOLD }}>
          {f.kicker.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', width: '100%', height: 2, backgroundColor: INK, marginBottom: 26 }} />
        <div style={{ display: 'flex', fontFamily: 'Oswald', fontSize: 104, lineHeight: 0.98, color: INK, letterSpacing: 0.5 }}>
          {f.dates.toUpperCase()}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontFamily: 'Figtree', fontSize: 32, color: '#5C5C5C' }}>
          {f.standfirst ?? `${f.venue} · Free to attend`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', width: 24, height: 24, backgroundColor: GOLD, marginRight: 18 }} />
        <div style={{ display: 'flex', fontFamily: 'Figtree', fontSize: 28, color: '#767676' }}>
          A hundred makers, hand curated, in Dana Point
        </div>
      </div>
    </div>
  )
}
