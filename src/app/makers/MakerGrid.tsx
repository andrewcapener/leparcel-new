'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'

/**
 * The maker directory, as the old Shopify page had it: a square each, the
 * shop's name under it, and the lists a shopper actually plans around.
 *
 * Filtered in the browser rather than by navigation. Every maker is in the
 * markup already, so switching lists is instant, the page stays one cached
 * document, and a shopper who lands from a story never waits on a server to
 * see Saturday.
 *
 * A maker with no photograph gets their initials on their category's colour.
 * That is deliberate and not a placeholder to be embarrassed about: a grid
 * with holes in it reads as broken, and this reads as a tile.
 */

export type MakerCard = {
  id: string
  name: string
  category: string
  /** 'indoor' | 'junior' | 'friday' | 'saturday' | 'sunday' */
  group: string
  /** The square, already resolved. Null when nobody has one yet. */
  photo: string | null
  /** Their own site or Instagram, if they gave us one. */
  href: string | null
  initials: string
  tint: string
}

const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Everyone' },
  { key: 'indoor', label: 'Indoor makers' },
  { key: 'junior', label: 'Junior makers' },
  { key: 'friday', label: 'Friday outside' },
  { key: 'saturday', label: 'Saturday outside' },
  { key: 'sunday', label: 'Sunday outside' },
]

export function MakerGrid({ makers }: { makers: MakerCard[] }) {
  const [group, setGroup] = useState('all')

  /* Only the lists that have somebody in them. A show with no junior makers
     should not offer a tab that leads to an empty grid. */
  const tabs = useMemo(
    () => GROUPS.filter((g) => g.key === 'all' || makers.some((m) => m.group === g.key)),
    [makers],
  )
  const shown = group === 'all' ? makers : makers.filter((m) => m.group === group)

  return (
    <div className="mk-dir">
      <div className="container">
        <div className="mk-dir__tabs" role="group" aria-label="Which makers">
          {tabs.map((g) => (
            <button
              key={g.key}
              type="button"
              className="mk-dir__tab"
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="mk-dir__grid">
          {shown.map((m) => {
            const inner = (
              <>
                <div className="mk-dir__thumb" style={{ ['--tint' as string]: m.tint }}>
                  {m.photo ? (
                    <Image src={m.photo} alt="" width={420} height={420}
                      sizes="(max-width: 560px) 45vw, (max-width: 1080px) 24vw, 260px"
                      quality={72} loading="lazy" />
                  ) : (
                    <span className="mk-dir__ini" aria-hidden="true">{m.initials}</span>
                  )}
                </div>
                <h3 className="mk-dir__name">{m.name}</h3>
                <p className="mk-dir__cat">{m.category}</p>
              </>
            )
            return m.href ? (
              <a className="mk-dir__cell" key={m.id} href={m.href}
                target="_blank" rel="noreferrer noopener">
                {inner}
              </a>
            ) : (
              <div className="mk-dir__cell" key={m.id}>{inner}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
