import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { RichText, ImageWithText } from '@/components/theme/Sections'
import { outdoorShots, type LookbookShot } from '@/lib/lookbook'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outdoor Lookbook',
  description:
    'What an outdoor tent looks like at Mermade Market: real booth set-ups from past shows, to help you plan yours before you apply.',
  alternates: { canonical: '/lookbook/outdoor' },
}

/** /pages/outdoor-lookbook, in their sections. */
export default async function OutdoorLookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="page template-suffix-lookbook">
          <RichText primary title="Outdoor Maker Lookbook">
            <p>
              Our maker tents are the bomb! They&#39;re 6.5 x 6.5 feet so
              that we can still fit inside with ease. We also find that people
              with 10x10 tents have a hard time making every single inch
              intentional because it is quite large. Most makers that get the
              assignment of making their space creative &amp; unique.. find that
              they go to other shows with their original tents &amp; wish they had
              a smaller one. It helps curate your space and truly think of every
              inch you use!
            </p>
            <p>
              Below you will find the bold words we use to describe each image and
              why we think their space stood out from the others. Each one has
              something to inspire you &amp; make your space with us phenomenal!
            </p>
            <p>
              Required: a BACKDROP! If not all three sides, for sure the very
              back of your space so it doesn&#39;t distract our customers from
              focusing on YOUR shop, not your neighbors or what&#39;s happening
              behind them.
            </p>
            <p>
              Also remember, it does get windy out there and we are right on top
              of the ocean. Like walk 10 feet and you are swimming with dolphins.
              Remember this when displaying your products &amp; bring duct tape
              to literally bubble tape your cutie displays down. We will have
              sandbags for each and every maker.
            </p>
          </RichText>

          {outdoorShots.map((s, i) => (
            <ImageWithText
              key={s.file}
              image={s.file}
              title={s.title}
              flip={i % 2 === 0}
            >
              <p>{caption(s)}</p>
            </ImageWithText>
          ))}
        </SiteShell>
  )
}

/**
 * A caption, with their one embedded link put back where their text has it.
 * The bodies are plain strings so the pairing stays re-derivable; the link is
 * carried alongside rather than inlined as markup.
 */
function caption(s: LookbookShot) {
  if (!s.link) return s.body
  const at = s.body.lastIndexOf(s.link.text)
  if (at === -1) return s.body
  return (
    <>
      {s.body.slice(0, at)}
      <a href={s.link.href} target="_blank" rel="noreferrer">{s.link.text}</a>
      {s.body.slice(at + s.link.text.length)}
    </>
  )
}
