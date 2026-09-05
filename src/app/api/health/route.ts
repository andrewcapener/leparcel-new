import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { transportDiagnostics } from '@/server/modules/sheets/transport'
import { photoUploadDiagnostics } from '@/server/modules/uploads/config'
import { isCanonicalHost, siteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export async function GET() {
  const diag: Record<string, unknown> = {
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    lastRequestError: (globalThis as Record<string, unknown>).__lastRequestError ?? null,
    // Names only, never values: which non-platform env vars this deployment
    // actually carries, so a typo'd or wrongly-scoped variable is visible.
    envNames: Object.keys(process.env)
      .filter((k) => !/^(VERCEL|NEXT_|NODE|AWS_|TURBO|PATH$|PWD$|HOME$|HOSTNAME$|PORT$|LANG|SHLVL|_)/.test(k))
      .sort(),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASS),
    // Shape only, never the value: enough to tell "the stored secret is not
    // what you think it is" from "the admin is broken", without printing a
    // password into a public endpoint.
    adminPassword: (() => {
      const raw = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PASS
      if (!raw) return null
      return {
        length: raw.trim().length,
        hadSurroundingWhitespace: raw !== raw.trim(),
        variable: process.env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD' : 'ADMIN_PASS',
      }
    })(),
    // The one switch that has to be thrown at cutover. Until SITE_URL names
    // the real domain, every canonical URL points at the Vercel host and the
    // site is noindex so that host never competes with mermademarket.com.
    // Setting it fixes the URLs and opens the site to crawlers together.
    site: {
      url: siteUrl(),
      isCanonicalHost: isCanonicalHost(),
      indexable: isCanonicalHost(),
      cutoverStep: isCanonicalHost()
        ? null
        : 'Set SITE_URL=https://mermademarket.com in Vercel and redeploy when the domain points here.',
    },
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    // The sender now defaults to hello@mermademarket.com rather than Resend's
    // onboarding sandbox, which only ever delivered to the Resend account
    // owner. What is left to check is on Resend's side: the domain has to be
    // verified there or every send fails, the outbox records it, and nothing
    // on the site says so. The domain in the address is not a secret.
    emailFrom: process.env.EMAIL_FROM ?? 'Mermade Market <hello@mermademarket.com> (default)',
    emailFromIsResendSandbox:
      /onboarding@resend\.dev/.test(process.env.EMAIL_FROM ?? ''),
    contactTo: process.env.CONTACT_TO ?? 'hello@mermademarket.com (default)',
    // Which Google Sheets transport this deployment would use, and which
    // piece is missing if it is none. Names and shapes only, never the key,
    // the secret, the webhook URL or the spreadsheet id. A 403 on append is
    // nearly always the forgotten step: the Sheet was never shared with
    // serviceAccountEmail as an Editor.
    sheets: transportDiagnostics(),
    // Whether the application form can take a photograph at all, and which
    // variable is missing if it cannot. The bucket name and the project host
    // are not secrets; the service key never appears here in any form.
    photos: photoUploadDiagnostics(),
  }
  try {
    const { db, schema } = await import('@/db')
    const count = async (t: typeof schema.shows | typeof schema.applications | typeof schema.bookings) =>
      Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0]!.n)
    diag.shows = await count(schema.shows)
    diag.applications = await count(schema.applications)
    diag.bookings = await count(schema.bookings)
    // Delivery, at a glance. Counts only, no addresses and no bodies.
    const rows = await db
      .select({ status: schema.emailOutbox.deliveryStatus, n: sql<number>`count(*)` })
      .from(schema.emailOutbox)
      .groupBy(schema.emailOutbox.deliveryStatus)
    diag.email = Object.fromEntries(rows.map((r) => [r.status ?? 'logged_only', Number(r.n)]))
    // The most recent failure's reason, which is what actually tells you what
    // to fix. Resend's errors name the problem and carry no personal data.
    const [lastFail] = await db
      .select({ detail: schema.emailOutbox.deliveryDetail, at: schema.emailOutbox.sentAt })
      .from(schema.emailOutbox)
      .where(sql`${schema.emailOutbox.deliveryStatus} = 'failed'`)
      .orderBy(sql`${schema.emailOutbox.sentAt} desc`)
      .limit(1)
    diag.lastEmailFailure = lastFail ? { at: lastFail.at, detail: lastFail.detail } : null
    // The same two facts for the Sheet: how many applications it is still
    // missing, and why the last one did not land. `pending` is queued and
    // will be retried; `failed` has given up and needs a person. Either is
    // fixed with `npx tsx scripts/sync-sheets.ts`. Counts and reasons only.
    const { syncDiagnostics } = await import('@/server/modules/sheets/state')
    const sheetSync = await syncDiagnostics(db)
    diag.sheetSync = sheetSync.counts
    diag.sheetSyncUnsent = sheetSync.pending + sheetSync.failed
    diag.lastSheetSyncFailure = sheetSync.lastFailure
  } catch (e) {
    diag.ok = false
    diag.dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return NextResponse.json(diag, { status: diag.ok ? 200 : 500 })
}
