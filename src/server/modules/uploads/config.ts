/**
 * Where application photographs live, and whether they live anywhere at all.
 *
 * ───────────────────────── public bucket, and why ─────────────────────────
 *
 * CLAUDE.md rule 9 puts W-9s, seller's permits and IDs in PRIVATE buckets
 * behind short-TTL signed URLs. That rule is about identity documents, and it
 * stands: those go in `vendor-documents`, they are not this bucket, and they
 * are not this piece of work.
 *
 * Application photographs are a different object. They are the maker's own
 * promotional work, the same images that are already on the Instagram account
 * the form asks for and that the jury is told to go and look at. Nothing in
 * them is personal data we would be holding on someone's behalf.
 *
 * So this bucket is PUBLIC, with unguessable keys, for three reasons:
 *
 *  1. The jury queue is a contact sheet. One pass over a full season is a
 *     hundred cards and roughly four hundred images. Signed URLs expire, so
 *     every render has to mint four hundred of them, and a URL that is
 *     different on every request is a URL no CDN and no browser can cache.
 *     The queue would feel broken in exactly the way that makes a juror stop
 *     using it.
 *  2. The admin renders `photos[0]` straight into an `<img src>`
 *     (src/app/admin/jury/, and the review screen). A public URL is a value that
 *     stays true for as long as the row does. A signed one is true for an
 *     hour, which is a trap for every screen, export and email that later
 *     wants to show the work.
 *  3. Reads are public; the bucket's listing is not. Keys are
 *     `applications/{show}/{uuid}/{uuid}.{ext}` with no name, no email and
 *     no client filename in them, so there is nothing to enumerate and
 *     nothing to guess. The bucket's write policy stays closed: uploads only
 *     happen through a signed URL this server mints.
 *
 * If that call is ever revisited, the change is small and it is here: make
 * the bucket private, swap publicPhotoUrl for a signed read, and give the
 * admin a helper to sign a page of the queue at a time.
 *
 * ─────────────────────────── not configured ───────────────────────────
 *
 * Local development has no Supabase, and a missing environment variable must
 * never be a crash or a broken form. With nothing set, `photoUploads()`
 * returns null, the field explains that uploads are unavailable, and the form
 * falls back to the email address it used before. Same shape as mail without
 * RESEND_API_KEY and the Sheet without a service account.
 */

export type PhotoUploads = {
  /** Project URL, no trailing slash. e.g. https://abcd.supabase.co */
  baseUrl: string
  /** Storage bucket name. */
  bucket: string
  /** Service role key. Server only. Never returned to a browser, never logged. */
  serviceKey: string
}

const DEFAULT_BUCKET = 'application-photos'

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/**
 * The project URL, worked out from the database connection string.
 *
 * A Supabase DATABASE_URL already names the project, in one of two shapes:
 *
 *   postgresql://postgres:PW@db.<ref>.supabase.co:5432/postgres
 *   postgresql://postgres.<ref>:PW@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * and the project URL is always https://<ref>.supabase.co. Deriving it means
 * turning uploads on takes one secret rather than two, which matters because
 * the one that was missing was never the secret: SUPABASE_URL is public
 * information that still had to be found, copied and pasted correctly before
 * a photograph could go anywhere.
 *
 * An explicit SUPABASE_URL always wins. This only fills the gap, and only for
 * a connection string that is recognisably Supabase; anything else returns
 * empty and uploads stay off, which is the same honest state as before.
 */
function supabaseUrlFromDatabaseUrl(): string {
  const raw = clean(process.env.DATABASE_URL)
  if (!raw) return ''
  let url: URL
  try { url = new URL(raw) } catch { return '' }

  // Pooler: the project ref is the part of the username after the dot.
  if (url.hostname.endsWith('.pooler.supabase.com')) {
    const ref = decodeURIComponent(url.username).split('.')[1] ?? ''
    return /^[a-z0-9]{16,}$/.test(ref) ? `https://${ref}.supabase.co` : ''
  }
  // Direct: db.<ref>.supabase.co
  const direct = url.hostname.match(/^db\.([a-z0-9]{16,})\.supabase\.co$/)
  return direct ? `https://${direct[1]}.supabase.co` : ''
}

/**
 * The Supabase Storage configuration, or null when this deployment has none.
 *
 * SUPABASE_URL is read with the NEXT_PUBLIC_ spelling as a fallback only
 * because that is the name Supabase's own dashboard prints; the key is never
 * read from a public variable, and nothing here is bundled into the client.
 */
export function photoUploads(): PhotoUploads | null {
  const baseUrl = clean(process.env.SUPABASE_URL)
    || clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
    || supabaseUrlFromDatabaseUrl()
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!baseUrl || !serviceKey) return null
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    bucket: clean(process.env.SUPABASE_PHOTOS_BUCKET) || DEFAULT_BUCKET,
    serviceKey,
  }
}

export function photoUploadsEnabled(): boolean {
  return photoUploads() !== null
}

/**
 * What an operator needs to see at /api/health when uploads are not working.
 * Names and shapes only: the bucket and the project host are not secrets, the
 * service key is, and it never appears here in any form.
 */
export function photoUploadDiagnostics(): Record<string, unknown> {
  const cfg = photoUploads()
  if (cfg) {
    return { configured: true, bucket: cfg.bucket, host: new URL(cfg.baseUrl).host }
  }
  const derived = supabaseUrlFromDatabaseUrl()
  const missing = [
    !clean(process.env.SUPABASE_URL) && !clean(process.env.NEXT_PUBLIC_SUPABASE_URL) && !derived
      ? 'SUPABASE_URL' : null,
    !clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
  ].filter(Boolean)
  // Say when the URL came from DATABASE_URL, so an operator reading this knows
  // the one remaining variable really is the only one left to set.
  return { configured: false, missing, urlDerivedFromDatabaseUrl: Boolean(derived) }
}

/**
 * Strip anything secret out of a message before it is stored, printed or
 * served. Same idea as the Sheets transport's redact().
 */
export function redactUpload(detail: string): string {
  let out = detail
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (key.length > 6) out = out.split(key).join('[redacted]')
  return out.replace(/token=[\w.\-]+/g, 'token=[redacted]')
}
