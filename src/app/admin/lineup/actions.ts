'use server'

import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { applications, auditLog, bookingSpaces, bookings, spaceTypes, vendors } from '@/db/schema'
import { activeShow } from '@/db/queries'
import {
  orderedIds, orderChanges, visibilityChanges,
} from '@/server/modules/roster/lineup-board'
import { cleanLinkUrl, makerLink } from '@/server/modules/roster/maker-link'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'

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
 * Save the board: the order everything was dragged into, and who is shown.
 *
 * One press for both, because they are one decision. Elise is looking at the
 * grid deciding what it should look like, not performing two separate
 * administrative acts.
 *
 * The board is rebuilt from the database rather than trusted from the form,
 * so a stale tab cannot hide a maker who was added after it loaded, and an id
 * from another show cannot be written at all. See lineup-board.ts for what
 * survives a round trip and what does not.
 *
 * Only rows that actually changed are written, so moving one card does not
 * leave eighty eight audit entries behind it.
 */
export async function saveLineup(fd: FormData): Promise<void> {
  const show = await activeShow()
  if (!show) redirect('/admin/lineup')

  const rows = await db
    .select({
      id: bookingSpaces.id,
      bookingId: bookings.id,
      applicationId: applications.id,
      linkUrl: applications.linkUrl,
      website: vendors.website,
      instagram: vendors.instagram,
      lineupOrder: bookingSpaces.lineupOrder,
      hidden: bookingSpaces.lineupHiddenAt,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(bookingSpaces, eq(bookingSpaces.bookingId, bookings.id))
    .innerJoin(spaceTypes, eq(bookingSpaces.spaceTypeId, spaceTypes.id))
    .where(and(
      eq(bookings.showId, show.id),
      inArray(bookings.status, ['confirmed', 'payment_processing', 'awaiting_payment']),
      isNull(bookingSpaces.voidedAt),
    ))

  const known = rows.map((r) => r.id)
  const ordered = orderedIds(String(fd.get('order') ?? ''), known)
  const moves = orderChanges(ordered, new Map(rows.map((r) => [r.id, r.lineupOrder])))
  const { hide, list } = visibilityChanges(
    fd.getAll('shown').map(String), known,
    new Set(rows.filter((r) => r.hidden).map((r) => r.id)),
  )

  const who = await staffActor()
  const now = new Date().toISOString()

  /* Where each tile sends a shopper. One application can have several cards
     (a maker outdoors three days), so the last non-empty value for an
     application wins and an emptied field clears the override, handing her
     own website or Instagram back. Cleaned before it is stored, because this
     ends up as an href on a page shoppers read. */
  const wantLink = new Map<string, string | null>()
  let refused = 0
  for (const r of rows) {
    const typed = fd.get(`link:${r.id}`)
    if (typed === null) continue
    const raw = String(typed).trim()
    let cleaned = raw ? cleanLinkUrl(raw) : null
    /* Something was typed and it is not an address we will publish. Leave the
       tile exactly as it was and say so, rather than clearing whatever was
       working before because the last keystroke was a typo. */
    if (raw && cleaned === null) { refused++; continue }
    /* The field arrives pre-filled with what the tile does today, which for
       most makers is their own website or Instagram. Saving the board must
       not turn all eighty eight of those into staff overrides: a value equal
       to her own link IS no override, so it stores as none and her tile keeps
       following her application. */
    if (cleaned !== null && cleaned === makerLink({ website: r.website, instagram: r.instagram })) {
      cleaned = null
    }
    const prev = wantLink.get(r.applicationId)
    if (prev === undefined || cleaned !== null) wantLink.set(r.applicationId, cleaned)
  }
  const linkChanges = [...wantLink.entries()].filter(
    ([appId, url]) => (rows.find((r) => r.applicationId === appId)?.linkUrl ?? null) !== url,
  )
  for (const [appId, url] of linkChanges) {
    await db.update(applications).set({ linkUrl: url }).where(eq(applications.id, appId))
  }

  for (const m of moves) {
    await db.update(bookingSpaces).set({ lineupOrder: m.lineupOrder })
      .where(eq(bookingSpaces.id, m.id))
  }
  if (hide.length > 0) {
    await db.update(bookingSpaces)
      .set({ lineupHiddenAt: now, lineupHiddenBy: who, lineupHiddenReason: 'from the lineup board' })
      .where(and(inArray(bookingSpaces.id, hide), isNull(bookingSpaces.lineupHiddenAt)))
  }
  if (list.length > 0) {
    await db.update(bookingSpaces)
      .set({ lineupHiddenAt: null, lineupHiddenBy: null, lineupHiddenReason: null })
      .where(inArray(bookingSpaces.id, list))
  }

  /* One audit row for the press, not one per card: the board is a single
     editorial act and reads back as one. Each maker whose visibility changed
     is named, because that is the part somebody comes asking about. */
  if (moves.length > 0 || hide.length > 0 || list.length > 0 || linkChanges.length > 0) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'lineup_saved',
      before: JSON.stringify({ hiddenCount: rows.filter((r) => r.hidden).length }),
      after: JSON.stringify({
        moved: moves.length, hidden: hide, listed: list,
        relinked: linkChanges.map(([id, url]) => ({ applicationId: id, url })),
      }),
      reason: 'lineup board',
      actor: who,
    })
  }

  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  redirect(`/admin/lineup?moved=${moves.length}&hid=${hide.length}&lit=${list.length}`
    + `&rel=${linkChanges.length}&bad=${refused}`)
}
