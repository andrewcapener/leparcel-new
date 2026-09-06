/**
 * Magic-link sign-in for makers.
 *
 * A maker never picks a password. They type the address they applied with, we
 * email a link, and clicking it signs them in. The address is the account:
 * `vendors.email` is already unique and already the thing every email from us
 * goes to, so there is nothing new for a maker to remember or lose.
 *
 * INTERIM, like the staff gate in adminAuth.ts. docs/02-ARCHITECTURE.md puts
 * vendors on Supabase Auth magic links; that needs the Supabase dashboard and
 * a user record per maker, and this needs neither. The shape is the same from
 * outside, so replacing it later changes these two files and nothing else.
 *
 * Web Crypto only, so the same code runs in edge middleware and in Node.
 *
 * ── what a link can and cannot do ────────────────────────────────────────
 * A link is an HMAC over the address and an expiry, so it cannot be edited to
 * name a different maker and it stops working by itself. It is NOT single use:
 * within its twenty minutes it can be clicked more than once, which is a real
 * property of the design and is why the window is short. Making it single use
 * means storing an issued nonce, which is a table, and the thing behind the
 * door is a maker's own application. Worth revisiting when the portal carries
 * payment.
 */

export const MAKER_COOKIE = 'mm_maker'

/** Twenty minutes. Long enough to walk to a laptop, short enough that a
 *  forwarded email is not an account. */
export const LINK_TTL_MS = 20 * 60_000

/** Thirty days. Re-sign-in is one email, so this does not need to be a year. */
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60

/**
 * The signing key.
 *
 * MAKER_AUTH_SECRET is the one to set. Falling back to the staff password
 * means sign-in works on a deployment that has not been given a new variable,
 * which is the difference between the portal working today and waiting on a
 * dashboard visit, and the fallback is a secret that is already required in
 * production. The cost is that changing the staff password signs every maker
 * out too, so set the dedicated one when you get a moment.
 */
function secret(): string | undefined {
  const raw = process.env.MAKER_AUTH_SECRET
    ?? process.env.ADMIN_PASSWORD
    ?? process.env.ADMIN_PASS
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export function makerAuthConfigured(): boolean {
  return secret() !== undefined
}

/** An address is the account, so it is compared in one canonical shape. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret() ?? ''),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return b64url(new Uint8Array(sig))
}

/** Constant time, because a comparison that returns early leaks the signature
 *  one character at a time to anyone willing to measure. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/* ─────────────────────────── the emailed link ─────────────────────────── */

/** `<email>.<expiry>.<signature>`, url safe. */
export async function signLinkToken(email: string, now = Date.now()): Promise<string> {
  const e = normalizeEmail(email)
  const expiry = String(now + LINK_TTL_MS)
  const body = `${b64url(new TextEncoder().encode(e))}.${expiry}`
  return `${body}.${await hmac(`link:${body}`)}`
}

/** The address the token names, or undefined if it is not ours or has run out. */
export async function readLinkToken(token: string, now = Date.now()): Promise<string | undefined> {
  if (!secret()) return undefined
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  const [rawEmail, expiry, sig] = parts as [string, string, string]
  if (!sameString(sig, await hmac(`link:${rawEmail}.${expiry}`))) return undefined
  const ms = Number(expiry)
  if (!Number.isFinite(ms) || now > ms) return undefined
  try {
    const pad = rawEmail.replace(/-/g, '+').replace(/_/g, '/')
    const email = new TextDecoder().decode(
      Uint8Array.from(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)), (c) => c.charCodeAt(0)),
    )
    return normalizeEmail(email)
  } catch {
    return undefined
  }
}

/* ───────────────────────────── the session ───────────────────────────── */

/** `<email>.<signature>`. No expiry inside it: the cookie's own Max-Age is the
 *  session length, and a stolen cookie is not made safer by a second clock. */
export async function signSession(email: string): Promise<string> {
  const e = normalizeEmail(email)
  const body = b64url(new TextEncoder().encode(e))
  return `${body}.${await hmac(`session:${body}`)}`
}

export async function readSession(cookie: string | undefined): Promise<string | undefined> {
  if (!cookie || !secret()) return undefined
  const parts = cookie.split('.')
  if (parts.length !== 2) return undefined
  const [body, sig] = parts as [string, string]
  if (!sameString(sig, await hmac(`session:${body}`))) return undefined
  try {
    const pad = body.replace(/-/g, '+').replace(/_/g, '/')
    return normalizeEmail(new TextDecoder().decode(
      Uint8Array.from(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)), (c) => c.charCodeAt(0)),
    ))
  } catch {
    return undefined
  }
}
