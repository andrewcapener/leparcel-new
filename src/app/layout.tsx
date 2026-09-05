import type { Metadata } from 'next'
import { siteUrl } from '@/lib/site-url'
import { img } from '@/lib/theme-img'
import { ThemeBoot } from '@/components/theme/ThemeBoot'
import { NewsletterPopup } from '@/components/theme/NewsletterPopup'

/**
 * The public site is mermademarket.com's own theme, vendored.
 *
 * public/theme/ holds their compiled Symmetry stylesheet, the per-shop
 * settings block that carries the colours and the type scale, and their two
 * faces (Figtree and Oswald) as woff2 served from our origin instead of
 * Shopify's CDN. Nothing here is a reimplementation: it is their CSS, so the
 * public pages render as their pages render.
 *
 * The admin keeps its own stylesheet, imported in src/app/admin/layout.tsx so
 * it loads after this one and wins where the two disagree.
 */
/**
 * Site-wide metadata, and the defaults every page inherits.
 *
 * `metadataBase` is what makes Next emit absolute URLs for canonicals and
 * social images. Without it a canonical is a path, which is not a canonical,
 * and og:image is a path, which no scraper will fetch. It comes off the same
 * resolver the sitemap uses, so pointing the domain at Vercel needs no code
 * change (src/lib/site-url.ts).
 *
 * The old Shopify site had a description on two pages out of thirteen and a
 * canonical on all of them. Pages here set their own description; this is the
 * fallback for anything that has not, and the canonical is per-page below.
 */
/** The picture a shared link shows. The market crowd shot the FAQ opens with:
 *  1600x1067, landscape, and recognisably this market rather than a logo on a
 *  background. */
const OG_IMAGE = img('IMG_2793.jpg')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Mermade Market - Shop Small Festival',
    template: '%s - Mermade Market',
  },
  description:
    'A hand-curated shop small makers market in Dana Point, California. Around a hundred independent makers, free to attend, twice a year.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Mermade Market',
    locale: 'en_US',
    // The market is an Instagram business, so a shared link without a picture
    // is a wasted post. This is the same hero the home page opens with.
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Mermade Market' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Their theme gates a lot of CSS on `.js`, including the transparent
       header. Theirs starts at `no-js` and swaps on load; ours is rendered
       as `js` so nothing mutates <html> after React has claimed it. Their
       swap is a no-op against this value. */
    <html className="js" lang="en" dir="ltr">
      <head>
        <link rel="stylesheet" href="/theme/theme-settings.css" />
        <link rel="stylesheet" href="/theme/main.css" />
        <link rel="stylesheet" href="/theme/animate-on-scroll.css" />
        <link rel="stylesheet" href="/theme/video.css" />
        <link rel="stylesheet" href="/theme/collapsible-tabs.css" />
        <link rel="stylesheet" href="/theme/modal.css" />
        <link rel="stylesheet" href="/theme/pop-up.css" />
        {/* Ours, loaded last. See the file for what is in it and why. */}
        <link rel="stylesheet" href="/theme/local.css" />
        <link
          rel="preload"
          as="font"
          href="/theme/fonts/figtree_n4.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          href="/theme/fonts/oswald_n6.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="cc-animate-enabled">
        {children}
        {/* Theirs, in their markup, writing to our subscribers table. It
            suppresses itself on /admin and /apply. */}
        <NewsletterPopup />
        <ThemeBoot />
      </body>
    </html>
  )
}
