import Image from 'next/image'
import clsx from 'clsx'

/**
 * The film pipeline, shipped once. (docs/08-DESIGN-SYSTEM.md)
 *
 * Grain, halation, lifted blacks and vignette are a PIPELINE, not a mood —
 * every photograph on the shopper-facing site goes through this component so
 * the treatment is consistent and tunable in one place. Never hand-roll the
 * overlay divs in a page.
 *
 *   tone="deep"  full vignette, for full-bleed plates and heroes
 *   tone="soft"  radial only, for cards and portraits inside the paper field
 *   arch         the arched top that rhymes with the Community House trusses
 */
export function Photo({
  src,
  alt,
  className,
  tone = 'deep',
  arch = false,
  priority = false,
  sizes = '100vw',
  children,
}: {
  src: string
  alt: string
  className?: string
  tone?: 'deep' | 'soft'
  arch?: boolean
  priority?: boolean
  sizes?: string
  children?: React.ReactNode
}) {
  return (
    <div className={clsx('ph', arch && 'arch', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="src"
        style={{ objectFit: 'cover' }}
      />
      <div className="hal" />
      <div className="gr" />
      {tone === 'deep' && <div className="gr2" />}
      <div className={clsx('vig', tone === 'soft' && 'vig-soft')} />
      {children}
    </div>
  )
}
