'use server'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { auditLog, bookings, vendors } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { backTo, MAX_SHOP } from './resend-lines'

/** Who pressed it (rule 3). A name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Correct a maker's shop name.
 *
 * Chelsy Erickson, 3 November: "you have both booths listed as Little Yoked
 * Creations. This is the Jr Maker booth name. Mine for my potpourri is just
 * Yoked Creations." She holds two, MM3 and MM21, under two addresses, and the
 * row behind MM3 had the other booth's name on it. So her onboarding email
 * greeted her as the wrong shop and printed the right Mermade ID underneath,
 * which is the kind of mistake a maker reads as nobody knowing who she is.
 *
 * Nothing could fix it. The shop name is written when an application comes in
 * and when a maker is added by hand, and after that no screen in the admin
 * could touch it. A name typed wrong, a shop that rebrands between seasons,
 * two booths filed under one name: all of them were permanent.
 *
 * It is the vendor's name, not the booking's, because the maker is the
 * account and that is what every other screen reads. Two booths under ONE
 * address would therefore still share a name, and that is the real shape of
 * the data rather than something to paper over here: if that case turns up,
 * the booths need their own display name and this is not it.
 *
 * Audit-logged with both names. A shop name appears on the public lineup, in
 * every email and on her statement, so changing one is not a cosmetic edit.
 */
export async function renameShop(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const back = String(fd.get('back') ?? '/admin/roster')
  const wanted = String(fd.get('shopName') ?? '').trim().replace(/\s+/g, ' ')

  if (!wanted) redirect(backTo(back, 'name', 'empty'))
  if (wanted.length > MAX_SHOP) redirect(backTo(back, 'name', 'long'))

  const [row] = await db
    .select({ vendorId: vendors.id, shopName: vendors.shopName })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!row) redirect(backTo(back, 'name', 'missing'))
  /* Pressing save on an unchanged field is not a change worth a log line. */
  if (row.shopName === wanted) redirect(backTo(back, 'name', 'same'))

  const who = await staffActor()
  await db.update(vendors).set({ shopName: wanted }).where(eq(vendors.id, row.vendorId))

  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'vendor',
    entityId: row.vendorId,
    action: 'shop_renamed',
    actor: who,
    before: JSON.stringify({ shopName: row.shopName }),
    after: JSON.stringify({ shopName: wanted }),
    reason: 'shop name corrected by staff',
  })

  /* Everywhere a shop name is read: her own page, the public lineup, the
     board, the roster. */
  revalidatePath('/account')
  revalidatePath('/makers')
  revalidatePath('/admin/lineup')
  revalidatePath('/admin/roster')
  redirect(backTo(back, 'name', 'renamed'))
}
