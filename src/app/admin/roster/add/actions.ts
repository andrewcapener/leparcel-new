'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { addMaker, readNewMaker } from '@/server/modules/roster/add-maker'

/** Who pressed it (rule 3). The audit log carries a name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? '')

/**
 * Put a maker on the roster by hand.
 *
 * Everything typed comes back on a refusal, the way /apply does it. Staff
 * retyping six fields because the fee had a word in it is how a screen stops
 * being used.
 */
export async function addMakerByHand(fd: FormData): Promise<void> {
  const show = await activeShow()
  if (!show) redirect('/admin/roster')

  const typed = {
    shopName: field(fd, 'shopName'),
    contactName: field(fd, 'contactName'),
    email: field(fd, 'email'),
    spaceTypeId: field(fd, 'spaceTypeId'),
    fee: field(fd, 'fee'),
    instagram: field(fd, 'instagram'),
    phone: field(fd, 'phone'),
    reason: field(fd, 'reason'),
  }

  const echo = new URLSearchParams()
  for (const [k, v] of Object.entries(typed)) if (v) echo.set(k, v)

  const read = readNewMaker(typed)
  if ('bad' in read) {
    echo.set('bad', read.bad)
    redirect(`/admin/roster/add?${echo}`)
  }

  const res = await addMaker(db, show.id, read.ready, await staffActor())
  if (!res.ok) {
    echo.set('bad', res.because)
    redirect(`/admin/roster/add?${echo}`)
  }

  revalidatePath('/admin/roster')
  revalidatePath('/makers')
  redirect(`/admin/roster/${res.bookingId}?added=${res.vendorCode}`)
}
