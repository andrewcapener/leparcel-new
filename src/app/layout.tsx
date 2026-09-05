import type { Metadata } from 'next'
import { EB_Garamond, Barlow, Barlow_Condensed, Oswald } from 'next/font/google'
import './globals.css'

/* Type system, locked Aug 2026 — see docs/08-DESIGN-SYSTEM.md.
   Barlow Condensed carries all display and label work, set uppercase;
   EB Garamond carries prose; Barlow carries UI, forms and tables. */
const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--f-garamond',
  display: 'swap',
})

const cond = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--f-cond',
  display: 'swap',
})

/* Oswald 500/600/700 — what mermademarket.com actually sets for headings and
   nav (type_heading_font: oswald_n6). Loaded for the typography comparison at
   /preview/type; it costs nothing until something asks for the variable. */
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--f-oswald',
  display: 'swap',
})

const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--f-body',
  display: 'swap',
})

export const metadata: Metadata = {
  // The words people actually type. The headline on the page is the
  // differentiator; the title tag is where the category has to be spelled
  // out, or a search for "makers market dana point" never finds us.
  title: {
    default: 'Mermade Market · A hand-curated makers market in Dana Point, California',
    template: '%s · Mermade Market',
  },
  description:
    'A hand-curated shop small makers market in Dana Point, California. Around a hundred independent makers, free to attend, twice a year since 2015.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${cond.variable} ${body.variable} ${oswald.variable}`}>
      <body>{children}</body>
    </html>
  )
}
