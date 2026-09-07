import type { Metadata } from 'next'
import { unlisted } from '@/lib/pages'
import { brandAssets } from '@/lib/brand-assets'
import { siteUrl } from '@/lib/site-url'
import { CopyField } from './CopyField'

export const metadata: Metadata = {
  title: 'Brand files',
  description: 'Mermade Market logos and marks, with the direct link to each.',
  ...unlisted,
}

export const dynamic = 'force-dynamic'

/**
 * Every brand file, with the absolute url beside it, ready to paste.
 *
 * Deliberately plain: this is a utility page for one person writing an email,
 * not a page anybody visits twice. The one design decision that matters is
 * that a mark meant for a dark ground is SHOWN on a dark ground, because a
 * white wordmark on white paper looks like a missing file and somebody will
 * report it as broken.
 */
export default function BrandPage() {
  const base = siteUrl()

  return (
    <main className="brand-pg">
      <header>
        <p className="k">Mermade Market</p>
        <h1>Brand files</h1>
        <p className="lede">
          The direct link to each file, ready to paste into an email. Use the PNG for
          anything an email has to display, because a good number of mail clients will
          not render an SVG at all.
        </p>
        <p className="note">
          This page is unlisted rather than private: it is in no menu, in no sitemap,
          and asks search engines not to index it. Anyone with the link can open it,
          which is exactly what lets an email show these images at all.
        </p>
      </header>

      {brandAssets.length === 0 ? (
        <p className="empty">No files yet.</p>
      ) : (
        <ul className="grid">
          {brandAssets.map((a) => (
            <li key={a.file} className={a.onDark ? 'card dark' : 'card'}>
              <div className="plate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brand/${a.file}`} alt={a.name} />
              </div>
              <h2>{a.name}</h2>
              <p className="use">{a.use}</p>
              {a.vector && <p className="warn">Vector. For print, not for email.</p>}
              <CopyField value={`${base}/brand/${a.file}`} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
