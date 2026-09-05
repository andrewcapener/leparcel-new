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
| `CONTACT_TO` | no | Where the contact and collaborate forms deliver. Defaults to `hello@mermademarket.com`. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | to sync the Sheet | Service account address, e.g. `sheets@mermade-apps.iam.gserviceaccount.com`. |
| `GOOGLE_PRIVATE_KEY` | with the above | The `private_key` out of the service account's JSON key. Literal `\n` or real newlines both work. |
| `SHEETS_SPREADSHEET_ID` | with the above | The long id in the Sheet's URL, between `/d/` and `/edit`. |
| `SHEETS_TAB` | no | Which tab to write. Defaults to `Applications`, and is created if missing. |
| `SHEETS_WEBHOOK_URL` | fallback | Apps Script web app `/exec` URL, used only when the service account is not set. |
| `SHEETS_WEBHOOK_SECRET` | with the above | The shared secret the Apps Script checks. |

Seeding: `SEED_MODE=show npm run db:seed` seeds only the show and prices (production);
the default seeds 30 demo applicants too. A non-empty database is never wiped unless
`SEED_FORCE=1` is set.

`npm test` runs the commission property test (200,000 randomized cases) and the
Sheets sync tests (row mapping, retry policy, transport selection).

---

## Applications land in a Google Sheet

Every submitted application is pushed to a Google Sheet so the team can read
and sort applications outside the admin. One row per application: submitted
time in Pacific, shop, contact, email, phone, Instagram, website, city, state,
category, track, the spaces and add-ons they asked for, price range, the three
curation flags, the description, and a link straight to the application in the
admin. Compliance fields never go: no seller's permit, no signed name, no jury
notes.

**It never affects a submission.** The application is committed first, the
maker gets their confirmation first, and the sync runs last. If Google is down
the row is queued in `sheet_syncs` and retried; nothing is lost and the maker
never sees a failure.

There are two ways to connect it. Set up either one.

### Option A, a Google service account (preferred)

1. In [console.cloud.google.com](https://console.cloud.google.com), create a
   project, or open one you already have.
2. **APIs & Services ▸ Library ▸ Google Sheets API ▸ Enable.**
3. **APIs & Services ▸ Credentials ▸ Create credentials ▸ Service account.**
   Any name. No roles are needed; a service account reaches the Sheet through
   sharing, not through IAM.
4. Open the service account ▸ **Keys ▸ Add key ▸ Create new key ▸ JSON.** A
   file downloads. It holds `client_email` and `private_key`.
5. **Open the Sheet and Share it with that `client_email` address, as an
   Editor.** This is the step everybody forgets, and skipping it makes every
   write come back `403 The caller does not have permission`, which reads like
   a credentials problem and is not.
6. In Vercel ▸ Settings ▸ Environment Variables, set
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` to the `client_email`,
   `GOOGLE_PRIVATE_KEY` to the `private_key` (paste it whole, including the
   `-----BEGIN PRIVATE KEY-----` lines; Vercel's literal `\n` form is handled),
   and `SHEETS_SPREADSHEET_ID` to the id in the Sheet's URL. Redeploy: env
   vars are baked in at build time.

The header row and the tab are created on first use.

### Option B, an Apps Script web app

No cloud project and no key material. `docs/sheets-webhook.gs` is the script
and its header comment is the instructions: open the Sheet, **Extensions ▸
Apps Script**, paste, set `SECRET`, **Deploy ▸ New deployment ▸ Web app** with
access **Anyone**, then put the `/exec` URL in `SHEETS_WEBHOOK_URL` and the
same secret in `SHEETS_WEBHOOK_SECRET`.

Used only when the service account is not configured. With neither set the
sync is a silent no-op, exactly the way mail is without `RESEND_API_KEY`.

### When something goes wrong

- **Nothing is lost.** `sheet_syncs` holds one row per application: `pending`
  is queued and will be retried with a widening backoff, `sent` is in the
  Sheet, `failed` gave up and wants a person.
- **Where you see it.** `/api/health` reports which transport is configured,
  what is missing from it, how many applications the Sheet is short, and the
  last error. A failure also writes a line to the outbox, so it shows up under
  **Failed** at `/admin/outbox` the way a bounced email does.
- **How you fix it.** One command:

  ```bash
  npx tsx scripts/sync-sheets.ts            # push everything the Sheet is missing
  npx tsx scripts/sync-sheets.ts --all-shows
  npx tsx scripts/sync-sheets.ts --dry-run  # list, post nothing
  ```

  Safe to run repeatedly. The row is keyed on the application id, which is the
  last column, so a re-send updates the row it already wrote instead of adding
  a second one. That is also what makes a retry after a timeout safe.

Migration `drizzle/0003_sheet-syncs.sql` creates `sheet_syncs`. Until it is
run, the sync still posts and simply cannot remember, so run it.

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

The vendor portal is the next piece of work and is designed but not built:
magic-link login bound to the vendor row, booth-fee payment, and the
compliance checklist. Two decisions block it — the payment window is 48h on
the Show record and 36h in the vendor agreement, and payouts are manual
(Venmo/Zelle/check) so Stripe Connect onboarding is probably spring work, not
November's.

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
- **No unsourced numbers ship.** The archive band and the founder letter that
  carried invented figures were removed with the theme port; the placeholders
  they held are gone with them. `src/lib/content.ts` still gates the press
  quote and the testimonials on the same rule — they render only when someone
  supplies real ones. See `09-CONTENT-AUDIT.md` §5.

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
    Wordmark.tsx        the real mark, as inline SVG
    theme/              their Symmetry sections, as React (see below)
  db/
    schema.ts           the subset of 03-DATA-MODEL.md this slice needs
    seed.ts             1 show, 10 space types, 4 add-ons, 30 applicants
  lib/
    money.ts            integer cents; the only place commission is computed
    money.test.ts       the property test CLAUDE.md rule 2 requires
    dates.ts            America/Los_Angeles, everywhere
    content.ts          editable copy
    page-html.ts        their long editorial pages, as HTML with {{tokens}}
    journal.ts          their twelve articles, bodies and all
    lookbook.ts         their two lookbooks, photo paired to caption
    theme-img.ts        the vendored image manifest
public/
  theme/                mermademarket.com's own front end, vendored
```

## The public site is their theme, vendored

`public/theme/` holds mermademarket.com's compiled Shopify **Symmetry**
stylesheet, the per-shop settings block that carries their colours and type
scale, their two faces (Figtree and Oswald) as woff2, their `main.js` /
`animate-on-scroll.js` / `scrolling-banner.js`, and every photograph and logo
from their CDN. The pages in `src/app` compose `src/components/theme/*`, which
emit **their** markup and class names; their stylesheet does the styling.

Four things there look arbitrary and are load-bearing:

- **The template class.** `SiteShell` puts `template-index` /
  `template-page` / `template-article` on a wrapper, because Symmetry's
  full-bleed layout is keyed off the class Shopify normally puts on `<body>`.
  Without it every section is inset and pushed down by 50px.
- **`data-cc-animate`.** Any element carrying `fade-in-up` needs it, or their
  own CSS holds it at `opacity: 0` for ever.
- **Script timing.** The theme scripts load at `afterInteractive`
  (`ThemeBoot`), not during parse. They mutate DOM React rendered on the
  server; running them before hydration makes React throw and re-render,
  which wipes everything they just set.
- **The replayed `DOMContentLoaded`.** Because of that timing, the scripts
  arrive after the real event has fired, and `main.js` keeps a large block of
  its setup inside a `DOMContentLoaded` listener — the mobile nav toggle and
  `theme.openMobileNav`, the scrim that closes the drawer, the `tab-used`
  keyboard check, in-page smooth scrolling. Registered for an event that was
  never coming again, none of it ran; the hamburger did nothing on every page.
  `ThemeBoot` re-dispatches the event once all four scripts have loaded.
  Nothing else on the page listens for it.

Their prose — the maker rules, the application FAQ, the journal — is checked
in as HTML rather than reworded. Everything dated, priced or counted in it is
a `{{token}}` filled from the Show record at render time, so `/admin/show`
stays the only place those change.

`src/app/globals.css` is the **admin** stylesheet now, imported by
`src/app/admin/layout.tsx` so it loads after the theme and wins inside
`/admin`. `public/theme/local.css` holds the short list of things our markup
needs that Symmetry has no class for.

## Deploying

Pushes to the deploy branch build on Vercel automatically. Env vars
(`DATABASE_URL` pooler URI, `ADMIN_PASSWORD`, `RESEND_API_KEY`) are baked
in at build time; changing one requires a redeploy.
