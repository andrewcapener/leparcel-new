import type { Metadata } from 'next'
import { ThemeBoot } from '@/components/theme/ThemeBoot'

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
export const metadata: Metadata = {
  title: {
    default: 'Mermade Market - Shop Small Festival',
    template: '%s – Mermade Market',
  },
  description:
    'A hand-curated shop small makers market in Dana Point, California. Around a hundred independent makers, free to attend, twice a year.',
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
        <ThemeBoot />
      </body>
    </html>
  )
}
