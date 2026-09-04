/**
 * Interim staff auth: one shared password (ADMIN_PASSWORD env), an HMAC-derived
 * session cookie, verified in middleware on every /admin request. Replaced by
 * Supabase Auth (password + TOTP per docs/02-ARCHITECTURE.md) after launch.
 * Changing the password signs everyone out.
 *
 * Web Crypto only, so the same code runs in edge middleware and Node.
 */

export const ADMIN_COOKIE = 'mm_admin'

/** Accepts either name; ADMIN_PASSWORD is canonical, ADMIN_PASS works too. */
export const adminPassword = () => process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASS

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sessionToken(password: string) {
  return hmacHex(password, 'mermade-admin-session-v1')
}

export async function isValidSession(cookieValue: string | undefined) {
  const password = adminPassword()
  if (!password) return process.env.NODE_ENV !== 'production' // never open in prod
  if (!cookieValue) return false
  const expected = await sessionToken(password)
  if (cookieValue.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
