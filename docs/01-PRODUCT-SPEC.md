# Mermade Market Platform — Product Specification

**Version 1.0 — August 19, 2026**
This is the functional spec. Architecture in `02-ARCHITECTURE.md`, schema in `03-DATA-MODEL.md`, payments in `04-PAYMENTS-AND-POS.md`, sequencing in `05-BUILD-PLAN.md`.

---

## 0. System in one picture

```
                       ┌──────────────────────────────────────────────┐
                       │            mermademarket.com                 │
                       │  PUBLIC SITE (marketing, journal, apply,     │
                       │  roster, lookbooks, FAQ, sponsors)           │
                       └───────────────┬──────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼─────────┐        ┌───────────▼──────────┐       ┌───────────▼─────────┐
│ VENDOR PORTAL   │        │  ADMIN / STAFF       │       │  POS  (/pos)        │
│ /portal         │        │  /admin              │       │  tablet, offline-   │
│                 │        │                      │       │  first, scanner     │
│ • application   │        │ • jury pipeline      │       │                     │
│ • status        │        │ • roster & layout    │       │ • scan → cart       │
│ • pay booth fee │        │ • onboarding compl.  │       │ • Stripe Terminal   │
│ • checklist     │        │ • inventory review   │       │ • cash / split      │
│ • inventory +   │        │ • live sales board   │       │ • returns           │
│   label PDFs    │        │ • payout approval    │       │ • queue when offline│
│ • live sales    │        │ • CONTENT EDITOR     │       │                     │
│ • statement     │        │ • reports            │       │                     │
└─────────────────┘        └──────────────────────┘       └─────────────────────┘
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │  Postgres + Stripe       │
                          │  Connect / Terminal / Tax│
                          └──────────────────────────┘
```

Four surfaces. One database. One vendor record that travels from application through payout.

---

## 1. Core domain model (conceptual)

Read `03-DATA-MODEL.md` for the actual schema. Conceptually:

- **Show** — a dated event (e.g. "Fall 2026", Nov 13–15). Owns its own pricing, dates, capacity, application window, and terms version. **Everything is scoped to a Show.** This is the single most important modeling decision: never hardcode a date, price, or capacity anywhere in the product.
- **Vendor** — a persistent business entity across shows. Owns compliance docs, Stripe account, contact info, history, and lifetime stats.
- **Application** — one Vendor's request to be in one Show, for one or more Spaces. Carries the jury record.
- **Booking** — an accepted Application converted into a confirmed placement: space type, day(s), price, add-ons, payment status.
- **SpaceType / Space** — sellable inventory (JR 3'×2', 3'×6', Fri outdoor 10×10, etc.) and the physical slots on the floor plan.
- **Item** — an indoor vendor's SKU'd product with a generated barcode.
- **Sale / SaleLine** — a register transaction and its lines, each line attributed to a Vendor and Item.
- **Statement** — end-of-show per-vendor reckoning: gross, commission, deductions, net, payout status.

---

## 2. Public site

### 2.1 Pages

| Route | Purpose | Content source |
|---|---|---|
| `/` | Home. Next show hero (dates/venue/CTA driven by the active Show record), what Mermade is, proof numbers, featured makers, journal teasers, email capture | Structured + editable blocks |
| `/apply` | Prospectus + application entry. Shows live status: *Opens Sept 7* → *Open, closes Sept 21* → *Closed — join the waitlist* | Show record + editable prose |
| `/apply/indoor`, `/apply/outdoor` | The prospectus split by track: pricing tables, rules, what we look for, lookbook links | Show pricing + editable prose |
| `/merchants/[show-slug]` | The roster for a show. Replaces `/pages/spring-2026-merchants` etc. Auto-generated from confirmed Bookings. Past shows stay live forever | Generated |
| `/lookbook/indoor`, `/lookbook/outdoor` | Display standards, with images | Editable gallery |
| `/schedule` | Dates, hours, venue, map, parking, food trucks, live music | Show record |
| `/faq` | Q&A, split Shoppers / Merchants | Editable Q&A list |
| `/journal`, `/journal/[slug]` | Blog. Migrated from Shopify | Editable posts |
| `/sponsors` | Rate card, audience stats, past sponsors, inquiry form | Editable |
| `/contact` | Form → routed inbox + DB record | — |
| `/policies/*` | Vendor agreement (current version, public), privacy, terms | Versioned docs |

### 2.2 Photography & video — a first-class requirement, not decoration

The visual reference is **Goop's restraint + McGee & Co.'s warmth + Pilgrim Surf + Supply's documentary eye.** That means the site is carried by imagery, and the build has to treat media as infrastructure.

**Direction.** Documentary, shot on or graded like 35mm — real light, real people, grain. Not styled product shots on white. Mixed ratios in an editorial mosaic rather than a uniform grid. Small tracked captions under images, magazine-style (`Indoor floor · Saturday, 10:40am`). Full-bleed imagery that breaks the page margin.

**Video.** Planned: a "what our vendors say" film plus cinematic B-roll clips.
- Host on **Mux** or **Cloudflare Stream** — never a raw `<video>` off Supabase Storage. HLS, adaptive bitrate, generated poster frames.
- Hero and section B-roll: muted, `autoplay`, `loop`, `playsinline`, poster frame painted first so LCP is the image, not the video.
- Vendor testimonial films: click-to-play with sound, captions/subtitles required (accessibility and silent autoplay both).
- **Respect `prefers-reduced-motion`** — serve the poster frame, no autoplay.
- Lazy-load anything below the fold; never let video block first paint.
- Admin needs a media library that handles video: upload, poster selection, alt text/caption, and placement into a content block.

**Performance budget stands even with heavy media:** LCP < 2.0s on 4G. That's achievable because the hero is a poster image, everything else is lazy, and the marketing pages are statically generated.

**Assets on hand:** the real marks are in `brand/` — `mermade-wordmark.svg` (primary, vector), `mermade-ribbon.png` and `mermade-pennant.png` (transparent). Wordmark is the primary lockup. Ribbon is a stamp, used once or twice per page, often reversed over photography. Pennant is an ornament at section markers only.

### 2.3 Requirements

- **Static-first.** Marketing pages statically generated, revalidated on content publish. The site must survive an Instagram post spiking traffic 50× with zero database load.
- **Every 2026-and-earlier Shopify URL 301s.** Full map in `05-BUILD-PLAN.md`. The 18 `/blogs/journal/*` posts redirect 1:1 — they are the only real SEO equity. The 53 empty `/collections/mm*` URLs collapse to `/merchants`.
- **Structured data:** `Event` schema on the show pages so Google surfaces dates. Currently missing — free win.
- **Performance budget:** LCP < 2.0s on 4G. Images via `next/image`, AVIF/WebP.
- **Accessibility:** WCAG 2.2 AA. Non-negotiable for a business planning a sale.

---

## 3. Application & jury pipeline

This is Phase 1 and the thing that must be live before September 7.

### 3.1 The application form

Multi-step, saves progress, resumable by magic link. Every field below maps to a column — no free-text blobs where structure is possible.

**Step 1 — Your shop**
- Shop / brand name *
- Legal business name (if different)
- Applicant name *, email *, phone *
- Website, Instagram handle *, Etsy/other
- City, State *
- Have you sold at Mermade before? → if yes, which shows (autocomplete against past shows)

**Step 2 — What you make**
- Primary category * (single-select from a managed list: Jewelry, Apparel, Home, Ceramics, Paper/Art, Bath & Body, Kids, Candles, Leather, Vintage, Treats, Plants, Other)
- Secondary categories (multi, max 2)
- Description of your product * (max 600 chars)
- Price range: low $ *, high $ *
- Is everything made by you? * (Yes / Mostly, with sourced components / I curate & resell)
- Is any of it produced with AI-generated artwork? * (Yes / No) — *Renegade and Patchwork both added this in 2025; add it now*
- Are you an MLM/direct-sales brand? * (Yes / No) — auto-flag
- **5–8 product photos, required** + **1 booth/display photo** (required for outdoor, optional for indoor). Drag-drop, client-side resize, max 10MB each.
  - *This replaces the current "email photos to hello@ with a specific subject line" workflow entirely.*

**Step 3 — Which track, which spaces**
- Indoor / Outdoor / Both * (branches the rest of the form)
- **Indoor:** space type (priced list from the Show record), corner/endcap request, table rental, shared space + who with, Junior Maker (14 & under)
- **Outdoor:** day(s) — Fri / Sat / Sun (multi, priced individually), tent rental, table rentals, trailer/van/truck, shared tent + partner, endcap request
- Live price total renders as they select, from Show pricing. No stale price tables in prose anywhere.
- Outdoor fit self-check (from the current rules): comfortable with direct selling; ≥50% of inventory over $100; ≥50% custom product; available the full day

**Step 4 — Compliance** *(new — closes audit §1.1, §1.3)*
- CA seller's permit number — OR — "I qualify as an occasional seller (CDTFA 410-D)". **Optional at this stage, and labelled as optional.** The blocking requirement lives on the onboarding checklist (§4) and gates load-in, because Publication 111's duty attaches to renting space, not to receiving an application. Asking here only buys a head start on the vendors who already have their paperwork.
- Certificate of insurance upload (required before confirmation; may be deferred at application if that's the policy call)
- Food vendors only: health permit type (prepackaged $66 / open food $127), cottage food license upload
- W-9 (indoor only, or all — CPA call)

**Step 5 — Agree & submit**
- Read + e-sign the Vendor Agreement for this show. Records `terms_version`, timestamp, IP, user agent.
- Optional application fee payment, if enabled for this show (see audit §3.1 — **off by default until you decide**)

**On submit:** DB record, confirmation email with a status link, Slack/email ping to staff, and a public thank-you page that sets an honest expectation ("Roster announced [date from the Show record]").

### 3.2 Jury pipeline (admin)

The review UI is the product here. Optimize for speed of judgment, not completeness of display.

**Board view** — Kanban columns: `New` → `Under review` → `Shortlist` → `Accepted` → `Waitlist` → `Declined`. Drag to move. Bulk-select for mass actions.

**Card view** — the primary review surface, keyboard-driven:
- Big photo grid, arrow keys to page through, `J`/`K` for next/prev applicant
- Right rail: shop name, category, price range, links (IG opens in a sheet), space requested, price total, history badges (`Repeat — 3 shows`, `New`, `⚠️ Previously flagged`), compliance status chips
- Score: 1–5 on **Quality**, **Originality**, **Brand/photography**, **Fit** (mirrors Renegade's quality/originality/production rubric and West Coast Craft's "technique, skill, material, branding, website, price point")
- Private notes, @-mentionable
- Actions: `Shortlist` / `Accept` / `Waitlist` / `Decline` / `Request more info` (sends a templated email, moves to `Awaiting applicant`)

**Category balance panel** — live counts per category against a target cap you set per show ("Jewelry: 7 shortlisted / cap 3"). This encodes the actual curation rule — *"we only select 1–3 makers in each category"* — into the tool instead of leaving it to memory.

**Capacity panel** — indoor spaces sold vs. capacity by space type; outdoor tents sold vs. capacity per day. Prevents over-acceptance, which is a real failure mode when accepting from an inbox.

**Decline with feedback** — a template picker (photography quality, category full, not enough differentiation, not handmade, MLM, pricing mismatch) plus free text. The FAQ already promises feedback; this makes it a 5-second action instead of a 5-minute one.

### 3.3 Acceptance → booking → payment

1. Accept → generates a **Booking** with a locked-in price breakdown.
2. Acceptance email with a **pay link**. Payment window is a per-show setting (currently 36 hours — I'd set 48; see audit §2.3). Countdown visible in the portal.
3. Vendor pays by card or ACH in the portal. **Instant.** No invoice chasing.
4. On payment: booking `confirmed`, onboarding checklist unlocks, roster page updates, calendar invite for load-in.
5. On expiry: booking auto-`forfeited`, space returns to inventory, **top of waitlist in that category is auto-offered** with the same window. This converts today's leakage into revenue with zero staff time.

### 3.4 Waitlist

Ranked per category and space type. Staff can reorder. Auto-offer on forfeiture. Waitlisted applicants see honest position ("You're 2nd in Jewelry") rather than the current silence.

---

## 4. Vendor onboarding checklist

Unlocks on paid booking. Each item: status, due date, owner, upload/action, blocking or non-blocking. Vendor sees a progress ring; admin sees a compliance matrix across all vendors with filters for "incomplete" and "expiring."

**Indoor checklist**
1. ✅ Booth fee paid *(auto)*
2. Sign Vendor Agreement *(auto if signed at application)*
3. Seller's permit / 410-D on file — **blocking**
4. Certificate of insurance uploaded, expiry after show date — **blocking**
5. W-9 submitted — **blocking payout**
6. **Connect your Stripe account** (Stripe Express onboarding, embedded) — **blocking payout**
7. **Add your item list** (6–20 rows: name + price) — **encouraged, NOT blocking**, due 10 days before load-in. See §5.2 — the register works without it.
8. Tag every item `MM##` + price *(unchanged from today — confirmation checkbox, not an upload)*
9. Confirm load-in slot (staggered picker)
10. Upload display/booth plan photo (optional, feeds the lookbook)
11. Shop sign confirmation (name visible — current rule)
12. Jewelry vendors: confirm packaging boxes *(kills the $20 deduction)*
13. Treats vendors: health permit uploaded, items ≤ $10 confirmed

**Outdoor checklist**
1. ✅ Booth fee paid
2. Sign Vendor Agreement
3. Seller's permit / 410-D — **blocking**
4. COI — **blocking**
5. Confirm load-in slot + vehicle info
6. Confirm tent/table/trailer rentals
7. Backdrop confirmation *(the lookbook's "Required: a BACKDROP!" becomes a checkbox with a photo upload)*
8. Food vendors: health permit

**Automation:** reminder emails at T-14 / T-7 / T-3 / T-1 for anything incomplete. Escalation list for staff. A vendor who hasn't cleared blocking items by T-3 appears on a red list.

---

## 5. Item lists *(indoor)*

> **Revised Aug 19.** This section originally specified SKUs, Code128 barcodes, and Avery label sheets printed at home — the vendor-mall pattern. That's wrong for Mermade. Tags here are **`MM21` + a price**, and a vendor brings **6–20 items**. At that scale barcodes solve a problem that doesn't exist, and asking 40 hobbyist makers to print label sheets is real adoption risk for no gain. Full reasoning and the register design in `07-POS-BUILD.md`.

**The register reads what your tags already say: a vendor code and a price.** Nothing else is required for the money to be correct.

### 5.1 Tier 1 — vendor + price *(no vendor action, works day one)*

Cashier enters `MM07`, then `$18`. That's exactly the information already on every tag, so there is **no vendor-side dependency at all** — no upload, no printing, no new instruction in the acceptance email.

Delivers: correct per-vendor totals, real-time sales, automatic 20% commission, automatic statements, automatic payouts. Every operational problem in `00-BUSINESS-AUDIT.md` §2.1 and §2.7 is solved by this tier alone.

Doesn't deliver: item names. A statement reads "17 sales totaling $412," not "you sold 6 candles."

### 5.2 Tier 2 — item list *(strongly encouraged, never blocking)*

A simple form: item name, price, optional quantity. **6–20 rows is a five-minute phone task**, not a CSV project — so lead with the web form and treat CSV as the power-user path, not the default.

Fields: item name *, price *, quantity, category, photo (optional — seeds a future online shop).
Validation: price > 0; soft warning if price falls outside the range declared on the application.

Delivers: named tiles at the register, sell-through, "what actually sold" vendor reports, category performance, sales per square foot by category.

**Tier 2 degrades to tier 1 silently and correctly.** A vendor who never uploads still gets paid exactly right. Nobody's money depends on anybody's homework — this is the rule that makes the November timeline safe.

### 5.3 Tier 3 — barcodes *(parked)*

Revisit only if per-vendor item counts pass ~50, or if a year-round online shop needs scan-based fulfillment. Not planned.

### 5.4 Resolution rules at the register

- **Two items at the same price** → both tiles shown, cashier taps one. If they pick wrong, **the money is still exactly right**; only the item label is off. Money correctness never depends on a judgment call.
- **Price not on the vendor's list** → `OTHER $__`, any keyed amount, attributed to that vendor, flagged for review. Appears on the vendor's statement.
- **No vendor code / illegible** → `UNATTRIBUTED` at a keyed price, resolved in an admin queue after the show. **Never guess a vendor.**
- **Vendor code not on the roster** → take it as unattributed, flag after. The line keeps moving.

---

## 6. Point of sale

Full detail in `04-PAYMENTS-AND-POS.md`. Functional requirements:

- Tablet-first PWA at `/pos`, staff-authenticated, locked to a show
- **Offline-first.** Full catalog cached locally at open; sales queue in IndexedDB; sync on reconnect. Register never blocks on network.
- Scan (USB/Bluetooth HID scanner behaves as a keyboard — no driver work) or keyed SKU or search
- Cart shows item, vendor, price; multi-vendor carts are normal and expected
- Discounts: item-level and cart-level, permission-gated, reason-coded, and **apportioned back to the affected vendors' lines** so commission math stays honest
- Tender: card via Stripe Terminal, cash (with change calc), split tender
- Receipt: email or SMS, print optional
- Returns: scan receipt or SKU → reverses the vendor's ledger line, not just a generic refund
- Void / no-sale / drawer open, all logged with staff identity
- End-of-day: register close, cash count, variance report
- Fast: scan-to-cart under 200ms, fully local. Never wait on an API to add a line.

---

## 7. Live sales dashboard

**Admin view** (a wall-mounted screen during the show):
- Gross today, gross show-to-date, transaction count, average basket, items/basket
- Sales by hour (spot the Saturday 10am peak, staff to it)
- Leaderboard: top vendors, top categories, top items
- Sell-through: vendors low on inventory → prompts a restock ping *(the current rules already tell vendors to restock in slow afternoons; now it's data-driven)*
- Register health: online/offline, queued transactions, last sync
- Alerts: unattributed sales, price mismatches, offline transaction volume approaching your risk cap

**Vendor view** (in the portal, live during the show):
- My gross, my items sold, my estimated commission and estimated net
- Which items are selling, which haven't moved
- Low-stock nudge

This is a genuinely differentiated vendor experience. Indoor vendors currently sit at home for three days knowing *nothing*. Giving them a live feed is the single best retention feature in this build, and it costs almost nothing once the SKU system exists.

---

## 8. Commission, statements & payouts

### 8.1 Statement generation

At show close, one Statement per indoor vendor:

```
Gross sales                            $4,182.00
  Less: discounts apportioned            -$61.00
Net sales                              $4,121.00
Mermade commission (20%)                -$824.20
Deductions
  Label non-compliance                     $0.00
  Jewelry packaging                        $0.00
  Late load-in fee                         $0.00
Adjustments (unattributed resolved)      +$45.00
─────────────────────────────────────────────────
NET PAYOUT                             $3,341.80
```

Every line drills into its source transactions. Deductions require a reason and an admin identity — an audit trail matters if a vendor disputes.

### 8.2 Approval → payout

Per your requirement, **nothing moves without approval on the first show**:

1. Statements generate automatically at close, status `draft`
2. Staff review, apply deductions/adjustments, mark `ready`
3. Vendor gets a preview and a 48-hour window to flag a discrepancy *(strongly recommended — catches errors before money moves, and vendors trust a system that shows its work)*
4. Admin **approves** → Stripe Transfer fires → status `paid`
5. Vendor notified; funds arrive per their payout schedule
6. Any statement with an unresolved dispute or an incomplete W-9/Stripe onboarding is blocked from approval

Batch approval with a confirm dialog showing total dollars about to move. Full audit log: who approved, when, from where.

### 8.3 Outdoor vendors

No commission, no statement, no payout. Their financial relationship ends when they pay the booth fee. Model this explicitly rather than bolting them into the same flow — half the complexity in this system disappears when you keep the two tracks separate.

---

## 9. Content admin — "Elise can change things herself"

**Design principle: structured settings beat a free-form CMS.** She doesn't need a page builder. She needs to change the twelve things that actually change, without being able to break the site. A general-purpose CMS gives her more power and more ways to produce a broken page at 11pm before applications open.

**Show settings** — the highest-value screen in the whole admin:
- Name, slug, dates, hours per day, venue, address, map link
- Application open/close dates, roster announcement date, payment window
- Load-in windows and slot capacity
- **All pricing**, indoor and outdoor, as an editable table with add-ons — this alone kills the "prices are hardcoded in six pages of prose" problem
- Capacity per space type, per day
- Category caps for jurying
- Food trucks, live music, services per day
- Terms/agreement version for this show
- Status: draft / applications open / closed / roster live / in progress / complete

Change a date once, and the homepage hero, `/schedule`, `/apply`, the roster page, every email template, and the structured data all update. That's the actual answer to "let me iterate faster."

**Content blocks** — a constrained editor per page: rich text, image, image gallery, stat row, FAQ list, maker cards, CTA, quote. Reorder by drag. Preview before publish. Draft/publish with a one-click revert.

**Journal** — post editor, images, tags, scheduled publish, SEO fields.

**Roster** — auto-generated from confirmed bookings, with manual override for display order and featured placement.

**Media library** — with alt-text prompting, because AA compliance shouldn't depend on remembering.

**Announcement bar** — one field, sitewide, on/off. Every small business wants this and it's an hour of work.

**Email templates** — editable copy for the ~15 transactional emails, with variable pills (`{{vendor_name}}`, `{{show_dates}}`, `{{payment_deadline}}`) and a send-test button.

**Guardrails:** no raw HTML, no CSS editing, no route creation. Everything preview-then-publish, everything revertible.

---

## 10. Reporting *(build for the eventual sale — see audit §4)*

Every report exportable to CSV and scheduled to email.

- **Revenue by show and segment** — indoor commission / indoor space fees / outdoor booth fees / add-ons / sponsorship / (future) online
- **Vendor cohort retention** — applied, accepted, returned, by season. This is the metric a buyer will care most about.
- **Application funnel** — started → submitted → accepted → paid → attended, by category and by track
- **Category performance** — sales per square foot by category. Tells you what to accept more of next season, with evidence instead of instinct.
- **Sales per square foot by space type** — is the $450 3'×12' actually worth 7.5× the $60 JR space?
- **Attendance** *(needs a counter — a simple door clicker app or a wifi/beacon count)* — right now "4,000–5,000" is an estimate and a buyer will discount it
- **Sales tax report** — taxable sales, by rate, by period, matched to filings
- **Compliance report** — permits and COIs on file, expirations, gaps. Print it and put it in a binder; that's your Pub 111 record-retention defense.

---

## 11. Notifications

**Email** (transactional, from a real domain with SPF/DKIM/DMARC — not Shopify's sender):
application received · more info requested · accepted (with pay link) · payment received · payment reminder at T-24h · forfeiture notice · waitlist offer · declined with feedback · checklist reminders T-14/7/3/1 · load-in details + slot · show-day open · statement ready for review · payout approved · payout sent · post-show thank-you + next-show teaser

**SMS** (opt-in, Phase 3): load-in reminder, show-day logistics, payout sent, urgent day-of ("your booth needs restock").

**Internal:** Slack or email digest — new applications, payment received, forfeiture, blocked-compliance vendors at T-3, register offline > 5 min, unattributed sale logged.

---

## 12. Roles & permissions

| Role | Can |
|---|---|
| **Owner** (Elise, Drew) | Everything, including payout approval and pricing |
| **Staff / Juror** | Review + score applications, view vendors, no financial actions |
| **Register** | POS only, scoped to one show, no reports, no admin |
| **Vendor** | Own record, own application, own inventory, own sales, own statement |

Payout approval requires Owner. Deductions require Owner or an explicitly granted permission. Everything financial is audit-logged with actor, timestamp, and before/after values.

---

## 13. Design direction — "institutional"

The current brand is warm, casual, exclamation-heavy coastal ("Surfin' into Mermade Market tomorrow!"). That voice built a 17k following and shouldn't be erased. "Institutional" here should mean **the confidence to say less**, not corporate sterility.

**What changes:**
- **Typographic hierarchy over decoration.** One editorial serif for display (something with real character — Canela, Tiempos Headline, GT Sectra) and one clean grotesque for UI (Söhne, Neue Haas, or Inter as the free fallback). Big type, generous leading, real scale contrast.
- **Restraint in the palette.** Pull the coastal palette down to near-neutral: warm off-white paper, deep ink, one sand tone, one muted sea tone as the single accent. Color earns its place; it doesn't decorate.
- **Editorial grid.** Wide margins, asymmetric layouts, full-bleed photography that's allowed to breathe. Look at how a museum or a design fair presents itself — Field + Supply, Renegade, and West Coast Craft all read more institutional than their subject matter, and that's exactly the trick.
- **Proof, presented plainly.** *11 years. 100+ merchants. 6,000 returning shoppers. 17,000 followers.* Set as a quiet stat row, not badges with exclamation points. This is the single fastest signal of institutional weight — and it's the same data a sponsor or an acquirer reads.
- **Photography as the brand.** The lookbook aesthetic is already excellent. Make the site 70% photography, consistently color-graded.
- **Copy discipline.** Cut roughly 80% of the exclamation points on the public site. Keep the warmth in the journal and Instagram, where it belongs. "A hand-curated market uniting creators and community" needs no exclamation point to land.
- **Dark, quiet footer** with the institutional stuff: press, sponsorship, vendor resources, policies, contact.

**What doesn't change:** the name, "Shop small. Think Big.", free entry, the curation voice, the maker-first storytelling.

---

## 14. Explicitly out of scope for v1

Naming these so they don't creep in:
- Year-round online storefront (Phase 4 — the data model supports it from day one)
- Vendor-to-vendor messaging
- Native mobile apps
- Multi-market / white-label (do not build for a second market until there is one)
- Ticketing (until you decide on paid early access)
- Attendee accounts / loyalty
- Automated jurying or AI scoring — **the curation is the product; do not automate the judgment**
