import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, bookings, emailOutbox } from '@/db/schema'
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

async function navCounts(showId: string | undefined) {
  if (!showId) return { undecided: 0, needsPerson: 0 }
  const [undecided] = await db
    .select({ n: sql<number>`count(*)` })
    .from(applications)
    .where(and(
      eq(applications.showId, showId),
      inArray(applications.status, ['new', 'under_review', 'shortlist']),
    ))
  /* The same test the roster sorts on: no documentation, no payment, or no
     certificate of insurance. Kept in one expression so the badge and the
     screen can never disagree. */
  const [needsPerson] = await db
    .select({ n: sql<number>`count(*)` })
    .from(bookings)
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .where(and(
      eq(bookings.showId, showId),
      or(
        and(eq(applications.sellerPermit, ''), eq(applications.occasionalSeller, false)),
        eq(bookings.status, 'awaiting_payment'),
        eq(applications.hasCoi, false),
      ),
    ))
  return { undecided: num(undecided?.n), needsPerson: num(needsPerson?.n) }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Never let a missing show, or a database that is one migration behind,
  // take the whole admin down: /admin/show is where you would go to fix it,
  // and /admin/login has to render before there is a session at all.
  const show = await activeShow().catch(() => undefined)
  const counts = await navCounts(show?.id).catch(() => ({ undecided: 0, needsPerson: 0 }))
  const failedMail = await db
    .select({ n: sql<number>`count(*)` })
    .from(emailOutbox)
    .where(eq(emailOutbox.deliveryStatus, 'failed'))
    .then((r) => num(r[0]?.n))
    .catch(() => 0)

  return (
    <AdminShell showName={show?.name} counts={counts} failedMail={failedMail}>
      {children}
    </AdminShell>
  )
}
