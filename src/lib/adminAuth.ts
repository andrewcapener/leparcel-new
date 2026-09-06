/**
 * Interim staff auth: a password per person, an HMAC-derived session cookie,
 * verified in the proxy on every /admin request. Replaced by Supabase Auth
 * (password + TOTP per docs/02-ARCHITECTURE.md) after launch.
 *
 * ── why per person, and why it is still not an account system ────────────
 * It was one shared password, which was right while one person used the
 * admin. Three people use it now, and a shared password has a specific cost
 * that matters here: every jury decision, every acceptance and every voided
 * statement is audit-logged with an actor, and with one password the actor is
 * always the same anonymous "staff". A market whose product is curation
 * judgement should be able to say whose judgement it was.
 *
 * So: one env var per person, `ADMIN_PASS_<NAME>`, discovered at runtime. The
 * login form is unchanged, a single password box, because which person you
 * are is answered by which secret matched. Adding somebody is one variable in
 * the hosting dashboard and no deploy of ours.
 *
 * It is still not an account system. There is no per-person reset, no second
 * factor, and no revocation short of changing that person's variable. It buys
 * exactly one thing, attribution, and it buys it tonight.
 *
 * Web Crypto only, so the same code runs in edge middleware and Node.
 */

export const ADMIN_COOKIE = 'mm_admin'

/** `ADMIN_PASS_HILLARY` names Hillary. */
const PER_PERSON = /^ADMIN_PASS_([A-Z0-9_]+)$/

/**
 * The original shared password. Named for what it is rather than for a
 * person, because that is what the audit log should say when somebody used
 * it: "Staff" is honest, and a name would be a guess. Give everyone their own
 * ADMIN_PASS_<NAME> and this stops appearing.
 */
const SHARED_NAME = 'Staff'

export type Staff = { name: string; secret: string }

function clean(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Accepts either name; ADMIN_PASSWORD is canonical, ADMIN_PASS works too.
 *
 * Trimmed, because pasting a value into a hosting dashboard picks up a
 * trailing newline or space more often than anyone admits, and the symptom
 * is indistinguishable from a broken admin: the stored secret no longer
 * equals anything a human can type. Nobody means to end a password with
 * whitespace, so trimming can only help. Note it changes the HMAC key, so
 * whitespace that WAS being stored signs everyone out once.
 */
export const adminPassword = () => clean(process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASS)

/**
 * Everyone who can sign in, the shared password first so it keeps working
 * exactly as it did on a deployment that has not been given the new
 * variables. `ADMIN_PASS_HILLARY=...` adds Hillary and nothing else changes.
 */
export function staffList(): Staff[] {
  const out: Staff[] = []
  const shared = adminPassword()
  if (shared) out.push({ name: SHARED_NAME, secret: shared })

  for (const [key, value] of Object.entries(process.env)) {
    // ADMIN_PASSWORD would match ADMIN_PASS_(WORD) otherwise.
    if (key === 'ADMIN_PASSWORD') continue
    const m = PER_PERSON.exec(key)
    const secret = clean(value)
    if (!m || !secret) continue
    const name = m[1]!.toLowerCase().split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    out.push({ name, secret })
  }
  return out
}

/** Whether anybody at all can sign in. */
export function adminConfigured(): boolean {
  return staffList().length > 0
}

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

/** Constant time, because a comparison that returns early leaks the token one
 *  character at a time to anyone willing to measure. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Who this password belongs to, or null.
 *
 * Every candidate is checked even after one matches, so the work does not
 * depend on which person you are or on how many are configured.
 */
export async function staffForPassword(password: string): Promise<Staff | null> {
  let found: Staff | null = null
  for (const s of staffList()) {
    if (sameString(s.secret, password) && !found) found = s
  }
  return found
}

/** Who this cookie belongs to, or null. */
export async function staffForSession(cookieValue: string | undefined): Promise<Staff | null> {
  if (!cookieValue) return null
  let found: Staff | null = null
  for (const s of staffList()) {
    if (sameString(await sessionToken(s.secret), cookieValue) && !found) found = s
  }
  return found
}

export async function isValidSession(cookieValue: string | undefined) {
  if (!adminConfigured()) return process.env.NODE_ENV !== 'production' // never open in prod
  return (await staffForSession(cookieValue)) !== null
}
