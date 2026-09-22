import { accessToken, serviceAccount } from '@/server/modules/sheets/google-auth'
import { redact } from '@/server/modules/sheets/transport'
import {
  LINK_COLUMNS, PAYMENT_COLUMNS, linkValues, paymentValues, paymentRows,
} from './payment-export'
import type { db as Db } from '@/db'

/**
 * The two payment tabs, written straight into the team's own Google Sheet.
 *
 * Drew asked for a tab of pay links to mail merge from and a tab that tracks
 * payments, on the sheet the team already has open. Downloading two files and
 * pasting them is thirty seconds, but it is thirty seconds somebody has to
 * remember to repeat, and a tracking tab nobody refreshes is worse than no
 * tracking tab because it looks current.
 *
 * So the app writes them. The credentials already exist: this is the same
 * service account, the same token and the same API the application sync has
 * used since September, and the scope it already holds (spreadsheets) is the
 * one that can create a tab.
 *
 * Each push REPLACES both tabs rather than appending, because they are a
 * snapshot of the roster and a stale row that quietly survives a refresh is
 * the failure everybody trusts. Anything a person typed in a column to the
 * right is left alone; only the columns these files own are cleared.
 */

type DbHandle = typeof Db

export const LINKS_TAB = 'Pay links'
export const PAYMENTS_TAB = 'Payments'

const TIMEOUT_MS = 15_000

/**
 * The id out of whatever somebody pastes.
 *
 * A full edit URL is what you get from the address bar and from the Share
 * dialog, and asking for "just the id in the middle" is asking for a mistake
 * at nine in the morning.
 */
export function spreadsheetIdFrom(input: string): string | null {
  const t = (input ?? '').trim()
  if (!t) return null
  const inUrl = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
  if (inUrl) return inUrl[1]!
  /* A bare id. Google's are long and use this alphabet; anything else is a
     typo and saying so beats a 404 from the API. */
  if (/^[a-zA-Z0-9_-]{20,}$/.test(t)) return t
  return null
}

/** A1 notation for a whole tab, quoted so a space in the name is fine. */
const tabRange = (tab: string, range: string) =>
  encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${range}`)

/** Column letter for a 1-based index: 1 -> A, 27 -> AA. */
export function colLetter(n: number): string {
  let out = ''
  let i = n
  while (i > 0) {
    const r = (i - 1) % 26
    out = String.fromCharCode(65 + r) + out
    i = Math.floor((i - r) / 26)
  }
  return out
}

type Call = { method: string; path: string; body?: unknown }

async function api(spreadsheetId: string, token: string, call: Call) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${call.path}`,
    {
      method: call.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(call.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(call.body ? { body: JSON.stringify(call.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  const text = await res.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* an HTML error page; the text is enough */ }
  return { status: res.status, text, json }
}

/**
 * What went wrong, in the words of the thing somebody has to go and do.
 *
 * 403 on a sheet that exists is always the same forgotten step and the raw
 * message ("The caller does not have permission") sends people to IAM, which
 * is not where the fix is. The service account's address is not a secret and
 * naming it here is the difference between a fix and a support thread.
 */
function why(status: number, text: string, email: string): string {
  if (status === 403) {
    return `Google refused. Open the sheet, press Share, and give ${email} `
      + 'the Editor role. That is the whole fix; nothing else needs changing.'
  }
  if (status === 404) return 'No sheet with that id. Check the link you pasted.'
  return redact(`Google said HTTP ${status}: ${text.slice(0, 200)}`)
}

/** Make the tab if it is not there. Already existing is a success, not a race. */
async function ensureTab(
  spreadsheetId: string, token: string, tab: string, email: string,
): Promise<true | string> {
  const made = await api(spreadsheetId, token, {
    method: 'POST',
    path: ':batchUpdate',
    body: { requests: [{ addSheet: { properties: { title: tab } } }] },
  })
  if (made.status === 200) return true
  /* Google answers 400 "already exists" for a tab that is already there,
     which is the state this wants, so it is not an error. */
  if (made.status === 400 && /already exists/i.test(made.text)) return true
  return why(made.status, made.text, email)
}

async function writeTab(
  spreadsheetId: string, token: string, tab: string,
  headers: readonly string[], rows: string[][], email: string,
): Promise<true | string> {
  const made = await ensureTab(spreadsheetId, token, tab, email)
  if (made !== true) return made

  const last = colLetter(headers.length)

  /* Clear only the columns these files own, so a note somebody typed in the
     column to the right of the table survives a refresh. */
  const cleared = await api(spreadsheetId, token, {
    method: 'POST', path: `/values/${tabRange(tab, `A:${last}`)}:clear`, body: {},
  })
  if (cleared.status !== 200) return why(cleared.status, cleared.text, email)

  const put = await api(spreadsheetId, token, {
    method: 'PUT',
    path: `/values/${tabRange(tab, `A1:${last}${rows.length + 1}`)}?valueInputOption=RAW`,
    body: { values: [headers as unknown as string[], ...rows] },
  })
  if (put.status !== 200) return why(put.status, put.text, email)
  return true
}

export type PushResult =
  | { ok: true; rows: number; tabs: string[]; email: string }
  | { ok: false; detail: string }

export async function pushPaymentTabs(
  db: DbHandle, showId: string, spreadsheetId: string, siteUrl: string,
): Promise<PushResult> {
  const sa = serviceAccount()
  if (!sa) {
    return {
      ok: false,
      detail: 'No Google service account on this deployment, so nothing can be '
        + 'written to a sheet. GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY '
        + 'are what the application sync already uses.',
    }
  }

  let token: string
  try {
    token = await accessToken(sa, { timeoutMs: TIMEOUT_MS })
  } catch (err) {
    return { ok: false, detail: redact(err instanceof Error ? err.message : 'Google would not issue a token.') }
  }

  const all = await paymentRows(db, showId, siteUrl)
  /* The merge file leaves out released bookings: the link still works, and
     inviting somebody to pay for a space they no longer hold is a phone call. */
  const live = all.filter((r) => r.status !== 'Released' && r.payLink !== '')

  const links = await writeTab(
    spreadsheetId, token, LINKS_TAB, LINK_COLUMNS, live.map(linkValues), sa.email,
  )
  if (links !== true) return { ok: false, detail: links }

  const payments = await writeTab(
    spreadsheetId, token, PAYMENTS_TAB, PAYMENT_COLUMNS, all.map(paymentValues), sa.email,
  )
  if (payments !== true) return { ok: false, detail: payments }

  return { ok: true, rows: all.length, tabs: [LINKS_TAB, PAYMENTS_TAB], email: sa.email }
}
