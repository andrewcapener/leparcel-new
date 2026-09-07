/**
 * The two brand faces, as bytes, for the social card renderer.
 *
 * Satori (what next/og draws with) reads TTF and OTF. It does NOT read WOFF2,
 * and the theme's .woff files turn out to BE woff2 with the wrong extension:
 * they begin wOF2, and satori rejects them at render time with "Unsupported
 * OpenType signature". A card that fails at render rather than at build is the
 * sort of thing nobody notices until somebody shares a link, so these are real
 * TrueType files, in their own folder, kept apart from the theme's webfonts so
 * the two cannot be confused again.
 *
 * Read off disk rather than fetched from Google: a card that needs the network
 * to draw is a card that renders empty the one time Google is slow, and this
 * image is the first thing anybody sees of the market.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'public/theme/fonts/og')

export type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: 'normal' }

let cache: LoadedFont[] | null = null

export async function brandFonts(): Promise<LoadedFont[]> {
  if (cache) return cache
  const [oswald, figtree, figtreeBold] = await Promise.all([
    readFile(join(DIR, 'oswald-600.ttf')),
    readFile(join(DIR, 'figtree-400.ttf')),
    readFile(join(DIR, 'figtree-700.ttf')),
  ])
  cache = [
    { name: 'Oswald', data: oswald.buffer.slice(oswald.byteOffset, oswald.byteOffset + oswald.byteLength) as ArrayBuffer, weight: 600, style: 'normal' },
    { name: 'Figtree', data: figtree.buffer.slice(figtree.byteOffset, figtree.byteOffset + figtree.byteLength) as ArrayBuffer, weight: 400, style: 'normal' },
    { name: 'Figtree', data: figtreeBold.buffer.slice(figtreeBold.byteOffset, figtreeBold.byteOffset + figtreeBold.byteLength) as ArrayBuffer, weight: 700, style: 'normal' },
  ]
  return cache
}
