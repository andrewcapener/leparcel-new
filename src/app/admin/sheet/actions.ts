'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { activeShow, forgetShowConfig } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { pushInventoryTabs, pushPaymentTabs, spreadsheetIdFrom } from '@/server/modules/roster/sheet-push'
import { redact } from '@/server/modules/sheets/transport'
import type { PushState } from './state'

/**
 * Write the two payment tabs into the sheet somebody pasted.
 *
 * Every failure comes back as a sentence on the screen, including the ones
 * nobody anticipated. An action that throws takes the page into an error
 * boundary, and an error boundary on a button is indistinguishable from a
 * button that does nothing, which is the report this page has already
 * produced once. A migration one deploy behind, a database that blinked, a
 * Google that hung: each of those is worth a line somebody can act on and
 * none of them is worth a blank screen.
 */
export async function pushToSheet(_prev: PushState, fd: FormData): Promise<PushState> {
  const link = String(fd.get('link') ?? '')
  try {
    return await push(link)
  } catch (err) {
    return {
      link,
      ok: false,
      message: 'Nothing was written. ' + redact(
        err instanceof Error ? err.message : 'Something failed and said nothing about itself.',
      ),
    }
  }
}

async function push(link: string): Promise<PushState> {
  const id = spreadsheetIdFrom(link)
  if (!id) {
    return { link, ok: false, message: 'That is not a Google Sheet link. Paste the whole URL from the address bar.' }
  }

  const show = await activeShow()
  if (!show) return { link, ok: false, message: 'No active show.' }

  const res = await pushPaymentTabs(db, show.id, id, siteUrl())
  if (!res.ok) return { link, ok: false, message: res.detail }

  /* And the inventory, in the same press. Two separate pushes because they
     change at different moments and neither should rewrite the other's tabs
     for nothing, but one button, because nobody wants to remember which
     half of their sheet is stale. */
  const inv = await pushInventoryTabs(db, show.id, id)
  if (!inv.ok) return { link, ok: false, message: inv.detail }

  /* Remembered, and that is what makes it live. From here on every payment
     that lands, every Venmo matched by hand and every space released pushes
     these tabs on its way past, so nobody has to remember to press this
     again. Written only after a successful push, so the column never names a
     sheet we have not proved we can write to. */
  await db.update(shows).set({ paymentSheetId: id }).where(eq(shows.id, show.id))
  /* The Show record is cached for a minute, and this column is the one that
     decides whether anything is pushed at all. Without this, the next payment
     to land would read a show that still has no sheet and quietly push
     nowhere, which looks exactly like the sheet not working. */
  forgetShowConfig()

  revalidatePath('/admin/sheet')
  revalidatePath('/admin/roster')
  return {
    link,
    ok: true,
    message: `Written. "${res.tabs[0]}" and "${res.tabs[1]}" now hold ${res.rows} makers, `
      + `and "${inv.tabs[0]}" holds ${inv.rows} priced lines with "${inv.tabs[1]}" beside it `
      + 'showing who has not filed yet. They keep themselves up to date: every payment, every '
      + 'Venmo you match and every space you release refreshes the money tabs, and a maker '
      + 'filing her list refreshes the inventory ones. Press this again any time to force it.',
  }
}
