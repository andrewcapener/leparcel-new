import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { RichText, ImageWithText } from '@/components/theme/Sections'
import { indoorShots, type LookbookShot } from '@/lib/lookbook'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Indoor Lookbook',
  description:
    'What an indoor space looks like at Mermade Market: real shop displays from past shows, to help you plan yours before you apply.',
  alternates: { canonical: '/lookbook/indoor' },
}

/**
 * /pages/indoor-lookbook — their rich-text intro then one
 * `section-image-with-text` per space, alternating sides as theirs does.
 */
export default async function IndoorLookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="page template-suffix-lookbook">
          <RichText primary title="Indoor Maker Lookbook">
            <p>
              It is proven time &amp; time again that when our makers&#39;
              spaces look their best, they sell more product. Indoor @ Mermade
              are much smaller spaces than any outdoor tent. But it doesn&#39;t
              mean they can&#39;t look good!! See below of some past examples
              and see how big they actually are.
            </p>
            <p><strong>Remember, vertical space is everything!</strong></p>
          </RichText>

          {indoorShots.map((s, i) => (
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
