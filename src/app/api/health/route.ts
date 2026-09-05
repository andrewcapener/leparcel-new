import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    // The commonest reason a form "does not work" when the key IS set:
    // without EMAIL_FROM the sender falls back to Resend's onboarding
    // address, which Resend only delivers to the account owner. Every
    // message to anyone else fails, the outbox records it, and nothing on
    // the site says so. The domain in the address is not a secret.
    emailFrom: process.env.EMAIL_FROM ?? null,
    emailFromIsResendSandbox:
      !process.env.EMAIL_FROM || /onboarding@resend\.dev/.test(process.env.EMAIL_FROM),
    contactTo: process.env.CONTACT_TO ?? 'hello@mermademarket.com (default)',
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
  } catch (e) {
    diag.ok = false
    diag.dbError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  }
  return NextResponse.json(diag, { status: diag.ok ? 200 : 500 })
}
