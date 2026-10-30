'use server'

import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { auditLog } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { sendInvites } from '@/server/modules/email/onboarding-send'

/** Who pressed it (rule 3). The audit log carries a name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Send the onboarding invite to the makers who were ticked.
 *
 * The cohort is rebuilt from the database and only then narrowed to what the
 * form posted, so a stale tab cannot mail somebody whose space was released
 * since it loaded, and a booking id from another show reaches nobody.
 *
 * One audit row for the press rather than one per message. This is a single
 * editorial act by a named person and reads back as one, which is the
 * question somebody actually asks later: who sent this, and to how many.
 */
export async function sendOnboardingInvites(fd: FormData): Promise<void> {
  const show = await activeShow()
  if (!show) redirect('/admin/onboarding')

  const only = new Set(fd.getAll('send').map(String).filter(Boolean))
  if (only.size === 0) redirect('/admin/onboarding?sent=0&skipped=0&logged=0&failed=0')

  const again = String(fd.get('again') ?? '') === '1'
  const who = await staffActor()

  const res = await sendInvites(db, {
    showId: show.id,
    showName: show.name,
    inventoryDueAt: show.inventoryDueAt,
    showPayoutSetup: show.payoutSetup,
    showOpenedAt: show.applicationsOpenAt,
    again,
    only,
  })

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'show',
    entityId: show.id,
    action: 'onboarding_invite_sent',
    actor: who,
    before: null,
    after: JSON.stringify({
      ticked: only.size, sent: res.sent, logged: res.logged,
      skipped: res.skipped, failed: res.failed.length, again,
    }),
    reason: 'inventory and payout setup invite',
  })

  revalidatePath('/admin/onboarding')
  redirect(
    `/admin/onboarding?sent=${res.sent}&logged=${res.logged}`
    + `&skipped=${res.skipped}&failed=${res.failed.length}`,
  )
}
