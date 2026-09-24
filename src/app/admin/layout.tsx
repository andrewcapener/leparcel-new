import { cookies } from 'next/headers'
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, bookings, emailOutbox } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { AdminShell } from './AdminShell'
// The admin's own stylesheet. Imported here rather than in the root layout so
// the public site gets the vendored Symmetry theme and nothing else.
import '../globals.css'

export const dynamic = 'force-dynamic'

/**
 * The admin register. docs/08-DESIGN-SYSTEM.md §5: a fixed dark sidebar
 * against a near-white content area, Oswald caps for anything you scan,
 * Figtree for names and prose, JetBrains Mono for machine text.
 *
 * The layout reads the two counts the sidebar badges carry. They are the
 * only numbers on every screen, so they are the two that answer "is there
 * anything waiting for me" without opening anything: applications still to
 * decide, and roster rows that need a person.
 */

const num = (v: number | string | null | undefined) => Number(v ?? 0)

async function navCounts(showId: string | undefined, openAt: string | undefined) {
  if (!showId || !openAt) return { undecided: 0, needsPerson: 0, rehearsals: 0 }

  /* Three independent counts, asked at once. Serially these were three round
     trips stacked end to end, all of them for numbers that go in a badge. */
  const [undecided, needsPerson, rehearsals] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(applications)
      .where(and(
        eq(applications.showId, showId),
        inArray(applications.status, ['new', 'under_review', 'shortlist']),
      )),

    /* The same test the roster sorts on: no documentation, or no payment.
       Kept in one expression so the badge and the screen can never disagree.
       Insurance was a third clause here until 20 Sept; it is recommended and
       not required, so a maker without it is not waiting on anybody. */
    db
      .select({ n: sql<number>`count(*)` })
      .from(bookings)
      .innerJoin(applications, eq(bookings.applicationId, applications.id))
      .where(and(
        eq(bookings.showId, showId),
        or(
          /* No permit record AND nothing they told us that we can act on.
             An indoor maker is never counted, because Mermade is the retailer
             of record for their sales and nobody asks them. Mirrors
             permitCleared in compliance/permit.ts; kept as SQL because this is
             a badge count over every booking rather than a per row check. */
          and(
            ne(applications.track, 'indoor'),
            eq(applications.sellerPermit, ''),
            eq(applications.occasionalSeller, false),
          ),
          /* Unpaid only. A bank transfer in flight is not a thing anybody
             needs to act on: see booking-status.ts. */
          eq(bookings.status, 'awaiting_payment'),
        ),
      )),

    /* Rehearsals: submitted before the window opened, so ours. Cast both sides
       to timestamptz. These are text columns holding two shapes, Postgres's
       "2026-09-07 17:12:00+00" and the Show record's ISO
       "2026-09-07T09:00:00-07:00", and a space sorts before a T, so compared as
       text every application submitted today counted as a rehearsal. Same
       comparison as purgeRehearsals, and pinned by rehearsal-window.test.ts. */
    db
      .select({ n: sql<number>`count(*)` })
      .from(applications)
      .where(and(
        eq(applications.showId, showId),
        sql`${applications.submittedAt}::timestamptz < ${openAt}::timestamptz`,
      )),
  ])

  return {
    undecided: num(undecided[0]?.n),
    needsPerson: num(needsPerson[0]?.n),
    rehearsals: num(rehearsals[0]?.n),
  }
}

const NO_COUNTS = { undecided: 0, needsPerson: 0, rehearsals: 0 }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /* The session FIRST, and the database only if there is one.
     
     This used to read the show, three badge counts and the failed-mail count
     before it looked at the cookie. /admin/login is nested under this layout,
     so signing in meant waking Postgres and waiting on five queries before
     the password box could render. With nobody in the admin for an hour the
     connection is cold, and the first attempt took forty five seconds and
     then ninety, which reads as the admin being down. It was reported twice.
     
     A signed-out visitor is only ever looking at the sign-in box, and the
     sidebar it would fill is not shown to them anyway. So: no session, no
     queries. */
  const jar = await cookies()
  const staff = await staffForSession(jar.get(ADMIN_COOKIE)?.value)

  if (!staff) {
    return (
      <AdminShell showName={undefined} counts={NO_COUNTS} failedMail={0}>
        {children}
      </AdminShell>
    )
  }

  /* Together rather than one after another. These are four independent reads
     and they were four serial round trips, which on a cold pool is four waits
     stacked end to end for numbers that go in a badge.
     
     Never let a missing show, or a database one migration behind, take the
     whole admin down: /admin/show is where you would go to fix it. */
  const show = await activeShow().catch(() => undefined)
  const [counts, failedMail] = await Promise.all([
    navCounts(show?.id, show?.applicationsOpenAt).catch(() => NO_COUNTS),
    db
      .select({ n: sql<number>`count(*)` })
      .from(emailOutbox)
      .where(eq(emailOutbox.deliveryStatus, 'failed'))
      .then((r) => num(r[0]?.n))
      .catch(() => 0),
  ])

  return (
    <AdminShell
      showName={show?.name} counts={counts} failedMail={failedMail}
      staffName={staff?.name}
    >
      {children}
    </AdminShell>
  )
}
