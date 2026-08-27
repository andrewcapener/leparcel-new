# Build Plan & Timeline

---

## 1. The timeline you actually have

You asked for the full system in a week with a team preview Friday. Here's the honest read, and then a plan that gets you most of what you want.

**The real deadlines aren't next week — they're these:**

| Date | Deadline | Source |
|---|---|---|
| **Fri Aug 21** | Team preview | You |
| **Late Aug / Sept 7** | ⚠️ **Applications open** — the site says "late August," Instagram says "Sep 7." **These conflict. Pin this down today.** | mermademarket.com + @mermademarket |
| **~Sept 21** | Applications close (14-day window, historical pattern) | Historical |
| **~Sept 28** | Roster announced (+7 days, historical pattern) | Historical |
| **~Oct 1** | Booth fees collected, onboarding starts | Derived |
| **~Nov 2** | Inventory uploaded, labels printed | Derived (T-10) |
| **Early Oct** | Terminal hardware must be ordered | Stripe ships with no SLA |
| **Late Oct** | POS dry run with real cards | Required |
| **Thu Nov 12** | Load-in | Venue booking |
| **Fri–Sun Nov 13–15** | 🎪 **The show** — Dana Point Community House | ✅ **Confirmed:** venue holds 11/12–15/26, contract signed + deposit sent Jul 23, 2026 |
| **~Nov 27** | Payouts (10 business days) | Recommended policy |

**So the truth is: you have ~2 weeks for applications and ~12 weeks for everything else.** That's not a tight timeline — it's a comfortable one, *if* the work is sequenced against those dates instead of against "next week."

### Where I'd push back

Shipping the POS and Stripe Connect payouts by next week is the part I'd argue with, and not because of build time:

- **40 vendors have to complete Stripe Connect KYC.** That's a human process with a real tail. Some will need ID review. It cannot be compressed and it doesn't need to start until October.
- **Terminal hardware has no published shipping SLA.** You cannot demo a POS you don't have readers for.
- **A payment system with no dress rehearsal is how you lose money at the register.** The failure mode isn't "it's late," it's "Saturday at 10:40am the line is thirty deep and nothing scans." That's a brand event, not a bug.
- **The tax question (audit §1.2) is genuinely unresolved.** Building the tax logic before you know whether Mermade is the retailer of record means building it twice.

None of that blocks the thing that's actually urgent. **Applications open in two weeks.** That's the sprint.

### What I'd commit to instead

- **Friday Aug 21** — real, clickable preview: new site shell in the new design direction, full application form, and the jury dashboard, seeded with fake applicants, on a preview URL the team can click through.
- **Fri Aug 28** — applications module production-ready and on staging: public site, apply, jury pipeline, acceptance, online booth-fee payment, emails, Elise's show-settings admin. This is your "full system ready next week," honestly scoped.
- **Sept 4** — live on `mermademarket.com`, Shopify off, buffer before applications open.
- **Then 10 more weeks** for onboarding, inventory, POS, and payouts — which is exactly the runway those need.

---

## 2. Phases

### 🟦 PHASE 0 — Foundation (Aug 19–21, 3 days)

- Repo, Next.js 15 + TS strict, Tailwind, shadcn, Drizzle, Supabase project
- Vercel project + preview deploys wired to PRs *(this is how Friday's preview happens)*
- Full schema migrated, seed script with a realistic demo show + 30 fake applicants
- Auth: magic link (vendor) + password/TOTP (staff), role middleware
- Design tokens + core UI kit from the direction in `01-PRODUCT-SPEC.md` §13
- Sentry, error boundaries, CI running typecheck + tests

**Friday deliverable:** preview URL. Homepage, `/apply`, the full application form (submitting to a real DB), and `/admin/applications` with the jury board and card view over seeded data. Rough edges fine. It has to be clickable, not a mockup.

### 🟩 PHASE 1 — Applications live (Aug 22–Sept 4, 2 weeks) 🔴 HARD DEADLINE

Everything required to open applications on the new platform.

**Public site (v1):** home, `/apply` + indoor/outdoor prospectus, `/schedule`, `/faq`, `/lookbook/*`, `/journal` (18 posts migrated), `/merchants/[show]` for past shows, `/contact`, `/policies/*`. All 301s in place.

**Application:** the full multi-step form from spec §3.1 including the optional compliance step (seller's permit / 410-D, COI — none of it blocking; the blocking check is on the onboarding checklist and gates load-in) and e-signed vendor agreement. Photo upload with client-side resize. Save + resume. Live price calculation from show pricing.

**Jury pipeline:** board + card view, keyboard nav, scoring rubric, category-cap panel, capacity panel, notes, request-more-info, decline-with-feedback templates, bulk actions.

**Acceptance → payment:** accept generates booking, sends pay link, card + ACH, countdown, auto-forfeit + waitlist auto-offer.

**Admin — show settings:** the whole screen. Dates, hours, venue, windows, **all pricing and add-ons**, capacities, category caps. This is Elise's control panel and it's a Phase 1 item, not a nice-to-have.

**Emails:** received / more info / accepted / payment received / T-24 reminder / forfeited / waitlist offer / declined.

**Cutover:** DNS, SSL, redirects verified, Shopify to read-only, sitemap submitted, Search Console.

**Ship gate:** a real person can apply, be juried, be accepted, pay, and receive every email — on staging, end to end, twice — before DNS moves.

### 🟨 PHASE 2 — Onboarding & compliance (Sept 8–Oct 3, ~4 weeks)

Runs *while* applications are open and being juried.

- Vendor portal: dashboard, booking, checklist with progress
- Checklist engine: templates per track, blocking rules, due dates, reminder cascade at T-14/7/3/1
- Document upload + verification queue + expiry tracking; admin compliance matrix with the red list
- **Stripe Connect Express onboarding embedded in the portal**
- Load-in slot picker with capacity
- Floor plan tool: spaces, drag-assign, `MM##` codes, printable floor map
- Roster auto-publishes to `/merchants/fall-2026`
- Content admin: blocks editor, journal editor, media library, FAQ, announcement bar, email template editor
- **Design refresh ships fully here** — Phase 1's site is functional; this is where it becomes institutional

### 🟧 PHASE 3 — Item lists (Oct 5–Oct 17, ~1.5 weeks) *(scope reduced Aug 19)*

Barcodes, SKU generation, and Avery label PDFs are **cut** — see `01-PRODUCT-SPEC.md` §5 and `07-POS-BUILD.md`. Tags stay `MM##` + price, exactly as today.

- Item list web form (6–20 rows: name, price, optional qty) — the default path
- CSV import as a secondary path for the rare vendor with a big list
- Vendor item management: edit, add mid-show, deactivate
- Admin view across all vendors; "who hasn't added items" nudge list *(a nudge, not a gate)*
- **Order Terminal hardware by Oct 2, no later**

**This phase is no longer a blocking dependency for Phase 4.** The register works on vendor + price whether or not a single vendor fills this in.

### 🟥 PHASE 4 — POS & live ops (Oct 12–Nov 7, ~4 weeks, overlaps Phase 3)

- POS PWA: catalog cache, scanner input, cart, discounts, split tender, receipts
- Stripe Terminal integration + reader pairing + connection management
- Offline queue, sync endpoint, idempotent replay, conflict surfacing
- No-tag / MISC / UNATTRIBUTED flows
- Returns and voids
- Register close, cash count, variance
- Live sales dashboard (admin wall view + vendor portal view)
- Sales tax computation per line, per the CPA's answer
- **Dry run week of Oct 26:** 5 real vendors, real labels, real cards, deliberate network failure, real statement, real $10 payout

### 🟪 PHASE 5 — Statements & payouts (Nov 1–14, ~2 weeks)

- Statement generation, drill-down to source transactions
- Deductions and adjustments with reason codes and audit trail
- Vendor statement preview + 48-hour discrepancy window
- Approval queue with batch approve and a confirm dialog showing total dollars
- Stripe Transfers, idempotent, with failure handling and retry
- Payout notifications; Connect 1099 configured
- Unattributed-sale resolution queue

### 🟫 PHASE 6 — Post-show & reporting (Nov 16–Dec)

- All reports from spec §10, exportable and schedulable
- Post-show vendor survey, retention cohorts
- Show archive → `/merchants/fall-2026` becomes permanent
- Retro; spring 2027 show cloned from fall in one click

### ⬜ PHASE 7 — Growth (2027)

- Year-round online storefront off the existing SKU catalog
- Sponsorship management + rate card
- Paid early-access ticketing (if you decide to test it)
- Attendance counting
- Public vendor directory as an SEO asset

---

## 3. Shopify → new site redirect map

| Old | New |
|---|---|
| `/pages/merchant-application` | `/apply` |
| `/pages/indoor-merchants` | `/apply/indoor` |
| `/pages/outdoor-merchants` | `/apply/outdoor` |
| `/pages/indoor-lookbook` | `/lookbook/indoor` |
| `/pages/outdoor-lookbook` | `/lookbook/outdoor` |
| `/pages/schedule` | `/schedule` |
| `/pages/faq` | `/faq` |
| `/pages/contact` | `/contact` |
| `/pages/collaborate` | `/sponsors` |
| `/pages/sponsorships` | `/sponsors` |
| `/pages/spring-2026-merchants` | `/merchants/spring-2026` |
| `/pages/spring-2025-merchants` | `/merchants/spring-2025` |
| `/pages/fall-2025-merchants` | `/merchants/fall-2025` |
| `/pages/thank-you` | `/apply/thank-you` |
| `/pages/update-to-shopper` | `/` |
| `/blogs/journal/[slug]` × 18 | `/journal/[slug]` — **1:1, individually verified** |
| `/collections/mm*` (53) | `/merchants` |
| `/collections/*`, `/cart`, `/products/*` | `/` |

Migration script: pull the 18 posts via the Shopify Admin API (or scrape + hand-clean — it's 18 posts), rehost images to Supabase Storage, preserve `legacy_url` on each record, and verify every redirect with a crawler post-cutover.

**Also fix:** the venue discrepancy in third-party listings (Yelp, press, Dana Point Harbor) still pointing at the Ocean Institute, and claim/create the Google Business Profile — none was found.

---

## 4. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Application date is actually late August, not Sept 7 | Phase 1 loses a week | **Confirm today.** If late August, cut Phase 1 to apply + jury only and defer the payment step by a week |
| CA tax answer arrives late | Tax logic built twice | Book the CPA this week. Build behind `shows.tax_inclusive_pricing` so either answer is a config change |
| Terminal hardware ships late | No POS at the show | Order first week of October. Tap to Pay on iPhone as the documented fallback |
| Vendors don't complete Connect KYC | Can't pay them | Open onboarding at acceptance (Oct 1), reminders, paper-check fallback documented in the vendor agreement |
| Venue network fails | Register down at peak | Dedicated cellular router + second carrier + offline mode with caps + cash fallback + 2 registers |
| ~~Labels don't scan~~ | — | **Eliminated** — no barcodes. Register reads `MM##` + price, the tag format vendors already use |
| Vendors don't add item lists | Statements say "17 sales / $412" instead of naming items | Not a blocker by design. Money is correct either way (spec §5.2) |
| POS not ready by November | — | **Documented fallback: run November on the current manual tally, ship everything else, launch POS in spring.** Decide by Oct 15, not Nov 10 |
| Scope creep from "while we're in there" | Miss Sept 7 | Phase 1 scope is frozen. Everything else goes in a backlog |
| Elise can't get what she needs changed | The whole premise fails | Sit with her on the show-settings screen in week 3 and watch her use it |

---

## 5. Definition of done, per phase

- **Phase 1:** two full apply→accept→pay dry runs by real humans on staging; all 301s verified by crawler; Lighthouse ≥ 95 on the public site; Elise independently changes a show date and a booth price with no help.
- **Phase 2:** a vendor completes every checklist item unaided; the compliance matrix correctly blocks an incomplete vendor.
- **Phase 3:** a vendor uploads 100 items, prints labels at home, and all 100 scan.
- **Phase 4:** dry run passes including a deliberate network kill; scan-to-cart under 200ms.
- **Phase 5:** statement math property-tested to reconcile exactly; a real payout lands in a real bank account.

---

## 6. What I need from you to keep moving

Ranked. The first three are blocking.

1. ~~Confirm the fall show dates and venue.~~ ✅ **Nov 12–15, 2026, Dana Point Community House.** Still need the **application open/close/announce dates** — the site says "late August," Instagram says "Sept 7."
2. **Ask the CPA the narrowed question.** ~~Do you pay sales tax?~~ ✅ Yes. Remaining: **(a)** is it remitted on full indoor gross or only on the 20%? **(b)** if Mermade is retailer of record, are indoor payouts 1099-NEC/MISC rather than 1099-K — which changes the Stripe Connect config? Bring `00-BUSINESS-AUDIT.md` §1.2.
3. **Get me the current application** — a link to the Google Sheet the Zap writes to, a screenshot of the live form, or a forwarded copy of one submission. The jury pipeline should be built around the questions you already ask, not the ones I guessed.
4. Decide: application fee — keep it free, or introduce one? (audit §3.1)
5. ~~Decide: require COI?~~ ✅ Yes, wanted. Remaining: **ask your broker whether vendors can be added as additional insureds under Mermade's existing GL policy**, and what the premium delta is, vs. collecting ~100 individual COIs. Also worth binding the event cancellation policy you quoted in March. (audit §1.3)
6. Do you have a signed vendor agreement anywhere, or is it all web-page terms? (audit §1.4)
7. ~~How are indoor vendors paid today?~~ ✅ Venmo / Zelle / check, individually, after an emailed sales report. Remaining: roughly what share of vendors would balk at Stripe onboarding vs. welcome it?
8. **Push the Community House on a multi-year agreement.** They said no to five years; ask for three, or a right of first refusal on your two annual weekends. Venue security is a direct input to sale value. (audit §2.8)
9. Shopify plan and renewal date, so we cancel cleanly after cutover. Also: the Zapier account, so the old Zap gets retired rather than left running in parallel.
10. Access: domain registrar/DNS, Shopify admin, Google Analytics/Search Console, the email list platform, and the Instagram account.
11. Brand assets: logo files, fonts you own, and the photo library.

Full list with context in `06-OPEN-QUESTIONS.md`.
