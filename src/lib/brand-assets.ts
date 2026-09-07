/**
 * The brand kit: what we hand out, and the rules that come with it.
 *
 * Everything listed here is generated from ONE master vector by
 * scripts/build-brand-assets.ts, which only ever substitutes a colour or picks
 * a raster size. No file here is a redrawn letterform, which is the property
 * that lets the page promise these are the real marks.
 *
 * On "hidden": this page is unlisted, not private, and the distinction is
 * load-bearing. A mail client fetches an image anonymously, with no cookie and
 * no session, so anything an email can display MUST be reachable by anyone
 * holding the url. Unlisted means no nav, no sitemap, noindex. It does not
 * mean secret, and nothing confidential belongs in public/brand.
 */

export type Format = { label: string; file: string; note?: string }

export type Mark = {
  id: string
  name: string
  use: string
  /** Show it on a dark plate: white artwork on white reads as a broken image. */
  onDark?: boolean
  /** The file the plate renders, always the vector. */
  preview: string
  formats: Format[]
}

export const marks: Mark[] = [
  {
    id: 'wordmark-ink',
    name: 'Primary wordmark',
    use: 'The default. Use this everywhere unless the background is dark or the piece is gold on paper.',
    preview: '/brand/mermade-wordmark-ink.svg',
    formats: [
      { label: 'SVG', file: '/brand/mermade-wordmark-ink.svg', note: 'Print, design files, the web' },
      { label: 'PNG 1200', file: '/brand/mermade-wordmark-ink-1200.png', note: 'Email and slides' },
      { label: 'PNG 2400', file: '/brand/mermade-wordmark-ink-2400.png', note: 'Print at about 200dpi' },
    ],
  },
  {
    id: 'wordmark-white',
    name: 'Reversed wordmark',
    use: 'For dark grounds and over photographs. Keep it on the calmest part of the picture, never across a face.',
    onDark: true,
    preview: '/brand/mermade-wordmark-white.svg',
    formats: [
      { label: 'SVG', file: '/brand/mermade-wordmark-white.svg' },
      { label: 'PNG 1200', file: '/brand/mermade-wordmark-white-1200.png', note: 'Transparent background' },
      { label: 'PNG 2400', file: '/brand/mermade-wordmark-white-2400.png' },
    ],
  },
  {
    id: 'wordmark-gold',
    name: 'Gold wordmark',
    use: 'One accent, used sparingly. Gold on white is soft, so give it size: it is a title, never small print.',
    preview: '/brand/mermade-wordmark-gold.svg',
    formats: [
      { label: 'SVG', file: '/brand/mermade-wordmark-gold.svg' },
      { label: 'PNG 1200', file: '/brand/mermade-wordmark-gold-1200.png' },
      { label: 'PNG 2400', file: '/brand/mermade-wordmark-gold-2400.png' },
    ],
  },
  {
    id: 'app-icon',
    name: 'App icon',
    use: 'Square contexts only: a favicon, a profile picture, an avatar. Not a logo, and never used in place of the wordmark.',
    /* Shown on LIGHT. It carries its own ink ground, so a dark plate behind it
       turns the icon into a hole rather than an object. */
    preview: '/brand/mermade-app-icon.svg',
    formats: [
      { label: 'SVG', file: '/brand/mermade-app-icon.svg' },
      { label: 'PNG 512', file: '/brand/mermade-app-icon-512.png' },
      { label: 'PNG 1024', file: '/brand/mermade-app-icon-1024.png', note: 'App stores and profiles' },
    ],
  },
]

/** docs/08-DESIGN-SYSTEM.md §2. Named here so the page cannot drift from it. */
export const palette = [
  { name: 'Ink',    hex: '#171717', use: 'Headlines, the wordmark, body text at full strength' },
  { name: 'Deep',   hex: '#232323', use: 'Buttons' },
  { name: 'Gold',   hex: '#BC9658', use: 'The one accent: links, hovers, the emphasised half of a headline' },
  { name: 'Slate',  hex: '#5C5C5C', use: 'Body copy' },
  { name: 'Line',   hex: '#DFE3E8', use: 'Hairlines and rules' },
  { name: 'Dune',   hex: '#EBEFED', use: 'The tinted band behind a section' },
  { name: 'Shell',  hex: '#F6F7F7', use: 'A fainter tint, between white and Dune' },
  { name: 'Bone',   hex: '#FFFFFF', use: 'Paper' },
]

export const typefaces = [
  {
    name: 'Oswald',
    role: 'Display and labels, set uppercase',
    detail: 'Anything you scan: headlines, nav, buttons, eyebrows, table headers.',
    href: 'https://fonts.google.com/specimen/Oswald',
  },
  {
    name: 'Figtree',
    role: 'Prose and interface',
    detail: 'Anything you read: body copy, ledes, form fields, names and titles.',
    href: 'https://fonts.google.com/specimen/Figtree',
  },
]
