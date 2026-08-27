# Architecture & Stack

**Decision posture:** these are picked, not proposed. Where a real alternative exists I name it and say why it lost, so you can overrule with your eyes open — but Claude Code should build against the picks without re-litigating them.

---

## 1. The stack

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| **Framework** | **Next.js 15+, App Router, TypeScript strict** | One codebase covers the static marketing site, the vendor portal, the admin, the POS PWA, and the API. Server Components keep the public site fast and the admin data-dense without a separate API tier. Alternative: Remix — fine, smaller ecosystem, no reason to pay that tax. |
| **Database** | **Postgres (Supabase)** | Relational, transactional, and the money math demands both. Supabase bundles Postgres + Auth + Storage + Realtime, which removes three vendor integrations from the critical path in a 3-week timeline. Alternative: Neon + Clerk + S3 — better long-run separation, more moving parts now. |
| **ORM / migrations** | **Drizzle ORM + drizzle-kit** | SQL-shaped, type-safe, fast migrations, no query-engine binary. Alternative: Prisma — heavier, and its migration story fights you on hot-fix days. |
| **Auth** | **Supabase Auth.** Vendors: magic link. Staff: email+password **with TOTP required**. | Magic link is the right call for vendors who log in twice a year and will absolutely forget a password. Staff get MFA because they can move money. |
| **File storage** | **Supabase Storage**, private buckets + signed URLs | COIs, W-9s, permits, and product photos. W-9s and permits are PII — private bucket, signed URLs with short TTL, never public. |
| **Payments** | **Stripe.** Connect (Express), Payment Intents, Terminal, Tax, Connect 1099 | See `04-PAYMENTS-AND-POS.md`. Nothing else supports multi-vendor split + org-controlled payout timing + card-present natively. |
| **Email** | **Resend + React Email** | Templates as components, previewable in-repo, good deliverability. Requires SPF/DKIM/DMARC on a subdomain (`mail.mermademarket.com`). |
| **SMS** (Phase 3) | **Twilio** | — |
| **Hosting** | **Vercel** (Pro) | Zero-config for the framework, preview deploys per PR (this is how the team gets a Friday preview), edge caching for the static site. |
| **UI** | **Tailwind CSS + shadcn/ui**, custom design tokens | Own the components in-repo. No dependency on someone else's design system. |
| **Forms** | **react-hook-form + Zod**, schemas shared client/server | One schema validates the browser and the API route. Never validate twice by hand. |
| **Tables/data grid** | **TanStack Table** | The jury board and the compliance matrix need real sorting/filtering/virtualization. |
| **Charts** | **Recharts** | Live sales dashboard. |
| **Background jobs** | **Inngest** | Reminder cascades, statement generation, payout batches, webhook retries, scheduled reports. Durable, replayable, and you can *see* a failed run — which matters when the failed run is a payout. Alternative: Vercel Cron + a queue table — cheaper, worse observability. |
| **Barcodes** | `bwip-js` (Code128 render) + **React PDF** or `pdf-lib` for label sheets | Server-generated PDFs, Avery-grid aligned. |
| **CSV** | `papaparse` in, `csv-stringify` out | — |
| **Offline POS storage** | **IndexedDB via Dexie.js** | Catalog cache + outbound sale queue. |
| **Errors / monitoring** | **Sentry** + Vercel Analytics + Better Stack uptime | Money-handling software gets alerting on day one, not month three. |
| **Testing** | **Vitest** (unit — commission math, statement math, tax math), **Playwright** (E2E — apply→accept→pay, scan→sell→statement→payout) | The two E2E flows above are the only ones that must never break. |
| **Feature flags** | A simple DB-backed `feature_flags` table | Ship the POS dark, enable per-show. |

### What I deliberately did *not* choose

- **A headless CMS** (Sanity/Contentful/Payload). See `01-PRODUCT-SPEC.md` §9 — Elise needs twelve structured settings, not a page builder. Adding a CMS means a second content model, a second auth system, and a whole class of "she published a broken page" incidents. If you later want genuinely free-form pages, **Payload 3** embeds in this same Next.js app on the same Postgres and can be added without a rewrite. That's the escape hatch; don't take it in v1.
- **Shopify Headless / Hydrogen.** Keeping Shopify as a backend keeps the subscription, the platform lock-in, and the reason you're doing this. There is no catalog to preserve — zero products.
- **Square.** Better out-of-box POS hardware experience, but no marketplace payout primitive for independent 1099 vendors with their own bank accounts. You'd end up building the ledger anyway *and* running two payment vendors. See `04` §5.
- **A separate backend service** (Nest/Fastify/Go). Nothing here justifies the operational split.

---

## 2. Repository layout

Single Next.js app, feature-first modules. Monorepo is unnecessary at this size.

```
mermade/
├── CLAUDE.md                        # read this first
├── docs/                            # this spec package, checked in
├── drizzle/                         # migrations (committed, never edited by hand)
├── src/
│   ├── app/
│   │   ├── (site)/                  # public marketing — static, revalidated
│   │   │   ├── page.tsx
│   │   │   ├── apply/
│   │   │   ├── merchants/[show]/
│   │   │   ├── lookbook/[track]/
│   │   │   ├── schedule/ faq/ sponsors/ contact/
│   │   │   └── journal/[slug]/
│   │   ├── (portal)/portal/         # vendor — auth required
│   │   │   ├── application/ checklist/ inventory/ labels/
│   │   │   ├── sales/ statement/ payouts/ settings/
│   │   ├── (admin)/admin/           # staff — auth + role
│   │   │   ├── shows/[id]/          # THE show settings screen
│   │   │   ├── applications/        # jury board + card view
│   │   │   ├── vendors/ bookings/ compliance/ inventory/
│   │   │   ├── floor/               # layout & space assignment
│   │   │   ├── live/                # show-day dashboard
│   │   │   ├── statements/ payouts/ reports/
│   │   │   └── content/             # blocks, journal, media, emails
│   │   ├── (pos)/pos/               # register PWA
│   │   └── api/
│   │       ├── webhooks/stripe/
│   │       ├── pos/sync/            # batched offline flush
│   │       └── trpc/ or route handlers
│   ├── server/
│   │   ├── db/                      # schema.ts, client, seed
│   │   ├── modules/                 # ← the business logic lives here
│   │   │   ├── shows/ applications/ jury/ bookings/
│   │   │   ├── vendors/ compliance/ inventory/ labels/
│   │   │   ├── sales/ statements/ payouts/
│   │   │   ├── content/ notifications/ reports/
│   │   ├── stripe/                  # connect.ts terminal.ts webhooks.ts tax.ts
│   │   └── jobs/                    # inngest functions
│   ├── components/  ui/ site/ admin/ portal/ pos/
│   ├── lib/                         # money.ts dates.ts barcode.ts csv.ts
│   └── emails/                      # react-email templates
├── e2e/                             # playwright
└── scripts/                         # migrate-shopify-journal.ts, seed-demo.ts
```

**Rule:** business logic goes in `src/server/modules/*`, never in a route handler or a component. Every module exposes pure functions that take a `db` handle. That's what makes the money math unit-testable, and the money math is the part that must be right.

---

## 3. Non-negotiable engineering rules

These exist because this system moves other people's money.

1. **All money is `integer` cents. Never a float. Never.** A `money.ts` module with `Money` helpers; no arithmetic on raw numbers outside it.
2. **All commission and statement math is pure, unit-tested, and never inlined in a component or route.** Property-test the rounding: sum of vendor nets + commission + deductions must equal gross, exactly, for randomized inputs.
3. **Every financial mutation is append-only and audit-logged**: actor, timestamp, before/after, reason. Statements and payouts are never hard-deleted — they're voided and superseded.
4. **All Stripe writes are idempotent** with a stable `Idempotency-Key` (e.g. `payout:{statement_id}:{version}`). A double-click must never double-pay.
5. **Stripe webhooks are the source of truth for payment state.** Never mark a booking paid from a client-side success callback. Verify signature, persist the event ID, process exactly once.
6. **Everything is scoped to a `show_id`.** No dates, prices, or capacities hardcoded anywhere in the codebase — they live on the Show record. This is what makes the whole thing reusable next season instead of a rebuild.
7. **The POS never blocks on the network.** Local reads, optimistic writes, queued sync. Assume the venue wifi fails at the worst moment, because at pop-ups it does.
8. **Timezone is `America/Los_Angeles`, always.** Store UTC, render Pacific. Application deadlines at "11:59pm PST" have burned every event system ever built.
9. **PII (W-9, permits, IDs) lives in private buckets with signed short-TTL URLs**, is never logged, and never appears in an error message.
10. **Migrations forward-only.** Never edit a shipped migration.

---

## 4. Environments

| Env | URL | Stripe | Data |
|---|---|---|---|
| Local | `localhost:3000` | test | seeded |
| **Preview** (per PR) | `*.vercel.app` | test | seeded demo show — **this is what the team sees Friday** |
| **Staging** | `staging.mermademarket.com` | test | anonymized copy |
| **Production** | `mermademarket.com` | live | — |

Cut over DNS only after staging has run a full apply→accept→pay cycle with real people.

---

## 5. Security

- Postgres **Row Level Security** on vendor-scoped tables. A vendor can read only their own rows — enforced at the database, not just in application code, because that's the layer that doesn't have bugs on a deadline.
- Role checks in middleware for `/admin`; POS role can reach only `/pos` and its sync endpoint.
- TOTP required for any account that can approve a payout.
- Rate limiting on the public application endpoint and all auth routes.
- Uploads: type + magic-byte validation, size caps, virus scan on documents, EXIF stripped from photos.
- CSP, HSTS, no secrets in `NEXT_PUBLIC_*` beyond the Stripe publishable key.
- Nightly Postgres backup with point-in-time recovery; **test the restore once before the show**, not after.
- Full audit log table, immutable, exported monthly.

---

## 6. Environment variables

```
DATABASE_URL=
SUPABASE_URL=  SUPABASE_ANON_KEY=  SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=  STRIPE_PUBLISHABLE_KEY=  STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=  STRIPE_TERMINAL_LOCATION_ID=
RESEND_API_KEY=  EMAIL_FROM=
INNGEST_EVENT_KEY=  INNGEST_SIGNING_KEY=
SENTRY_DSN=
NEXT_PUBLIC_SITE_URL=
APP_TIMEZONE=America/Los_Angeles
```

---

## 7. Third-party cost estimate (monthly, at this scale)

| | |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Resend | $20 |
| Inngest | $0–20 |
| Sentry | $0–26 |
| Twilio (Phase 3) | ~$10 |
| **Recurring subtotal** | **≈ $75–120/mo** |
| Stripe | per-transaction, see `04` §7 |
| Terminal hardware | one-time, ~$250–300/reader |
| **Shopify (cancelled)** | **−$29 to −$79/mo** |

The platform costs roughly what Shopify does, and does something.
