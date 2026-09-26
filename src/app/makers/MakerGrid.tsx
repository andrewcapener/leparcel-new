'use client'

import { useMemo, useState } from 'react'
import { GROUP_KEYS, bySection } from './group-order'
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

const LABELS: Record<string, string> = {
  indoor: 'Indoor makers',
  junior: 'Junior makers',
  friday: 'Friday outside',
  saturday: 'Saturday outside',
  sunday: 'Sunday outside',
}

/* One list, so the tabs and the Everyone order cannot drift apart: both read
   GROUP_KEYS, in that order. See group-order.ts. */
const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Everyone' },
  ...GROUP_KEYS.map((key) => ({ key: key as string, label: LABELS[key]! })),
]

export function MakerGrid({ makers }: { makers: MakerCard[] }) {
  const [group, setGroup] = useState('all')

  /* Only the lists that have somebody in them. A show with no junior makers
     should not offer a tab that leads to an empty grid. */
  const tabs = useMemo(
    () => GROUPS.filter((g) => g.key === 'all' || makers.some((m) => m.group === g.key)),
    [makers],
  )
  /* Everyone is the sections, in tab order, each one internally exactly as
     its own tab shows it. It used to be the raw server order, which sorts by
     the booked space, and junior makers book an indoor space, so they sat
     scattered through the indoor grid here and gathered together the moment
     somebody pressed Junior. */
  const everyone = useMemo(() => bySection(makers), [makers])
  const shown = group === 'all' ? everyone : makers.filter((m) => m.group === group)

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
