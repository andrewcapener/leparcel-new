# CLAUDE.md — Mermade Market Platform

You are building the Mermade Market platform: a custom replacement for the business's Shopify site, plus a vendor application/jury pipeline, an onboarding compliance system, an event-day point of sale, and an automated commission/payout system.

**Read `docs/` before writing code.** In order:
1. `docs/00-BUSINESS-AUDIT.md` — what the business is and what's broken. Context for every decision below.
2. `docs/01-PRODUCT-SPEC.md` — what to build, module by module.
3. `docs/02-ARCHITECTURE.md` — the stack, repo layout, and the non-negotiable engineering rules.
4. `docs/03-DATA-MODEL.md` — the schema. Translate to Drizzle; don't redesign it.
5. `docs/04-PAYMENTS-AND-POS.md` — Stripe Connect, Terminal, tax, fees, gotchas.
6. `docs/05-BUILD-PLAN.md` — phase order and hard deadlines.
7. `docs/06-OPEN-QUESTIONS.md` — what's still undecided. **Do not guess at these; flag them.**
8. `docs/08-DESIGN-SYSTEM.md` — the locked design system: type, color tokens, the film pipeline, layout rules. **Build against these tokens; don't invent values.** Marks are in `brand/`.
9. `docs/09-CONTENT-AUDIT.md` — what every homepage block is for, which of the four business jobs it serves, and the page order. **The homepage is ordered for shoppers; depth lives on sub-pages.** Never publish an unsourced number.
10. `docs/10-VENDOR-AGREEMENT.md` — the vendor agreement: Part I common terms, Schedule A (indoor consignment), Schedule B (outdoor booth licence). Carries ⟨DECISION⟩ and ⟨COUNSEL⟩ markers and a status table. **Unreviewed by an attorney — do not treat any clause as settled, and don't wire policy from it that contradicts the Show record.**
11. `docs/11-AGREEMENT-RESEARCH.md` — clause-by-clause source quotes from other major craft fairs plus the California statutes, with URLs. Read only if you need to know *why* a clause reads the way it does.
12. `docs/12-VOICE.md` — how Mermade sounds in any rendered copy: concise, warm through specifics, community implied and never stated, **no em dashes in prose**. Run every user-facing string you write past it.

---

## The business in five lines

- A curated artisan market in Dana Point, CA. Two shows a year. ~100 vendors. Free to attend.
- **Indoor vendors** are consignment: Mermade merchandises their goods, sells them at a **central register**, takes **20%**, and pays out after the show. Vendors are not present.
- **Outdoor vendors** rent a tent for a day, run their own payments, and pay **0% commission**.
- These two tracks share a brand and an application form and nothing else. **Model them separately.**
- The current site is Shopify with **zero products** — a brochure site with a contact form. There is nothing to migrate but 13 pages and 18 blog posts.

## The hard deadline

**Applications open September 7, 2026** — confirmed by Drew, no longer in doubt. The draft close date is **September 18** (mirrors Spring's 11-day window) and is still unconfirmed. The show is **November 12–15, 2026**. Phase 1 (public site + application + jury + acceptance + payment) must be live before applications open. Everything else has until November.

Both dates live on the Show record and are edited at `/admin/show`. Never hardcode either one.

---

## Non-negotiable rules

1. **Money is `integer` cents. Never a float.** All arithmetic goes through `src/lib/money.ts`.
2. **Commission and statement math lives in pure, unit-tested functions** in `src/server/modules/statements/`. Never inline it in a route or component. Property-test that `commission + net + deductions === gross`, exactly, for randomized inputs. Rounding goes to the house, never against the vendor.
3. **Every financial mutation is audit-logged** — actor, timestamp, before/after, reason. Statements and payouts are voided and superseded, never deleted.
4. **All Stripe writes are idempotent.** Stable keys, e.g. `payout:{statement_id}:v{version}`. A double-click must never double-pay.
5. **Stripe webhooks are the source of truth for payment state.** Never mark anything paid from a client callback. Verify the signature, persist the event ID in `stripe_events`, process exactly once.
6. **Everything is scoped to a `show_id`.** No hardcoded dates, prices, capacities, or commission rates anywhere in the codebase — they live on the Show record and are editable in `/admin/shows/[id]`. `bookings.commission_bps` is snapshotted at booking time and is immutable.
7. **The POS never blocks on the network.** Local reads from IndexedDB, optimistic writes, queued sync. The tablet mints `client_uuid` before the sale exists server-side; the server upserts on `(show_id, client_uuid)` so replaying a queue is a no-op.
8. **Timezone is `America/Los_Angeles`.** Store UTC, render Pacific. Application deadlines are "11:59pm PT" and that has broken every event system ever built.
9. **PII — W-9s, seller's permits, IDs — goes in private Supabase buckets** with short-TTL signed URLs. Never logged, never in an error message, never in a public bucket.
10. **Business logic lives in `src/server/modules/*`**, as pure functions taking a `db` handle. Route handlers and Server Actions are thin.
11. **Migrations are forward-only.** Never edit a shipped migration.
12. **Row Level Security on every vendor-scoped table.** A vendor reads only their own rows, enforced at the database.

---

## Stack (already decided — build against it, don't relitigate)

Next.js App Router (the prototype in this repo runs **16.3.2**) / TypeScript strict · Postgres via Supabase · Drizzle ORM · Supabase Auth (magic link for vendors, password + TOTP for staff) · Supabase Storage · Stripe Connect Express + Terminal + Tax · Resend + React Email · Vercel · Tailwind + shadcn/ui · react-hook-form + Zod · TanStack Table · Recharts · Inngest for jobs · Dexie for POS offline · Sentry · Vitest + Playwright.

Full rationale and rejected alternatives in `docs/02-ARCHITECTURE.md` §1.

---

## Working style

- **Ship vertical slices.** A working apply→jury→accept→pay path beats four half-built modules.
- **Seed realistic data first.** 30 fake applicants with real-looking photos, a full show config, and a floor plan. Everything is easier to build and demo against real-shaped data.
- **Preview deploys per PR.** The team reviews on a URL, not on your machine.
- **When a spec detail is missing, check `docs/06-OPEN-QUESTIONS.md` first.** If it's there, it's a known unknown — build behind a config flag with a sensible default and flag it in the PR. Don't invent business policy.
- **Tests where money moves.** Commission math, statement math, tax math, payout idempotency, offline replay. Elsewhere, use judgment.
- **Accessibility is WCAG 2.2 AA.** This business may be sold; accessibility findings are diligence findings.

## What this repo already is, and what it is not

This is a **working vertical slice on Postgres**, not yet the full production app. Treat it as a
reference implementation of the parts it covers and as a spec for the parts it doesn't.

**Built and working** — public home page, `/apply` (with server-side Zod validation that
echoes values back on rejection), `/admin/jury`, `/admin/roster`, `/admin/show`,
`/admin/outbox`, the `MM##` code assignment, immutable `commission_bps` snapshotting,
the money library with a 200,000-case property test, and the full design system in
`src/app/globals.css`.

**Deliberately stubbed** — no Stripe, no file uploads, no RLS, and no POS. Auth on
`/admin` is an interim shared password (`ADMIN_PASSWORD` + signed cookie in
`src/proxy.ts`), to be replaced by Supabase Auth. Email delivers through Resend when
`RESEND_API_KEY` is set and is always recorded in the outbox table.

**Known gaps in the prototype schema, already specified in `docs/03-DATA-MODEL.md`** —
booth **add-ons** (share $100, endcap $40 indoor / $60 outdoor, tent rental $100) exist
in the data model as `booking_addons` and `bookings.addons_cents`, but the prototype's
Drizzle schema and seed don't carry them yet, and the vendor agreement's fee schedule
doesn't price them. Close all three together.

**The database is Postgres** (Supabase in production, any Postgres via `DATABASE_URL`
locally). The SQLite era is over; see README for env vars and seeding modes.

---

## What not to build

Explicitly out of scope for v1 — do not let these creep in: year-round online storefront, vendor-to-vendor messaging, native mobile apps, multi-market/white-label, attendee accounts or loyalty, ticketing, and **any form of automated or AI-assisted jurying**. The curation judgment is the product; the tool exists to make a human faster, not to replace them.
