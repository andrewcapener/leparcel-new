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
