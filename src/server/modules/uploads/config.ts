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
 *     (src/app/admin/jury/ApplicationCard.tsx). A public URL is a value that
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
 * The Supabase Storage configuration, or null when this deployment has none.
 *
 * SUPABASE_URL is read with the NEXT_PUBLIC_ spelling as a fallback only
 * because that is the name Supabase's own dashboard prints; the key is never
 * read from a public variable, and nothing here is bundled into the client.
 */
export function photoUploads(): PhotoUploads | null {
  const baseUrl = clean(process.env.SUPABASE_URL) || clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
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
  const missing = [
    !clean(process.env.SUPABASE_URL) && !clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
      ? 'SUPABASE_URL' : null,
    !clean(process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
  ].filter(Boolean)
  return { configured: false, missing }
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
