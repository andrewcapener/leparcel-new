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
  /** Roster rows waiting on a person: undocumented or unpaid. Insurance is
   *  recommended, not required, so a missing certificate never counts. */
  needsPerson: number
  /** Applications submitted before the window opened, so ours to delete. */
  rehearsals: number
}

const MAIN: Array<{
  /** A heading, not a link: the rows under it until the next one. */
  sec?: string
  href?: string; label?: string; icon?: IconName; count?: keyof NavCounts
  /** Other paths that belong to this row. */
  owns?: string
}> = [
  /* Grouped, because fourteen rows in one column is a list you read rather
     than a place you aim at.
     
     Drew, 30 October: "we've built a lot of one-off tools here, it's very
     comprehensive, however it's just kind of bloated, especially on the
     navigation to the left." He is right, and the cause is visible in the
     order: every screen was appended as it was built, so the column is a
     build log rather than a day's work.
     
     The groups are the actual sequence of a season. Deciding who is in,
     then running the roster, then the fortnight before the doors open, then
     the plumbing. A section heading is free (the same adm-nav-sec the
     Preview and Session blocks already use) and turns one list of fourteen
     into four lists of three or four, which is the difference between
     reading and aiming. */
  { href: '/admin', label: 'Dashboard', icon: 'grid' },

  { sec: 'Deciding' },
  { href: '/admin/jury', label: 'Review queue', icon: 'queue', count: 'undecided', owns: '/admin/applications' },
  { href: '/admin/import', label: 'Accept from the sheet', icon: 'queue' },

  { sec: 'The roster' },
  /* Add a maker by hand is NOT here. It is one button's worth of work that
     belongs on the roster it adds to, which is also where somebody is
     standing when they discover they need it, and it was taking a row of
     this column to say so. */
  { href: '/admin/roster', label: 'Roster', icon: 'roster', count: 'needsPerson' },
  { href: '/admin/codes', label: 'Maker numbers', icon: 'queue' },
  { href: '/admin/chase', label: 'Chase the booth fee', icon: 'clock' },

  { sec: 'Before the show' },
  { href: '/admin/onboarding', label: 'Inventory and payouts', icon: 'money' },
  { href: '/admin/thumbnails', label: 'Maker pictures', icon: 'photo' },
  { href: '/admin/lineup', label: 'The lineup', icon: 'grid' },

  { sec: 'Settings' },
  { href: '/admin/show', label: 'Show settings', icon: 'settings' },
  { href: '/admin/outbox', label: 'Outbox', icon: 'mail' },
  { href: '/admin/emails', label: 'Emails', icon: 'bell' },
  { href: '/admin/sheet', label: 'Send to Google Sheet', icon: 'external' },
]

const PREVIEWS: Array<{
  href: string; label: string; icon: IconName
  /** Rendered only when the matching count is above zero. */
  only?: keyof NavCounts
}> = [
  { href: '/apply?preview=1', label: 'Application form', icon: 'external' },
  /* The booth fee screen, in every state. It only exists for somebody with an
     accepted application and a booking, so without this the only way to look
     at it was to apply, accept yourself and sign in from the email. */
  { href: '/admin/preview/account', label: "The maker's account", icon: 'external' },
  { href: '/api/preview?on=1&to=%2F', label: 'The site at launch', icon: 'external' },
  // The one thing here that is for somebody else to click. It lives on the
  // dashboard because it needs a copy button beside it, and it is listed here
  // because that is where you go looking for it.
  { href: '/admin#rehearsal', label: 'Rehearsal link for the team', icon: 'external' },
  // Only while there are any. The dashboard hides the block when the count is
  // zero, and a nav row pointing at an anchor that is not on the page is a row
  // that does nothing when pressed, which on a screen full of working rows
  // reads as the app being broken rather than as there being nothing to do.
  { href: '/admin#tests', label: 'Delete test applications', icon: 'clock', only: 'rehearsals' },
  // A copy of every application, as a file, in one click. Three of the four
  // places this data lives are services somebody else runs; this is the one
  // that is just a file on a laptop. Worth taking before the jury sits.
  { href: '/admin/export', label: 'Download all applications', icon: 'clock' },
  // The two files the girls work from on payment morning. Links to merge
  // from, and status to watch. Seventy eight presses of a copy button until
  // these existed.
  { href: '/admin/export/paylinks', label: 'Download the pay links', icon: 'clock' },
  { href: '/admin/export/payments', label: 'Download payment tracking', icon: 'clock' },
  // The people who asked to be told when applications open. The site made that
  // promise; this is how it gets kept on the morning.
  { href: '/admin/subscribers', label: 'Download the waiting list', icon: 'clock' },
]

export function AdminNav({ counts, onNavigate }: { counts: NavCounts; onNavigate?: () => void }) {
  const path = usePathname()

  return (
    <nav className="adm-nav" aria-label="Admin">
      {MAIN.map((t) => {
        if (t.sec) return <p className="adm-nav-sec" key={t.sec}>{t.sec}</p>
        const on =
          path === t.href ||
          (t.href !== '/admin' && path.startsWith(`${t.href!}/`)) ||
          (t.owns !== undefined && path.startsWith(t.owns))
        const n = t.count ? counts[t.count] : 0
        return (
          <Link
            key={t.href}
            href={t.href!}
            className="adm-nav-row"
            aria-current={on ? 'page' : undefined}
            onClick={onNavigate}
          >
            <Icon name={t.icon!} />
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
      {PREVIEWS.filter((t) => !t.only || counts[t.only] > 0).map((t) => (
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
