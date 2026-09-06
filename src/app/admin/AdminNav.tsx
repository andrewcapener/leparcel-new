'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './Icon'
import { signOut } from './signOut'

/**
 * The sidebar navigation.
 *
 * A client component because the active row needs the pathname, and the
 * layout has to stay a server component so it can read the Show record and
 * the two counts in the badges.
 *
 * Each row is a full-width block: a 20px line icon, a letter-spaced caps
 * label, and a count on the rows that have one. The active row is marked
 * three ways, not one — aria-current="page", a white label, and the blue
 * outline — because colour alone fails WCAG 1.4.1 and because a juror
 * working at speed should be able to see where they are without looking.
 */
export type NavCounts = {
  /** Applications still to decide: new, under review, shortlisted. */
  undecided: number
  /** Roster rows waiting on a person: undocumented, unpaid, or no COI. */
  needsPerson: number
}

const MAIN: Array<{
  href: string; label: string; icon: IconName; count?: keyof NavCounts
  /** Other paths that belong to this row. */
  owns?: string
}> = [
  { href: '/admin', label: 'Dashboard', icon: 'grid' },
  { href: '/admin/jury', label: 'Review queue', icon: 'queue', count: 'undecided', owns: '/admin/applications' },
  { href: '/admin/roster', label: 'Roster', icon: 'roster', count: 'needsPerson' },
  { href: '/admin/show', label: 'Show settings', icon: 'settings' },
  { href: '/admin/outbox', label: 'Outbox', icon: 'mail' },
  { href: '/admin/emails', label: 'Emails', icon: 'bell' },
]

const PREVIEWS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/apply?preview=1', label: 'Application form', icon: 'external' },
  { href: '/api/preview?on=1&to=%2F', label: 'The site at launch', icon: 'external' },
  // A copy of every application, as a file, in one click. Three of the four
  // places this data lives are services somebody else runs; this is the one
  // that is just a file on a laptop. Worth taking before the jury sits.
  { href: '/admin/export', label: 'Download all applications', icon: 'clock' },
]

export function AdminNav({ counts, onNavigate }: { counts: NavCounts; onNavigate?: () => void }) {
  const path = usePathname()

  return (
    <nav className="adm-nav" aria-label="Admin">
      {MAIN.map((t) => {
        const on =
          path === t.href ||
          (t.href !== '/admin' && path.startsWith(`${t.href}/`)) ||
          (t.owns !== undefined && path.startsWith(t.owns))
        const n = t.count ? counts[t.count] : 0
        return (
          <Link
            key={t.href}
            href={t.href}
            className="adm-nav-row"
            aria-current={on ? 'page' : undefined}
            onClick={onNavigate}
          >
            <Icon name={t.icon} />
            <span className="t">{t.label}</span>
            {t.count && n > 0 && (
              <span className="adm-nav-badge">
                {n}
                <span className="adm-sr"> {t.count === 'undecided' ? 'still to decide' : 'need a person'}</span>
              </span>
            )}
          </Link>
        )
      })}

      <p className="adm-nav-sec">Preview</p>
      {PREVIEWS.map((t) => (
        <a key={t.href} href={t.href} className="adm-nav-row" target="_blank" rel="noreferrer">
          <Icon name={t.icon} />
          <span className="t">{t.label}</span>
          <span className="ext" aria-hidden="true">↗</span>
          <span className="adm-sr">, opens in a new tab</span>
        </a>
      ))}

      <p className="adm-nav-sec">Session</p>
      <form action={signOut}>
        <button className="adm-nav-row" type="submit">
          <Icon name="exit" />
          <span className="t">Sign out</span>
        </button>
      </form>
    </nav>
  )
}
