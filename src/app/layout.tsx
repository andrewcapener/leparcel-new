import type { Metadata } from 'next'
import { EB_Garamond, Barlow, Barlow_Condensed } from 'next/font/google'
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

const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--f-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Mermade Market — Dana Point, California',
  description:
    'A juried market of independent makers in Dana Point, California. Free to attend, twice a year, since 2015.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${cond.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
