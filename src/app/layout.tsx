import type { Metadata } from 'next'

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
    /* `no-js` is theirs: theme-init.js swaps it for `js`, and a good deal of
       the theme's CSS — the transparent header among it — is gated on `.js`. */
    <html className="no-js" lang="en" dir="ltr">
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
        {/* Symmetry's own scripts. main.js runs the header, the drawers and
            the lazy images; the other two are the scroll animations and the
            marquee. theme-init.js is the configuration object main.js reads,
            so it has to run first and cannot be deferred. */}
        <script src="/theme/theme-init.js" />
        <script src="/theme/main.js" defer />
        <script src="/theme/animate-on-scroll.js" defer />
        <script src="/theme/scrolling-banner.js" defer />
      </head>
      <body className="cc-animate-enabled">{children}</body>
    </html>
  )
}
