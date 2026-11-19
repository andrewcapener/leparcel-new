import Link from 'next/link'
import { showMenu } from '@/db/queries'

/**
 * "Which show am I looking at", on the screens that report money.
 *
 * The roster, sales and statements screens all read the ACTIVE show, which
 * is right until the day the next one is made active. Fall 2026's statements
 * were still being reconciled with makers the week Spring 2027 was planned:
 * making Spring active would have emptied these screens with the payouts
 * half done. The money would still be in the database and simply have no
 * page left that could show it.
 *
 * So the reporting screens name their show. One link per show, the current
 * one marked, and no link at all while there is only one show to see, since
 * a picker with one option is furniture.
 *
 * Deliberately not on the roster. That screen writes (spaces, codes, adding
 * a maker), and letting staff edit a show they did not mean to open is a
 * worse failure than not being able to read it. Reporting is read-only, so
 * pointing it at a finished show can only tell the truth.
 */
export async function ShowScope({ here, current }: { here: string; current: string }) {
  const menu = await showMenu()
  if (menu.length < 2) return null

  return (
    <nav className="shscope" aria-label="Which show">
      <span className="shscope__k">Showing</span>
      {menu.map((s) => {
        const on = s.slug === current
        return (
          <Link
            key={s.slug}
            className={`shscope__i${on ? ' is-on' : ''}`}
            href={on ? here : `${here}?show=${s.slug}`}
            aria-current={on ? 'page' : undefined}
          >
            {s.name}
            {s.isActive && <span className="shscope__live" title="The active show"> live</span>}
          </Link>
        )
      })}
      <style>{`
.shscope { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  margin: 0 0 18px; font-size: var(--t-s) }
.shscope__k { color: var(--ad-ink-3); text-transform: uppercase;
  letter-spacing: .08em; font-size: 11px }
.shscope__i { color: var(--ad-ink-3); text-decoration: none;
  border-bottom: 1px solid transparent; padding-bottom: 1px }
.shscope__i:hover { color: var(--ad-ink); border-bottom-color: var(--ad-line) }
.shscope__i.is-on { color: var(--ad-ink); font-weight: 500;
  border-bottom-color: currentColor }
.shscope__live { color: var(--ad-ink-3); font-weight: 400 }
      `}</style>
    </nav>
  )
}
