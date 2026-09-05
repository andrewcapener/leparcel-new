import { activeShow } from '@/db/queries'
import { Photo } from '@/components/Photo'
import { unlisted } from '@/lib/pages'
import { fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Typography comparison', ...unlisted }

/**
 * Unlisted comparison page. Not in the nav, not in the sitemap, noindex.
 *
 * The old site sets type_heading_font to oswald_n6, so the headline everyone
 * remembers is Oswald Semibold, not Trade Gothic. This page puts it next to
 * the Barlow Condensed we ship with, at real hero scale, so the choice is
 * made by looking rather than by arguing.
 */
export default async function TypePreview() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const faces = [
    { name: 'Barlow Condensed 700', note: 'What the site uses now', css: 'var(--font-c)', weight: 700 },
    { name: 'Oswald 600', note: 'What mermademarket.com actually sets', css: 'var(--f-oswald)', weight: 600 },
  ]

  return (
    <main style={{ background: 'var(--bone)', minHeight: '100vh' }}>
      <div style={{ padding: 'clamp(24px,4vw,52px)', borderBottom: '2px solid var(--ink)' }}>
        <div className="k">Unlisted preview · not in the nav or the sitemap</div>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase', fontSize: 'clamp(30px,4.4vw,52px)', lineHeight: 0.95, marginTop: 12 }}>
          Which condensed?
        </h1>
        <p style={{ fontFamily: 'var(--font-g)', fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: '60ch', marginTop: 14 }}>
          Trade Gothic is not in the theme export and is not what the live site
          uses. The headline you liked is Oswald Semibold, which is free. Real
          Trade Gothic Bold Condensed would need a web licence bought from
          Monotype; Shopify&rsquo;s licence covers Shopify storefronts only and
          does not travel with us.
        </p>
      </div>

      {faces.map((f) => (
        <section key={f.name} style={{ padding: 'clamp(24px,4vw,52px)', borderBottom: '1px solid var(--line)' }}>
          <div className="k">{f.name} · {f.note}</div>
          <div style={{ fontFamily: f.css, fontWeight: f.weight, textTransform: 'uppercase', fontSize: 'clamp(38px,8vw,104px)', lineHeight: 0.9, letterSpacing: '-.005em', marginTop: 16 }}>
            Shop small<br />makers market
          </div>
          <div style={{ fontFamily: f.css, fontWeight: f.weight, textTransform: 'uppercase', fontSize: 'clamp(30px,5.6vw,72px)', lineHeight: 0.94, marginTop: 26, color: 'var(--deep)' }}>
            A hundred makers,<br />chosen one at a time.
          </div>
          <div style={{ fontFamily: f.css, fontWeight: f.weight, textTransform: 'uppercase', letterSpacing: '.09em', fontSize: 15, marginTop: 24, color: 'var(--ink-2)' }}>
            Visiting · Schedule · Journal · FAQ · Apply to sell
          </div>
        </section>
      ))}

      {/* The old site's hero shape, in our palette and pipeline, set in Oswald. */}
      <section style={{ position: 'relative' }}>
        <Photo src="/photos/hero.jpg" alt="" className="hero" tone="deep">
          <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 var(--pad)', color: '#FBF8F0' }}>
            <div style={{ fontFamily: 'var(--f-oswald)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.22em', fontSize: 13 }}>
              Hand curated
            </div>
            <div style={{ fontFamily: 'var(--f-oswald)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'clamp(40px,8.2vw,104px)', lineHeight: 0.94, marginTop: 22 }}>
              Shop small<br />makers market
            </div>
            <div style={{ fontFamily: 'var(--font-g)', fontSize: 'clamp(16px,2vw,21px)', marginTop: 22 }}>
              {fmtRange(show.startsOn, show.endsOn)} · {show.venueName}, Dana Point
            </div>
            <a href="/apply" className="btn" style={{ marginTop: 26, background: '#FBF8F0', borderColor: '#FBF8F0', color: 'var(--ink)' }}>
              Apply now
            </a>
          </div>
        </Photo>
      </section>
      <div style={{ padding: 'clamp(24px,4vw,52px)' }}>
        <div className="k">Above: the old site&rsquo;s hero shape, our photo pipeline, Oswald</div>
      </div>
    </main>
  )
}
