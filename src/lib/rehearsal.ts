/**
 * A link that lets somebody rehearse the application before it opens.
 *
 * The launch preview is a cookie, and the only way to get one was to sign in
 * at /admin and click a link there. That is right for the site-wide preview,
 * and wrong for the thing the team actually needs the night before opening:
 * four people on four phones, submitting real applications, without four of
 * them holding the staff password. The staff password is the jury queue, the
 * roster and every application in it. A rehearsal is one form.
 *
 * So this is a second, narrower key to the same door. An HMAC over an expiry,
 * minted in the admin and handed out; redeeming it sets the same preview
 * cookie and nothing else. It cannot be edited to last longer, it stops
 * working by itself, and it opens no page that /apply does not.
 *
 * Same crypto and the same fallback chain as makerAuth.ts, so a deployment
 * that can sign a maker in can mint one of these.
 *
 * ── what it is worth to somebody who should not have it ──────────────────
 * A submitted application, early. Rows are real on purpose, because a
 * rehearsal that writes to a different table is not a rehearsal. The window
 * it opens is short and it is moot the moment applications open for
 * everybody, so the exposure is one evening. Rotate the staff password to
 * invalidate every outstanding link at once.
 */

/** Long enough to hand round a team over an evening, short enough that it is
 *  spent well before it could matter. Capped again at mint time by the
 *  moment applications open, after which it means nothing anyway. */
export const REHEARSAL_TTL_MS = 18 * 60 * 60 * 1000

function secret(): string | undefined {
  const raw = process.env.MAKER_AUTH_SECRET
    ?? process.env.ADMIN_PASSWORD
    ?? process.env.ADMIN_PASS
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export function rehearsalConfigured(): boolean {
  return secret() !== undefined
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

/**
 * `<expiry>.<hmac>`. The expiry is in the message, so moving it invalidates
 * the signature, and it is readable, so the admin can print when the link
 * dies without keeping a record of what it minted.
 */
export async function signRehearsalToken(expiresAt: number): Promise<string> {
  const exp = String(Math.floor(expiresAt))
  return `${exp}.${await hmac(exp)}`
}

export type RehearsalCheck =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: 'unconfigured' | 'malformed' | 'expired' | 'bad signature' }

export async function checkRehearsalToken(token: string): Promise<RehearsalCheck> {
  if (!secret()) return { ok: false, reason: 'unconfigured' }
  const cut = token.lastIndexOf('.')
  if (cut < 1) return { ok: false, reason: 'malformed' }

  const exp = token.slice(0, cut)
  const sig = token.slice(cut + 1)
  const expiresAt = Number(exp)
  if (!/^\d+$/.test(exp) || !Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' }

  // Signature before expiry, so a forged token is rejected as forged rather
  // than being told its expiry was the problem.
  if (!sameString(await hmac(exp), sig)) return { ok: false, reason: 'bad signature' }
  if (Date.now() > expiresAt) return { ok: false, reason: 'expired' }
  return { ok: true, expiresAt }
}
