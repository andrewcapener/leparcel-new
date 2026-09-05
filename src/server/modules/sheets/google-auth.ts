/**
 * A Google access token from a service account, with no dependencies.
 *
 * googleapis is ~50MB of client for what is, here, one signed JWT and one
 * token exchange. This is that, in about eighty lines, with node:crypto doing
 * the RS256 signature.
 *
 * The owner's setup is in README.md. The step everybody forgets is the last
 * one: the Sheet has to be SHARED with the service account's email as an
 * editor, or every append comes back 403 with a "caller does not have
 * permission" that looks like a credentials problem and is not.
 *
 * Nothing here is ever logged. The private key, the assertion and the access
 * token stay inside this module (CLAUDE.md rule 9).
 */
import { createSign } from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
/** Refresh this long before Google's expiry, so a token never dies mid-flight. */
const REFRESH_MARGIN_MS = 120_000

export type ServiceAccount = { email: string; privateKey: string }

/**
 * Vercel's env editor stores a pasted key either with real newlines or with
 * the two characters backslash-n, and a copy out of the JSON file usually
 * arrives wrapped in quotes. All three shapes have to work, because the owner
 * pastes it once and the failure mode is an opaque "error:1E08010C" from
 * OpenSSL an hour later.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\n/g, '\n').trim()
}

export function serviceAccount(): ServiceAccount | undefined {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const raw = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !raw) return undefined
  const privateKey = normalizePrivateKey(raw)
  if (!privateKey.includes('BEGIN')) return undefined
  return { email, privateKey }
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** A signed JWT bearer assertion, per Google's OAuth 2.0 service-account flow. */
export function signAssertion(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  return `${header}.${claims}.${b64url(signer.sign(sa.privateKey))}`
}

/** One token per process, reused until it is nearly expired. */
let cached: { token: string; expiresAt: number; email: string } | undefined

/** Exposed for the retry path and tests: forget the cached token. */
export function resetTokenCache(): void {
  cached = undefined
}

export async function accessToken(
  sa: ServiceAccount,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  const now = Date.now()
  if (cached && cached.email === sa.email && cached.expiresAt - REFRESH_MARGIN_MS > now) {
    return cached.token
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signAssertion(sa),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  })
  const text = await res.text()
  if (!res.ok) {
    // Google's token errors name the cause ("invalid_grant" is a clock skew or
    // a wrong key; "unauthorized_client" is domain-wide delegation). Pass the
    // short form through; it carries no personal data and no credential.
    throw new Error(`token exchange failed: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  const json = JSON.parse(text) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new Error('token exchange returned no access_token')
  cached = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
    email: sa.email,
  }
  return cached.token
}
