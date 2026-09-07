import type { Metadata } from 'next'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { unlisted } from '@/lib/pages'
import { marks, palette, typefaces } from '@/lib/brand-assets'
import { siteUrl } from '@/lib/site-url'
import { CopyField } from './CopyField'

export const metadata: Metadata = {
  title: 'Brand kit',
  description: 'Mermade Market marks, colour and type, with the direct link to every file.',
  ...unlisted,
}

export const dynamic = 'force-dynamic'

/**
 * The brand kit.
 *
 * Two audiences, and the page has to serve both without splitting in half.
 * Somebody writing an email needs an absolute url they can paste and needs to
 * see which file is which before they paste it. A press contact or a designer
 * needs the vector, the hex values and the rules. Same files, so one page,
 * with the link and the format sitting on every mark rather than in a separate
 * downloads appendix.
 *
 * The one visual rule that matters here: a mark drawn for a dark ground is
 * SHOWN on a dark ground. White artwork on white paper reads as a missing file
 * and gets reported as a bug, every time.
 */
export default async function BrandPage() {
  const base = siteUrl()
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="page template-suffix-brand">
    <main className="brand-pg">
      <header className="brand-hd">
        <p className="k">Mermade Market</p>
        <h1>Brand kit</h1>
        <p className="lede">
          The marks, the colour and the type, with a direct link to every file. Take the
          SVG for print and design work, and the PNG for anything an email or a slide has
          to display.
        </p>
      </header>

      <section aria-labelledby="marks-h">
        <div className="sec-hd"><h2 id="marks-h">Marks</h2></div>
        <ul className="grid">
          {marks.map((m) => (
            <li key={m.id} className="card">
              <div className={m.onDark ? 'plate dark' : 'plate'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.preview} alt={m.name} />
              </div>
              <h3>{m.name}</h3>
              <p className="use">{m.use}</p>
              <ul className="fmts">
                {m.formats.map((f) => (
                  <li key={f.file}>
                    <a className="fmt" href={f.file} download>{f.label}</a>
                    {f.note && <span className="fnote">{f.note}</span>}
                  </li>
                ))}
              </ul>
              <CopyField value={`${base}${m.formats[0]!.file}`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rules-h">
        <div className="sec-hd"><h2 id="rules-h">Using the mark</h2></div>
        <div className="rules">
          <div>
            <h3>Clear space</h3>
            <p>
              Keep space equal to the height of the M on every side. Nothing sits inside
              it: no text, no rule, no edge of a photograph.
            </p>
          </div>
          <div>
            <h3>Smallest size</h3>
            <p>
              120px wide on a screen, 25mm in print. Below that the letterspacing in the
              arc closes up and the second line stops being readable.
            </p>
          </div>
          <div>
            <h3>Do not</h3>
            <p>
              Stretch it, rotate it, add a shadow or an outline, put it in a coloured box,
              recolour it outside the three inks above, or rebuild it by typing the words
              in Oswald. It is drawn artwork, not set type.
            </p>
          </div>
          <div>
            <h3>Over photographs</h3>
            <p>
              Reversed, on the calmest part of the picture, never across a face. If the
              photograph is busy everywhere, put the mark on the paper beside it instead.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="colour-h">
        <div className="sec-hd"><h2 id="colour-h">Colour</h2></div>
        <ul className="swatches">
          {palette.map((c) => (
            <li key={c.hex}>
              <span className="chip" style={{ background: c.hex }} aria-hidden="true" />
              <span className="cn">{c.name}</span>
              <code className="ch">{c.hex}</code>
              <span className="cu">{c.use}</span>
            </li>
          ))}
        </ul>
        <p className="note">
          Gold is the only accent and it does one job: links, hovers, and the emphasised
          half of a headline. It is not a background.
        </p>
      </section>

      <section aria-labelledby="type-h">
        <div className="sec-hd"><h2 id="type-h">Type</h2></div>
        <ul className="faces">
          {typefaces.map((t) => (
            <li key={t.name}>
              <p className="spec" style={{ fontFamily: `${t.name}, system-ui, sans-serif` }}>
                {t.name === 'Oswald' ? 'SHOP SMALL' : 'Made by the person selling it.'}
              </p>
              <h3>{t.name}</h3>
              <p className="role">{t.role}</p>
              <p className="use">{t.detail}</p>
              <a className="fmt" href={t.href} target="_blank" rel="noreferrer">
                Get it free on Google Fonts
              </a>
            </li>
          ))}
        </ul>
        <p className="note">
          Oswald uppercase for anything you scan, Figtree for anything you read. Both are
          free, so anyone making something for Mermade can match it exactly.
        </p>
      </section>

      <footer className="brand-ft">
        <p>
          Questions, or need a format that is not here: <a href="/contact">get in touch</a>.
        </p>
      </footer>
    </main>
    </SiteShell>
  )
}
