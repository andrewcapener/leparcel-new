'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { fmtDateTime } from '@/lib/dates'
import { bookings, vendors } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { deadlineChanges, losesTime } from '@/server/modules/payments/align-deadline'
import { sendChase } from '@/server/modules/email/chase-send'
import { cancelScheduledChase } from '@/server/modules/email/chase-cancel'
import { pacificWallToUtc } from '@/server/modules/email/fee-chase'
import type { ChaseState, StopState } from './state'

/**
 * Hand the morning's chase to Resend, with a time on it.
 *
 * The only thing in this codebase that mails sixty people at once, so it is
 * the only one that makes you tick them first. `only` is built from the
 * checkboxes, `sendChase` refuses anybody outside it, and both halves are
 * written down: the outbox gets a row per message and the audit log gets the
 * decision (rule 3).
 *
 * Catches everything, for the same reason /admin/sheet does. A server action
 * that throws is a button that appears to do nothing, and finding that out at
 * nine in the morning is finding it out too late.
 */
export async function scheduleChase(_prev: ChaseState, fd: FormData): Promise<ChaseState> {
  const at = String(fd.get('at') ?? '')
  try {
    return await run(at, fd)
  } catch (err) {
    return {
      ok: false, at,
      message: 'Nothing was scheduled. '
        + (err instanceof Error ? err.message.slice(0, 300) : 'Something failed silently.'),
    }
  }
}

async function run(at: string, fd: FormData): Promise<ChaseState> {
  const show = await activeShow()
  if (!show) return { ok: false, at, message: 'No active show.' }

  /* A local datetime typed by a person, read as Pacific because that is the
     clock they are thinking in (rule 8). "2026-09-23T09:00" means nine in
     Dana Point, whatever the laptop is set to. */
  const m = at.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/)
  if (!m) {
    return { ok: false, at, message: 'Pick a date and time for it to arrive.' }
  }
  const when = pacificWallToUtc(m[1]!, Number(m[2]), Number(m[3]))

  if (when.getTime() < Date.now() - 60_000) {
    return { ok: false, at, message: 'That time has already passed. Pick one in the future.' }
  }
  /* Resend holds a scheduled send for up to 30 days. Past that it is not a
     schedule, it is a thing somebody will have forgotten about. */
  if (when.getTime() > Date.now() + 30 * 86_400_000) {
    return { ok: false, at, message: 'Resend holds a send for 30 days. Pick something sooner.' }
  }

  const only = new Set(fd.getAll('send').map(String))
  if (only.size === 0) {
    return { ok: false, at, message: 'Nobody is ticked, so nothing was scheduled.' }
  }

  /* sendChase re-plans for the Pacific day this lands on, so a ticked
     booking that is not due that day is dropped rather than told
     something false. */
  const res = await sendChase(db, show.id, siteUrl(), only, when.toISOString())

  await db.insert(auditLog).values({
    id: randomUUID(), entity: 'show', entityId: show.id,
    action: res.ok ? 'fee_chase_scheduled' : 'fee_chase_failed',
    actor: 'staff',
    before: null,
    after: JSON.stringify({
      selected: only.size,
      queued: res.ok ? res.queued : 0,
      scheduledAt: when.toISOString(),
      resendId: res.ok ? res.resendId : '',
    }),
    reason: res.ok ? 'booth fee chase' : `booth fee chase failed: ${res.detail.slice(0, 200)}`,
  })

  revalidatePath('/admin/chase')
  revalidatePath('/admin/outbox')

  if (!res.ok) return { ok: false, at, message: res.detail }
  return {
    ok: true, at,
    message: `Scheduled. ${res.queued === 1 ? 'One email is' : `${res.queued} emails are`} `
      + `with Resend and will arrive ${fmtDateTime(when.toISOString())}. `
      + 'Nothing here has to be running for '
      + 'that to happen. They are all in the outbox now, and pressing this again this morning '
      + 'will not send anybody a second copy.',
  }
}

/**
 * Put every unpaid booking on the show's deadline.
 *
 * Drew, 22 Sept: "everyone's fees are due tomorrow midnight regardless of
 * acceptance time. just to make it easy."
 *
 * A booking carries the deadline it was created with, and the system refuses
 * to give anybody less than the payment window, so makers accepted on the
 * last afternoon carry a later date than the rest of the roster. One date is
 * simpler to say, simpler to chase and simpler to hold people to, and it is
 * the owner's call to make.
 *
 * It does shorten a promise for whoever is pulled back, so it says how many
 * and it writes down every move: one audit row per booking, with the date it
 * had and the date it has now (rule 3). Nothing about paid or released
 * bookings is touched.
 */
export async function alignDeadlines(): Promise<void> {
  const show = await activeShow()
  if (!show?.paymentDueAt) return

  const rows = await db
    .select({
      bookingId: bookings.id, vendorCode: bookings.vendorCode,
      shopName: vendors.shopName, status: bookings.status,
      paymentDueAt: bookings.paymentDueAt,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.showId, show.id))

  const changes = deadlineChanges(rows, show.paymentDueAt)
  for (const c of changes) {
    await db.update(bookings)
      .set({ paymentDueAt: c.to })
      .where(eq(bookings.id, c.bookingId))
    await db.insert(auditLog).values({
      id: randomUUID(), entity: 'booking', entityId: c.bookingId,
      action: 'payment_deadline_aligned', actor: 'staff',
      before: JSON.stringify({ paymentDueAt: c.from }),
      after: JSON.stringify({ paymentDueAt: c.to }),
      reason: c.gainsTime
        ? 'put on the show deadline, which gives them longer'
        : 'put on the show deadline, at the owner\'s instruction, which is sooner than the 48 hours the system had given them',
    })
  }

  if (changes.length > 0) {
    await db.insert(auditLog).values({
      id: randomUUID(), entity: 'show', entityId: show.id,
      action: 'payment_deadlines_aligned', actor: 'staff',
      before: null,
      after: JSON.stringify({
        moved: changes.length, shortened: losesTime(changes).length, to: show.paymentDueAt,
      }),
      reason: 'one deadline for everybody',
    })
  }

  revalidatePath('/admin/chase')
  revalidatePath('/admin/roster')
}

/**
 * Stop a chase that is scheduled but has not gone.
 *
 * The reason scheduling through the provider beats waking something up at
 * nine: until the minute it goes, it is still somewhere you can reach it.
 * Drew scheduled sixty five and then wanted the greeting changed, which is
 * exactly the situation this is for.
 *
 * One cancelled message is one audit row, and the batch gets its own, because
 * unsending sixty five emails is a thing somebody should be able to find
 * afterwards (rule 3).
 */
export async function stopScheduledChase(
  _prev: StopState, _fd: FormData,
): Promise<StopState> {
  try {
    return await stop()
  } catch (err) {
    return {
      ok: false,
      message: 'Nothing was cancelled, and this is why: '
        + (err instanceof Error ? err.message.slice(0, 300) : 'it failed without saying anything.')
        + ' You can always cancel a scheduled send by hand in the Resend dashboard.',
    }
  }
}

async function stop(): Promise<StopState> {
  const show = await activeShow()
  const res = await cancelScheduledChase(db)

  if (res.nothingToDo) {
    return { ok: true, message: 'Nothing is scheduled, so there was nothing to stop.' }
  }

  await db.insert(auditLog).values({
    id: randomUUID(), entity: 'show', entityId: show?.id ?? '',
    action: res.failed.length > 0 || res.cancelled === 0
      ? 'fee_chase_cancel_partial'
      : 'fee_chase_cancelled',
    actor: 'staff',
    before: null,
    after: JSON.stringify({
      cancelled: res.cancelled, alreadyGone: res.alreadyGone, failed: res.failed.length,
      fromOurRecords: res.fromOurRecords, fromProvider: res.fromProvider,
    }),
    reason: res.listProblem || 'scheduled chase stopped before it went out',
  })

  revalidatePath('/admin/chase')
  revalidatePath('/admin/outbox')

  /* Say what happened in every case, including the case where the answer is
     nothing. A button that reports nothing is indistinguishable from a button
     that does nothing, and this one has already been pressed once in the dark. */
  const parts: string[] = []
  if (res.cancelled > 0) parts.push(`${res.cancelled} stopped.`)
  if (res.alreadyGone > 0) parts.push(`${res.alreadyGone} had already gone and cannot be recalled.`)
  if (res.failed.length > 0) {
    parts.push(`${res.failed.length} would not cancel: ${res.failed[0]!.detail}`)
  }

  if (res.cancelled === 0 && res.alreadyGone === 0) {
    return {
      ok: false,
      message: 'Nothing was cancelled. '
        + (res.listProblem
          ? res.listProblem + ' '
          : `We held ${res.fromOurRecords} message ids and none of them cancelled. `)
        + 'Cancel them in the Resend dashboard instead: open resend.com, go to Emails, and '
        + 'cancel the ones scheduled for the morning. That always works, and it is the same '
        + 'thing this button is asking Resend to do.',
    }
  }

  return {
    ok: res.failed.length === 0,
    message: parts.join(' ')
      + (res.fromProvider > 0
        ? ` ${res.fromProvider} of those were found by asking Resend, because they were scheduled`
          + ' before this site started keeping their ids.'
        : ''),
  }
}
