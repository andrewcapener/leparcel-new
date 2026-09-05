import Link from 'next/link'
import { Photo } from '@/components/Photo'
import type { LookbookShot } from '@/lib/lookbook'

/**
 * A lookbook page's gallery: one photograph, its heading, and the market's
 * note on why that space worked. The live pages run these as a single
 * column of full-width images; three up reads better on a laptop and keeps
 * the note beside the space it is about.
 */
export function LookbookGrid({ shots, alt }: { shots: LookbookShot[]; alt: string }) {
  return (
    <div className="lbgrid">
      {shots.map((s) => (
        <figure className="lbi" key={s.src}>
          <Photo src={s.src} alt={alt} tone="soft" sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 33vw" />
          <figcaption>
            <div className="nm">{s.title}</div>
            <p>{s.body}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export function LookbookFooterCta({ track }: { track: 'indoor' | 'outdoor' }) {
  return (
    <section className="apply">
      <div className="k">Ready</div>
      <h2 style={{ marginTop: 18 }}>Build something <em>worth looking at.</em></h2>
      <p>
        {track === 'indoor'
          ? 'The indoor rules cover load-in, labeling and what each space actually measures.'
          : 'The outdoor rules cover the tent, the supply list and what happens if it rains.'}
      </p>
      <div className="cta">
        <Link href={`/makers/${track}`} className="btn">
          {track === 'indoor' ? 'Indoor rules' : 'Outdoor rules'}
        </Link>
        <Link href="/apply" className="btn line">Apply now</Link>
      </div>
    </section>
  )
}
