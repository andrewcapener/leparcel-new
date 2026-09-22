'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
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

  revalidatePath('/admin/sheet')
  return {
    link,
    ok: true,
    message: `Written. "${res.tabs[0]}" and "${res.tabs[1]}" now hold ${res.rows} makers. `
      + 'Press it again whenever you want them refreshed.',
  }
}
