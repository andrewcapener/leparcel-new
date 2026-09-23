'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { fmtDateTime } from '@/lib/dates'
import { sendChase } from '@/server/modules/email/chase-send'
import { pacificWallToUtc } from '@/server/modules/email/fee-chase'
import type { ChaseState } from './state'

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
