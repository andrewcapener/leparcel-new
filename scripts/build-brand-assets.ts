/**
 * Builds the downloadable brand files from the one master vector.
 *
 * public/mermade-wordmark.svg is the primary lockup and it is drawn in
 * `currentColor`, which is what makes this script honest: every file below is
 * the SAME artwork with a colour substituted or a raster size chosen. Nothing
 * here redraws a letterform. If a mark is needed that does not exist yet (the
 * one-line horizontal lockup and the MM monogram that docs/08-DESIGN-SYSTEM.md
 * §7 lists as still needed), it has to be drawn by a designer, not generated
 * here from something that was never it.
 *
 * PNGs are rasterised at 600 dpi from the vector rather than resized from a
 * smaller PNG, so the 2400px file is genuinely sharp instead of an upscale.
 * They keep their alpha: a logo with baked-in white is unusable over anything.
 *
 * Re-run after touching the master:
 *   npx tsx scripts/build-brand-assets.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const sharp = createRequire(join(process.cwd(), 'package.json'))('sharp')

const OUT = join(process.cwd(), 'public/brand')
const MASTER = join(process.cwd(), 'public/mermade-wordmark.svg')

/** The three inks the system actually uses. docs/08-DESIGN-SYSTEM.md §2. */
const INKS = [
  { slug: 'ink',   hex: '#171717', label: 'ink' },
  { slug: 'white', hex: '#FFFFFF', label: 'reversed' },
  { slug: 'gold',  hex: '#BC9658', label: 'gold' },
]

/** Raster widths. 1200 covers email and slides; 2400 covers print at ~200dpi. */
const WIDTHS = [1200, 2400]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const master = readFileSync(MASTER, 'utf8')
  const made: string[] = []

  for (const ink of INKS) {
    const svg = master.replace(/currentColor/g, ink.hex)
    const svgName = `mermade-wordmark-${ink.slug}.svg`
    writeFileSync(join(OUT, svgName), svg)
    made.push(svgName)

    for (const w of WIDTHS) {
      const pngName = `mermade-wordmark-${ink.slug}-${w}.png`
      await sharp(Buffer.from(svg), { density: 600 })
        .resize({ width: w })
        .png({ compressionLevel: 9 })
        .toFile(join(OUT, pngName))
      made.push(pngName)
    }
  }

  // The app icon ships as drawn: it is a composed lockup (white mark, ink
  // rounded square), not a colourway of the wordmark, so it is copied rather
  // than recoloured.
  const icon = readFileSync(join(process.cwd(), 'src/app/icon.svg'), 'utf8')
  writeFileSync(join(OUT, 'mermade-app-icon.svg'), icon)
  made.push('mermade-app-icon.svg')
  for (const w of [512, 1024]) {
    const n = `mermade-app-icon-${w}.png`
    await sharp(Buffer.from(icon), { density: 600 }).resize({ width: w }).png().toFile(join(OUT, n))
    made.push(n)
  }

  console.log(`brand: ${made.length} files\n  ` + made.join('\n  '))
}

main()
