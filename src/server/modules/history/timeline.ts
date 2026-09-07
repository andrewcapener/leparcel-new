/**
 * Everything that has passed between Mermade and one maker, in one list.
 *
 * Drew: "when I click in on an applicant, I wanna be able to at the bottom see
 * their entire history, including emails that we sent to them. So it
 * essentially has just a chronological history of activity between mermade and
 * them."
 *
 * The information already exists and is scattered across four tables, which is
 * the same as it not existing: answering "what have we actually said to this
 * person" meant the audit log, the outbox, the booking and the application row
 * in four places, in your head, in order. This assembles it.
 *
 * Read-only and additive. Nothing here writes, nothing here is the source of
 * truth, and a table that cannot be read simply contributes no events rather
 * than taking the screen down: a history is the last thing that should be able
 * to break the page it is at the bottom of.
 *
 * Emails are matched on the maker's address rather than on an application id,
 * because the outbox is addressed to a person and a returning maker's earlier
 * correspondence is part of the history somebody is asking about. That does
 * mean a shared inbox address would pull in a colleague's mail; the alternative
 * is showing less than the truth, and staff can see the subject either way.
 */
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { db as Db } from '@/db'
import { applications, auditLog, bookings, emailOutbox } from '@/db/schema'

export type EventKind = 'applied' | 'decision' | 'email' | 'booking' | 'note'

export type TimelineEvent = {
  at: string
  kind: EventKind
  /** One line, in the admin's own voice. */
  title: string
  /** The second line, when there is more worth saying. */
  detail?: string
  /** Who did it, when a person did. */
  actor?: string
  /** The whole of what was sent, for an email. */
  body?: string
  /** 'sent' | 'failed' | 'logged', for an email. */
  status?: string
}

/** 'status_change' → 'Status change'. Actions are written as snake_case. */
function humanAction(action: string): string {
  const words = action.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** 'application_received' → 'Application received'. Same for templates. */
const humanTemplate = humanAction

export async function timelineFor(
  db: typeof Db,
  opts: { applicationId: string; vendorId: string; email: string },
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = []

  const [app] = await db
    .select({ submittedAt: applications.submittedAt, track: applications.track })
    .from(applications)
    .where(eq(applications.id, opts.applicationId))
    .limit(1)

  if (app) {
    events.push({
      at: app.submittedAt,
      kind: 'applied',
      title: 'Application submitted',
      detail: `${app.track} track`,
    })
  }

  /* The audit log, for this application, this maker, and any booking made
     from it. Bookings are looked up first because the log keys on their id. */
  const held = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.applicationId, opts.applicationId))
  const bookingIds = held.map((b) => b.id)

  const audits = await db
    .select()
    .from(auditLog)
    .where(or(
      and(eq(auditLog.entity, 'application'), eq(auditLog.entityId, opts.applicationId)),
      and(eq(auditLog.entity, 'vendor'), eq(auditLog.entityId, opts.vendorId)),
      ...(bookingIds.length > 0
        ? [and(eq(auditLog.entity, 'booking'), inArray(auditLog.entityId, bookingIds))]
        : []),
    ))
    .orderBy(desc(auditLog.at))

  for (const a of audits) {
    // The submission already has its own event, from the application row.
    if (a.entity === 'application' && a.action === 'submitted') continue
    events.push({
      at: a.at,
      kind: a.entity === 'booking' ? 'booking' : 'decision',
      title: humanAction(a.action),
      detail: a.reason || undefined,
      actor: a.actor,
    })
  }

  /* Everything we have sent this address. The body is carried so staff can
     read the exact words that went out rather than guess from a subject. */
  const mail = await db
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.toEmail, opts.email))
    .orderBy(desc(emailOutbox.sentAt))

  for (const m of mail) {
    events.push({
      at: m.sentAt,
      kind: 'email',
      title: m.subject,
      detail: humanTemplate(m.template),
      body: m.body,
      status: m.deliveryStatus,
    })
  }

  // Newest first, the way a timeline is read. A missing timestamp sorts last
  // rather than throwing the order out.
  return events.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
}
