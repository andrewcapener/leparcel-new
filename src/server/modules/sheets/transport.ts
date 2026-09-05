/**
 * How a row actually reaches the Sheet. Two transports, one interface.
 *
 * Chosen in this order, the first one configured wins:
 *
 *   1. sheets_api  — a Google service account talking to the Sheets REST API
 *                    (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY +
 *                    SHEETS_SPREADSHEET_ID). No script to maintain, the Sheet
 *                    can live anywhere, and revoking is revoking the key.
 *   2. apps_script — a POST to an Apps Script web app deployed from the Sheet
 *                    (SHEETS_WEBHOOK_URL + SHEETS_WEBHOOK_SECRET). No cloud
 *                    project, no key material, two minutes to set up.
 *   3. neither     — a silent no-op, exactly the way email behaves without
 *                    RESEND_API_KEY. Submissions are unaffected.
 *
 * Idempotency. Every row carries the application id in its last column, and
 * both transports key on it: a row whose id is already in the sheet is
 * UPDATED in place, never appended a second time. On the apps_script path the
 * receiver enforces that; on the sheets_api path the sender does, by reading
 * the id column before it writes. See the note on the residual race in
 * findRowByKey below.
 *
 * Everything returns a result instead of throwing, so no caller can lose an
 * application to an exception from Google.
 */
import { SHEET_HEADERS, sheetValues, type SheetRow } from './row'
import { accessToken, resetTokenCache, serviceAccount } from './google-auth'

export type TransportName = 'sheets_api' | 'apps_script'

export type SendResult =
  | { ok: true; action: 'appended' | 'updated' }
  | { ok: false; detail: string; retryable: boolean }

export type Transport = {
  name: TransportName
  /** What the operator has to fix if it breaks. Never a secret. */
  describe: string
  send(row: SheetRow, opts?: { timeoutMs?: number }): Promise<SendResult>
}

const DEFAULT_TIMEOUT_MS = 8_000

/* ───────────────────────── shared helpers ───────────────────────── */

/** Strip anything secret before a message is stored, printed, or served. */
export function redact(detail: string): string {
  let out = detail
  for (const v of [
    process.env.SHEETS_WEBHOOK_URL,
    process.env.SHEETS_WEBHOOK_SECRET,
    process.env.GOOGLE_PRIVATE_KEY,
    process.env.SHEETS_SPREADSHEET_ID,
  ]) {
    const t = v?.trim()
    if (t && t.length > 6) out = out.split(t).join('[redacted]')
  }
  return out
    .replace(/https:\/\/script\.google[^\s"']*/g, '[webhook url]')
    .replace(/ya29\.[\w.-]+/g, '[token]')
    // Anything from a BEGIN marker on: a truncated key fragment is still a
    // key fragment, so this deliberately does not require the END marker.
    .replace(/-----BEGIN[\s\S]*?(-----END[^-]*-----|$)/g, '[private key]')
    .slice(0, 400)
}

/** 429 and 5xx are weather; 4xx is a mistake somebody has to fix. */
const retryableStatus = (status: number) => status === 429 || status >= 500

function networkFailure(err: unknown): { ok: false; detail: string; retryable: boolean } {
  // undici hides the useful half ("ECONNREFUSED", "ENOTFOUND", "TimeoutError")
  // in .cause or .name; "fetch failed" on its own tells the team nothing.
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const code = err instanceof Error && err.cause && typeof err.cause === 'object' && 'code' in err.cause
    ? ` (${String((err.cause as { code: unknown }).code)})`
    : ''
  return { ok: false, detail: redact(`${msg}${code}`), retryable: true }
}

/* ─────────────────────── 1 · the Sheets REST API ─────────────────────── */

export type SheetsApiConfig = { spreadsheetId: string; tab: string }

export function sheetsApiConfig(): SheetsApiConfig | undefined {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID?.trim()
  if (!spreadsheetId || !serviceAccount()) return undefined
  return { spreadsheetId, tab: process.env.SHEETS_TAB?.trim() || 'Applications' }
}

/** 1 → "A", 26 → "Z", 27 → "AA". The row is 21 columns wide today. */
export function colLetter(n: number): string {
  let out = ''
  let i = n
  while (i > 0) {
    const rem = (i - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    i = Math.floor((i - 1) / 26)
  }
  return out
}

const LAST_COL = colLetter(SHEET_HEADERS.length)
const KEY_COL = LAST_COL          // the application id is the last column
const a1 = (tab: string, range: string) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'!${range}`)

/** The header row exists for the life of the process once we have seen it. */
const headerReady = new Set<string>()

type ApiCall = { method: string; path: string; body?: unknown }

async function api(
  cfg: SheetsApiConfig, token: string, call: ApiCall, timeoutMs: number,
): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}${call.path}`,
    {
      method: call.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(call.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(call.body ? { body: JSON.stringify(call.body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  const text = await res.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* an HTML error page; the text is enough */ }
  return { status: res.status, text, json }
}

function apiError(status: number, text: string): { ok: false; detail: string; retryable: boolean } {
  // 403 on a Sheet that exists is nearly always the one forgotten step: the
  // Sheet was never shared with the service account. Say so, because the raw
  // message ("The caller does not have permission") sends people to IAM.
  const hint = status === 403
    ? ' — share the Sheet with GOOGLE_SERVICE_ACCOUNT_EMAIL as an Editor'
    : status === 404
      ? ' — check SHEETS_SPREADSHEET_ID'
      : ''
  return {
    ok: false,
    detail: redact(`Sheets API HTTP ${status}: ${text.slice(0, 200)}${hint}`),
    retryable: retryableStatus(status),
  }
}

/**
 * The row number holding this application id, or 0 if it is not there yet.
 *
 * This is the sender-side half of idempotency. Sheets reads are strongly
 * consistent, so an append that committed before a timeout IS visible to the
 * next attempt and the retry updates instead of duplicating. The residual
 * race is two writers appending the same application within the same
 * few hundred milliseconds, which cannot happen here: one application syncs
 * once, and retries are serialized by its single row in sheet_syncs.
 */
async function findRowByKey(
  cfg: SheetsApiConfig, token: string, key: string, timeoutMs: number,
): Promise<{ row: number } | { ok: false; detail: string; retryable: boolean }> {
  const r = await api(cfg, token, {
    method: 'GET',
    path: `/values/${a1(cfg.tab, `${KEY_COL}2:${KEY_COL}`)}?majorDimension=COLUMNS`,
  }, timeoutMs)
  if (r.status !== 200) return apiError(r.status, r.text)
  const col = (r.json as { values?: string[][] } | null)?.values?.[0] ?? []
  const i = col.findIndex((v) => v === key)
  return { row: i === -1 ? 0 : i + 2 }   // +2: one for the header, one for 1-based
}

async function ensureHeader(
  cfg: SheetsApiConfig, token: string, timeoutMs: number,
): Promise<true | { ok: false; detail: string; retryable: boolean }> {
  const cacheKey = `${cfg.spreadsheetId}:${cfg.tab}`
  if (headerReady.has(cacheKey)) return true

  let head = await api(cfg, token, {
    method: 'GET', path: `/values/${a1(cfg.tab, 'A1:1')}`,
  }, timeoutMs)

  // A 400 here means the tab does not exist. Make it rather than fail: the
  // owner should not have to guess the spelling of SHEETS_TAB.
  if (head.status === 400) {
    const made = await api(cfg, token, {
      method: 'POST',
      path: ':batchUpdate',
      body: { requests: [{ addSheet: { properties: { title: cfg.tab } } }] },
    }, timeoutMs)
    if (made.status !== 200) return apiError(made.status, made.text)
    head = { status: 200, text: '{}', json: {} }
  }
  if (head.status !== 200) return apiError(head.status, head.text)

  const existing = (head.json as { values?: string[][] } | null)?.values?.[0] ?? []
  if (existing.length === 0 || existing[0] !== SHEET_HEADERS[0]) {
    const put = await api(cfg, token, {
      method: 'PUT',
      path: `/values/${a1(cfg.tab, `A1:${LAST_COL}1`)}?valueInputOption=RAW`,
      body: { values: [SHEET_HEADERS] },
    }, timeoutMs)
    if (put.status !== 200) return apiError(put.status, put.text)
  }
  headerReady.add(cacheKey)
  return true
}

export function sheetsApiTransport(cfg: SheetsApiConfig): Transport {
  return {
    name: 'sheets_api',
    describe: `Sheets API, tab "${cfg.tab}"`,
    async send(row, opts = {}) {
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
      const sa = serviceAccount()
      if (!sa) return { ok: false, detail: 'service account is not configured', retryable: false }

      try {
        let token = await accessToken(sa, { timeoutMs })

        const header = await ensureHeader(cfg, token, timeoutMs)
        if (header !== true) {
          // A 401 is a token that went stale mid-flight. Mint a new one once
          // before believing it.
          if (!/HTTP 401/.test(header.detail)) return header
          resetTokenCache()
          token = await accessToken(sa, { timeoutMs })
          const again = await ensureHeader(cfg, token, timeoutMs)
          if (again !== true) return again
        }

        const found = await findRowByKey(cfg, token, row.applicationId, timeoutMs)
        if ('ok' in found) return found

        // valueInputOption is RAW on purpose, twice over: it keeps "$18" and
        // "2026-09-04 18:38 PT" exactly as written, and it means a maker who
        // types "=IMPORTXML(...)" into their shop name gets a cell of text
        // rather than a formula running inside the owner's spreadsheet.
        const values = [sheetValues(row)]
        const write = found.row > 0
          ? await api(cfg, token, {
            method: 'PUT',
            path: `/values/${a1(cfg.tab, `A${found.row}:${LAST_COL}${found.row}`)}?valueInputOption=RAW`,
            body: { values },
          }, timeoutMs)
          : await api(cfg, token, {
            method: 'POST',
            path: `/values/${a1(cfg.tab, `A1:${LAST_COL}1`)}:append`
              + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
            body: { values },
          }, timeoutMs)

        if (write.status !== 200) return apiError(write.status, write.text)
        return { ok: true, action: found.row > 0 ? 'updated' : 'appended' }
      } catch (err) {
        return networkFailure(err)
      }
    },
  }
}

/* ─────────────────────── 2 · the Apps Script web app ─────────────────────── */

export function appsScriptUrl(): string | undefined {
  const url = process.env.SHEETS_WEBHOOK_URL?.trim()
  return url ? url : undefined
}

export function appsScriptTransport(url: string): Transport {
  return {
    name: 'apps_script',
    describe: 'Apps Script web app (SHEETS_WEBHOOK_URL)',
    async send(row, opts = {}) {
      const body = JSON.stringify({
        // The secret travels in the body, not a header, because an Apps Script
        // web app cannot read request headers at all — doPost sees the body and
        // the query string, and the query string is the half that ends up in
        // logs.
        secret: process.env.SHEETS_WEBHOOK_SECRET ?? '',
        headers: SHEET_HEADERS,
        values: sheetValues(row),
        /** The receiver updates the row with this id instead of appending. */
        key: row.applicationId,
      })
      try {
        const res = await fetch(url, {
          method: 'POST',
          // text/plain is what an Apps Script web app is happiest reading out
          // of e.postData.contents; the payload is still JSON.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body,
          redirect: 'follow',   // Apps Script answers 302 to googleusercontent
          signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        })
        const text = (await res.text()).slice(0, 300)
        if (!res.ok) {
          return { ok: false, detail: redact(`HTTP ${res.status}: ${text}`), retryable: retryableStatus(res.status) }
        }
        // Apps Script answers 200 with an HTML sign-in page when the deployment
        // is set to anything but "Anyone", so a 200 is not proof of anything.
        if (!/"ok"\s*:\s*true/.test(text)) {
          const wrongAccess = /accounts\.google\.com|Sign in/i.test(text)
          return {
            ok: false,
            retryable: !wrongAccess && !/bad secret/i.test(text),
            detail: redact(wrongAccess
              ? 'the web app asked for a Google sign-in — redeploy it with access "Anyone"'
              : `unexpected response: ${text}`),
          }
        }
        return { ok: true, action: /"updated"/.test(text) ? 'updated' : 'appended' }
      } catch (err) {
        return networkFailure(err)
      }
    },
  }
}

/* ─────────────────────── selection ─────────────────────── */

export function selectTransport(): Transport | undefined {
  const api = sheetsApiConfig()
  if (api) return sheetsApiTransport(api)
  const url = appsScriptUrl()
  if (url) return appsScriptTransport(url)
  return undefined
}

/** True when a Sheet is configured at all. Unset is a valid, silent state. */
export const sheetsConfigured = () => Boolean(selectTransport())

/** For /api/health: what is configured, and what is obviously missing.
 *  Names and shapes only, never a value (CLAUDE.md rule 9). */
export function transportDiagnostics() {
  const sa = serviceAccount()
  const url = appsScriptUrl()
  const chosen = selectTransport()
  return {
    transport: chosen?.name ?? null,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? null,
    hasPrivateKey: Boolean(process.env.GOOGLE_PRIVATE_KEY),
    privateKeyParses: Boolean(sa),
    hasSpreadsheetId: Boolean(process.env.SHEETS_SPREADSHEET_ID?.trim()),
    tab: process.env.SHEETS_TAB?.trim() || 'Applications',
    hasWebhookUrl: Boolean(url),
    hasWebhookSecret: Boolean(process.env.SHEETS_WEBHOOK_SECRET?.trim()),
  }
}
