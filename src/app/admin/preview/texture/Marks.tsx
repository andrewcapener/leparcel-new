/**
 * A single-ink mark set, with the screen baked into the shape.
 *
 * The reference (jpegfletcher, "The Longboard") works because of four things,
 * and the grain is the last of them: one ink on one ground, marks reduced
 * until nothing decorative is left, a modular grid, and a halftone that lives
 * INSIDE the shapes rather than floating over the page.
 *
 * That last point is the whole engineering decision. docs/08 §3 records that a
 * film pipeline with grain tiles over every flat field was removed from this
 * site on purpose: "a half-applied treatment reads as a mistake where none
 * reads as a decision". An overlay would be that mistake again. A pattern fill
 * inside a path is a different animal: it is part of the drawing, it stays
 * sharp at any size, it costs one SVG, and it never touches a photograph.
 *
 * Every screen is defined per SVG rather than shared through one hidden defs
 * block, which is more markup and no cross-document id resolution to get wrong.
 * Screens paint with `var(--mark-ink)` so one property on a wrapper recolours a
 * mark and its texture together.
 */

export type Screen = 'solid' | 'fine' | 'coarse' | 'line' | 'stipple'

const fill = (s: Screen, uid: string) =>
  s === 'solid' ? 'var(--mark-ink)' : `url(#${uid}-${s})`

function Screens({ uid }: { uid: string }) {
  return (
    <defs>
      {/* Fine dot: reads as a flat tint at arm's length, as a screen up close. */}
      <pattern id={`${uid}-fine`} width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.15" fill="var(--mark-ink)" />
      </pattern>
      {/* Coarse dot: the riso tell. Big enough to see at thumbnail size. */}
      <pattern id={`${uid}-coarse`} width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="3.5" cy="3.5" r="2.1" fill="var(--mark-ink)" />
      </pattern>
      {/* Line screen, for anything that should read as moving water. */}
      <pattern id={`${uid}-line`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="2.4" fill="var(--mark-ink)" />
      </pattern>
      {/* Stipple: the ink-starved edge of a screenprint. Turbulence rather than
          a tile, so it never repeats visibly. */}
      <filter id={`${uid}-rough`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 -0.35" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      <pattern id={`${uid}-stipple`} width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="var(--mark-ink)" filter={`url(#${uid}-rough)`} />
      </pattern>
    </defs>
  )
}

type MarkProps = { screen?: Screen; className?: string; title?: string }

const svg = (uid: string, p: MarkProps, body: React.ReactNode) => (
  <svg
    viewBox="0 0 100 100"
    className={p.className}
    role={p.title ? 'img' : 'presentation'}
    aria-label={p.title}
    aria-hidden={p.title ? undefined : true}
  >
    <Screens uid={uid} />
    {body}
  </svg>
)

/** The bird that is actually on that water. Reduced to a wing, a body and a
 *  pouch, which is as far as it goes before it stops being a pelican. */
export function Pelican(p: MarkProps) {
  const f = fill(p.screen ?? 'solid', 'pel')
  return svg('pel', p, (
    <g>
      {/* In flight, not at rest. Two passes at a floating pelican produced a
          chick, because at this level of reduction the beak gets absorbed into
          the body silhouette and there is nothing left that says pelican. A
          soaring bird is the reference's own idiom (its swan and its small
          darts are both single swept shapes) and it reads instantly at chip
          size, which a beak never would. */}
      <path
        d="M4 40 C20 34 36 38 48 48 C56 44 66 42 74 44 L96 40 L78 52
           C74 62 64 68 54 66 C44 76 24 76 8 66 C18 62 28 58 34 52
           C24 50 12 46 4 40 Z"
        fill={f}
      />
      <circle cx="79" cy="46" r="2.4" fill="var(--mark-ground, #FFFFFF)" />
    </g>
  ))
}

/** A swell, with the line screen running the way the water does. */
export function Swell(p: MarkProps) {
  const f = fill(p.screen ?? 'line', 'swl')
  return svg('swl', p, (
    <g>
      <path d="M4 74 C22 40 46 26 68 30 C86 34 94 48 92 62 C88 48 76 40 62 42 C74 48 78 60 74 70 C66 56 50 50 36 56 C26 60 14 68 4 74 Z" fill={f} />
      <path d="M4 82 C30 70 62 70 96 80" fill="none" stroke="var(--mark-ink)" strokeWidth="3" />
    </g>
  ))
}

/** Kelp. Vertical, so it works as a divider turned on its side. */
export function Kelp(p: MarkProps) {
  const f = fill(p.screen ?? 'coarse', 'klp')
  return svg('klp', p, (
    <g>
      <path d="M48 96 C44 70 46 40 54 8" fill="none" stroke="var(--mark-ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 78 C30 74 20 62 20 50 C34 52 44 62 47 78 Z" fill={f} />
      <path d="M49 60 C66 56 78 44 78 32 C62 34 52 44 49 60 Z" fill={f} />
      <path d="M50 40 C34 36 24 26 24 14 C38 16 48 26 50 40 Z" fill={f} />
    </g>
  ))
}

/** A fish, in the reference's own grammar: triangle tail, body, one eye. */
export function Fish(p: MarkProps) {
  const f = fill(p.screen ?? 'fine', 'fsh')
  return svg('fsh', p, (
    <g>
      <path d="M8 50 C24 28 58 26 78 42 L96 28 L92 50 L96 72 L78 58 C58 74 24 72 8 50 Z" fill={f} />
      <circle cx="30" cy="46" r="5.5" fill="var(--mark-ground, #FFFFFF)" />
      <circle cx="30" cy="46" r="2.2" fill="var(--mark-ink)" />
      <path d="M52 34 L52 66 M62 36 L62 64" stroke="var(--mark-ground, #FFFFFF)" strokeWidth="2.5" />
    </g>
  ))
}

/** Half a sun over a flat sea. The market runs in daylight. */
export function Sun(p: MarkProps) {
  const f = fill(p.screen ?? 'coarse', 'sun')
  return svg('sun', p, (
    <g>
      <path d="M50 16 A34 34 0 0 1 84 50 L16 50 A34 34 0 0 1 50 16 Z" fill={f} />
      <path d="M6 60 H94 M18 70 H82 M30 80 H70" stroke="var(--mark-ink)" strokeWidth="4" strokeLinecap="round" />
    </g>
  ))
}

/** A scallop. The most craft-fair object there is. */
export function Scallop(p: MarkProps) {
  const f = fill(p.screen ?? 'solid', 'scl')
  return svg('scl', p, (
    <g>
      <path d="M50 12 C74 12 92 34 92 62 C92 74 86 84 78 86 L22 86 C14 84 8 74 8 62 C8 34 26 12 50 12 Z" fill={f} />
      <path d="M50 18 V86 M33 23 L25 86 M67 23 L75 86 M19 37 L13 84 M81 37 L87 84"
        stroke="var(--mark-ground, #FFFFFF)" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  ))
}

export const MARKS = [
  { key: 'pelican', label: 'Pelican', Mark: Pelican },
  { key: 'swell', label: 'Swell', Mark: Swell },
  { key: 'kelp', label: 'Kelp', Mark: Kelp },
  { key: 'fish', label: 'Fish', Mark: Fish },
  { key: 'sun', label: 'Sun', Mark: Sun },
  { key: 'scallop', label: 'Scallop', Mark: Scallop },
] as const
