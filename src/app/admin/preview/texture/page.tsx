import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle } from '@/components/theme/Sections'
import { categoryRanges } from '@/lib/content'
import { MARKS, Pelican, Swell, Kelp, Fish, Sun, Scallop, type Screen } from './Marks'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Preview: texture', robots: { index: false, follow: false } }

/**
 * Six ways the single-ink language could sit on this site, so it can be judged
 * rather than imagined.
 *
 * Nothing here is wired into the site. It is a proposal on a page, in the real
 * typefaces and the real tokens, behind the staff gate.
 */

const SCREENS: { key: Screen; label: string; note: string }[] = [
  { key: 'solid', label: 'Flat', note: 'No screen. What goes beside a photograph.' },
  { key: 'fine', label: 'Fine dot', note: 'Reads as a tint across a room, as a screen up close.' },
  { key: 'coarse', label: 'Coarse dot', note: 'The riso tell. Survives being small.' },
  { key: 'line', label: 'Line', note: 'For anything that should read as moving water.' },
  { key: 'stipple', label: 'Stipple', note: 'The ink-starved edge of a screenprint.' },
]

const CATEGORY_MARK = [Scallop, Sun, Kelp, Fish, Swell, Pelican, Scallop, Sun, Fish]

export default async function TexturePreview() {
  const show = await activeShow()
  if (!show) return <p className="adm-empty">No active show.</p>

  return (
    <SiteShell show={show} template="page template-suffix-texture">
      <PageTitle title="Texture, in Mermade's ink" />

      <div className="shopify-section section-rich-text">
        <div className="fully-spaced-row--medium">
          <div className="container container--reading-width">
            <p className="rte">
              A proposal, not a change. Nothing below is wired into the site. The reference
              works because of four things and the grain is the last of them: one ink on one
              ground, marks reduced until nothing decorative is left, a modular grid, and a
              halftone that lives <em>inside</em> the shapes rather than over the page.
            </p>
            <p className="rte">
              So the ink here is your gold, not a new blue. You have exactly one accent and a
              palette that was put back on purpose. Every screen below is drawn into the SVG,
              which is why none of it touches a photograph.
            </p>
            <p className="rte"><Link href="/admin">Back to the admin</Link></p>
          </div>
        </div>
      </div>

      {/* 1 ── the dial */}
      <section className="tx-band" style={{ ['--mark-ink' as string]: '#BC9658', background: '#EBEFED' }}>
        <div className="container container--reading-width">
          <p className="tx-eyebrow">One mark, five finishes</p>
          <div className="tx-dial">
            {SCREENS.map((s) => (
              <figure key={s.key} className="tx-dial__cell">
                <Swell screen={s.key} className="tx-mark" title={`Swell, ${s.label}`} />
                <figcaption>
                  <strong>{s.label}</strong>
                  <span>{s.note}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 2 ── the homage: a modular grid, one ink */}
      <section className="tx-band" style={{ ['--mark-ink' as string]: '#BC9658', background: '#EBEFED' }}>
        <div className="container container--reading-width">
          <p className="tx-eyebrow">The set, on a grid</p>
          <div className="tx-grid">
            <div className="tx-tile tx-tile--wide tx-tile--fill">
              <span className="tx-tile__word">Mermade</span>
            </div>
            <div className="tx-tile"><Pelican screen="solid" className="tx-mark" /></div>
            <div className="tx-tile"><Sun screen="coarse" className="tx-mark" /></div>
            <div className="tx-tile tx-tile--tall"><Kelp screen="coarse" className="tx-mark" /></div>
            <div className="tx-tile"><Fish screen="fine" className="tx-mark" /></div>
            <div className="tx-tile"><Scallop screen="stipple" className="tx-mark" /></div>
            <div className="tx-tile tx-tile--wide"><Swell screen="line" className="tx-mark" /></div>
          </div>
        </div>
      </section>

      {/* 3 ── the real job */}
      <section className="tx-band" style={{ ['--mark-ink' as string]: '#171717', background: '#F6F7F7' }}>
        <div className="container container--reading-width">
          <p className="tx-eyebrow">Where it earns its keep: your nine categories</p>
          <p className="rte tx-lede">
            Right now these are words. A mark each turns the reference's grid into something
            with a job, on the roster, the lookbook and the application form. Same drawings
            scale to a vendor sign and a tote.
          </p>
          <ul className="tx-chips">
            {categoryRanges.map((c, i) => {
              const Mark = CATEGORY_MARK[i % CATEGORY_MARK.length]!
              return (
                <li key={c.label} className="tx-chip">
                  <Mark screen="solid" className="tx-chip__mark" />
                  <span>{c.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* 4 ── reversed, as a band */}
      <section className="tx-band tx-band--dark" style={{ ['--mark-ink' as string]: '#BC9658', background: '#171717' }}>
        <div className="container container--reading-width">
          <div className="tx-rule">
            {MARKS.map(({ key, Mark }) => (
              <Mark key={key} screen={key === 'swell' ? 'line' : 'coarse'} className="tx-rule__mark" />
            ))}
          </div>
          <p className="tx-dark-copy">
            Two shows a year. One hundred makers. Free to walk in.
          </p>
          <div className="tx-rule">
            {MARKS.map(({ key, Mark }) => (
              <Mark key={key} screen="solid" className="tx-rule__mark" />
            ))}
          </div>
        </div>
      </section>

      {/* 5 ── an empty state */}
      <section className="tx-band" style={{ ['--mark-ink' as string]: '#BC9658', background: '#FFFFFF' }}>
        <div className="container container--reading-width">
          <p className="tx-eyebrow">Where there is no photograph to compete with</p>
          <div className="tx-empty">
            <Kelp screen="fine" className="tx-empty__mark" />
            <p className="tx-empty__head">Nothing here yet</p>
            <p className="tx-empty__note">
              The roster goes up the day after decisions. We will write when it does.
            </p>
          </div>
        </div>
      </section>

      {/* 6 ── the restraint */}
      <section className="tx-band" style={{ ['--mark-ink' as string]: '#BC9658', background: '#EBEFED' }}>
        <div className="container container--reading-width">
          <p className="tx-eyebrow">Beside real work, it stops</p>
          <div className="tx-beside">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/theme/img/strip/178.jpg" alt="" className="tx-photo" />
            <div className="tx-beside__col">
              <Scallop screen="solid" className="tx-mark tx-mark--sm" />
              <p className="rte">
                Flat only next to photography, and never on top of it. The maker's work is the
                product. A screen over that photograph is the treatment that got removed from
                this site once already.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
