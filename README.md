# Mermade Market — working prototype

A running Next.js app, not a mockup. It implements the one slice with a real
deadline: **public site → apply → jury → accept → booking → confirmed roster.**

```bash
npm install
export DATABASE_URL='postgres://...'   # any Postgres; Supabase in production
npm run setup     # pushes the schema and seeds a show + 30 demo applicants
npm run dev       # http://localhost:3000
```

Environment variables:

| Var | Required | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres. In production, Supabase's transaction pooler URL (port 6543). |
| `ADMIN_PASSWORD` | in production | Gates every `/admin` page behind `/admin/login`. Unset in production, admin returns 503. |
| `RESEND_API_KEY` | to send email | Without it, mail is only written to the outbox table. |
| `EMAIL_FROM` | with Resend | e.g. `Mermade Market <hello@mermademarket.com>` (a domain verified in Resend). |

Seeding: `SEED_MODE=show npm run db:seed` seeds only the show and prices (production);
the default seeds 30 demo applicants too. A non-empty database is never wiped unless
`SEED_FORCE=1` is set.

`npm test` runs the commission property test (200,000 randomized cases).

---

## What to click, in order

| Step | Where | What to look for |
|---|---|---|
| 1 | `/` | Dates, "free," and *Add to calendar* above the fold — the biggest miss the content audit found. Everything dated or priced is read from the Show record. |
| 2 | `/` → email capture | The revenue miss ranked #1 in `09-CONTENT-AUDIT.md`. Writes to `subscribers`. |
| 3 | `/apply` | Note that step 04 is **optional** and says so. Nothing about paperwork blocks an application — see the note under the roster below. Submit it. |
| 4 | `/admin/jury` | Your application is in `New`. The flag chips are **curation only** — MLM, AI artwork, resells. Paperwork is deliberately not shown to the jury; it has no bearing on whether the work is good. Note the category-balance row, which encodes the one-to-three-per-category rule. |
| 5 | Click **Accepted** | Creates a Booking, assigns the next `MM##` code, snapshots the commission rate, and writes the acceptance email. |
| 6 | `/admin/outbox` | Read the actual email. The vendor code and the payment deadline both come from the Show record. |
| 7 | `/admin/roster` | **Missing paperwork** tile and the *Blocks load-in* chips. This is where the CDTFA duty is enforced, because it attaches to renting space — not to reading an application. Then **Mark paid**, which stands in for the vendor paying in the portal. |
| 8 | `/` again | The merchant now appears in the public directory. **The roster is generated from confirmed bookings — never hand-kept.** |
| 9 | `/admin/show` | Proof that nothing is hardcoded: every date, price, capacity, and rate on the public site is read from this one record. |

---

## What's deliberately not here

**POS, Stripe, payouts, statements, the vendor portal, and onboarding
checklists.** None of them are needed until the November show. Applications
open in weeks, so this slice is the one that has a date on it.

Auth on `/admin` is a shared staff password (`ADMIN_PASSWORD`), interim until
Supabase Auth (magic link for vendors, password + TOTP for staff) lands.

---

## Notes for whoever builds the rest

- **Postgres via `DATABASE_URL`.** Supabase in production, any Postgres locally.
- **Every email is recorded in the outbox table**, and delivered through Resend
  when `RESEND_API_KEY` is set.
- **"Mark paid" is a button**, not a webhook. In production, payment state is
  only ever set from a signature-verified Stripe webhook, never a client
  callback.
- **`src/lib/content.ts`** holds the editable copy that becomes the content
  admin. Nothing dated, priced, or counted lives there — that's the Show record.
- Two things in this prototype are flagged in the UI as **unverified**: the
  archive rows and the founder photograph. Both are placeholders. See
  `09-CONTENT-AUDIT.md` §5 — one soft number inverts the whole institutional
  effect.

## Layout

```
src/
  app/
    page.tsx            home — the content-audit page order
    apply/              prospectus + the application form
    admin/              jury · roster · show settings · outbox
    api/calendar/       .ics generation
    actions.ts          every server action; all writes go through here
  components/
    Photo.tsx           the film pipeline, shipped once
    Wordmark.tsx        the real mark, as inline SVG
    site.tsx            masthead + footer, driven by the Show record
  db/
    schema.ts           the subset of 03-DATA-MODEL.md this slice needs
    seed.ts             1 show, 5 space types, 30 applicants, 10 bookings
  lib/
    money.ts            integer cents; the only place commission is computed
    money.test.ts       the property test CLAUDE.md rule 2 requires
    dates.ts            America/Los_Angeles, everywhere
    content.ts          editable copy
```
