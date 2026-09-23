'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { pushPaymentTabs, spreadsheetIdFrom } from '@/server/modules/roster/sheet-push'

export type PushState = {
  /** Echoed back so a rejected paste is not lost. */
  link: string
  ok: boolean
  message: string
}

export const emptyPush: PushState = { link: '', ok: false, message: '' }

export async function pushToSheet(_prev: PushState, fd: FormData): Promise<PushState> {
  const link = String(fd.get('link') ?? '')
  const id = spreadsheetIdFrom(link)
  if (!id) {
    return { link, ok: false, message: 'That is not a Google Sheet link. Paste the whole URL from the address bar.' }
  }

  const show = await activeShow()
  if (!show) return { link, ok: false, message: 'No active show.' }

  const res = await pushPaymentTabs(db, show.id, id, siteUrl())
  if (!res.ok) return { link, ok: false, message: res.detail }

  /* Remembered, and that is what makes it live. From here on every payment
     that lands, every Venmo matched by hand and every space released pushes
     these tabs on its way past, so nobody has to remember to press this
     again. Written only after a successful push, so the column never names a
     sheet we have not proved we can write to. */
  await db.update(shows).set({ paymentSheetId: id }).where(eq(shows.id, show.id))

  revalidatePath('/admin/sheet')
  revalidatePath('/admin/roster')
  return {
    link,
    ok: true,
    message: `Written. "${res.tabs[0]}" and "${res.tabs[1]}" now hold ${res.rows} makers, `
      + 'and they will keep themselves up to date: every payment, every Venmo you match and '
      + 'every space you release refreshes them. Press this again any time to force it.',
  }
}
