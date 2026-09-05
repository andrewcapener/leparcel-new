import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Photo } from '@/components/Photo'
import { Masthead, Footer } from '@/components/site'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Merchant lookbook',
  description:
    'Past indoor spaces at Mermade Market, and what made them work: vertical space, real lighting, and almost never a plain table.',
}

const SHOTS = Array.from({ length: 22 }, (_, i) => `/lookbook/lb${String(i + 1).padStart(2, '0')}.jpg`)

/**
 * The indoor lookbook, ported from mermademarket.com/pages/indoor-lookbook.
 *
 * The photographs are the market's own, pulled from their CDN and resized.
 * The theme export strips image references from its block settings, so the
 * mapping between each of their 23 captions and the right photograph is not
 * recoverable — and those captions critique specific makers' booths, so a
 * wrong pairing would attach a criticism to the wrong person's space. Their
 * advice is therefore grouped by space size above the gallery rather than
 * guessed at per photo. Re-pairing is a caption per file whenever the
 * photos get swapped.
 */
export default async function Lookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const notes: Array<[string, string]> = [
    ['Vertical space is everything',
      'The spaces inside are small. The ones that sell build upward: shelving, a pegboard, a panel of wood, a slim rail. Depth is fixed at three feet, height is yours.'],
    ['A plain table is the weakest option',
      'It is the easiest thing to bring and the thing that consistently underperforms. If your work needs a table, use it as the support and build the display on top of it.'],
    ['Lights, every time',
      'Shadows move across the room all day as the weather changes. Makers who bring lamps or clip lights see their work all weekend. Makers who do not always wish they had.'],
    ['Your shop name, not on vinyl',
      'Put it up high enough to read across the room. Printed, painted, stitched, burned. Sitting on a shelf at knee height does not count.'],
    ['Hide the restock',
      'Under the shelf, behind the panel, in the back room. Bins on the floor read as a swap meet; the same bins tucked away read as a shop.'],
    ['Nothing at knee height',
      'If a shopper has to bend to see what you make, most will not. Raise the work to where it can be read standing up.'],
  ]

  return (
    <>
      <Masthead show={show} />

      <section className="claim" style={{ paddingBottom: 56 }}>
        <div className="k">For makers · Indoor</div>
        <p className="lede" style={{ maxWidth: '20ch' }}>The <em>lookbook.</em></p>
        <p>
          When a space looks its best it sells more. These are real spaces from past
          shows, at the sizes you are choosing between.
        </p>
      </section>

      <section className="sec">
        <div className="shead"><span className="k">01</span><h2>What the good ones do</h2></div>
        <div className="prows air">
          {notes.map(([q, a]) => (
            <div className="row" key={q}><span className="q">{q}</span><span className="a">{a}</span></div>
          ))}
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="shead"><span className="k">02</span><h2>Past spaces</h2></div>
        <div className="lbgrid">
          {SHOTS.map((src) => (
            <Photo key={src} src={src} alt="A maker's indoor space at a past show." tone="soft" sizes="(max-width:900px) 50vw, 33vw" />
          ))}
        </div>
      </section>

      <section className="apply">
        <div className="k">Ready</div>
        <h2 style={{ marginTop: 18 }}>Build something <em>worth looking at.</em></h2>
        <p>The indoor rules cover load-in, labeling and what each space actually measures.</p>
        <div className="cta">
          <Link href="/makers/indoor" className="btn">Indoor rules</Link>
          <Link href="/apply" className="btn line">Apply now</Link>
        </div>
      </section>

      <Footer show={show} />
    </>
  )
}
