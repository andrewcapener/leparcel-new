# Mermade Market — Business & Operations Audit

**Prepared:** August 19, 2026
**Scope:** Current-state map of the business, the vendor lifecycle, and the application process. Holes ranked by severity. This document is the *why* behind the platform spec in `01-PRODUCT-SPEC.md`.

---

## 1. Current state, as the outside world sees it

### The business

| | |
|---|---|
| **What it is** | A heavily curated, free-to-attend, 3-day artisan market held twice a year (spring + mid-November) in Dana Point, CA |
| **Age** | Self-reported "11+ years operating" |
| **Venue (current)** | Dana Point Community House, 24642 San Juan Ave, Dana Point, CA 92629 |
| **Next show — CONFIRMED** | **Nov 12–15, 2026** at the Community House (venue holds 11/12–15/26; contract signed and deposit sent July 23, 2026). Load-in Thu Nov 12, show Fri–Sun Nov 13–15 |
| **Venue (historical)** | The Ocean Institute, Dana Point Harbor — press from 2024 and the Yelp listing still point here |
| **Scale** | ~101 merchants at Spring 2026: 28 indoor (all 3 days) + ~24–25 outdoor per day across 3 days |
| **Attendance** | 4,000–5,000 per show (press, 2024); 6,000 repeat attendees (self-reported) |
| **Audience assets** | ~17,000 Instagram followers, ~10,000 email subscribers (self-reported on `/pages/collaborate`) |
| **Press** | NBC Los Angeles (2024), Orange Coast Magazine (2019 founder profile), Dana Point Harbor event listings |

### Two completely different businesses under one brand

This is the single most important structural fact, and the platform has to model it explicitly:

**Indoor — a consignment retail store.** ~35–45 shops, merchandised retail-style. Makers are *not present*. Shoppers browse with baskets and pay at **one central checkout run by Mermade staff**. Mermade takes **20% of sales**. Every item must carry a handwritten/printed tag with a vendor ID and price (`MM34 $15`). Payout to the vendor 7–10 days after the show. Space fees run $60 (JR 3'×2') to $450 (3'×12'), plus add-ons.

**Outdoor — a booth rental business.** ~25 tents rotating *daily*, makers present, each running their own payments. **Booth fee only, 0% commission.** Fri $400 / Sat $500 / Sun $450, plus tent, table, endcap, trailer add-ons.

So: indoor is retail with inventory, tags, a register, and payouts. Outdoor is a space-rental business with no payment involvement at all. They share a brand, a venue, an application form, and nothing else operationally.

### Current tech

- **Shopify.** Sitemap confirms it: `sitemap_pages_1.xml`, `sitemap_collections_1.xml`, `sitemap_blogs_1.xml`, `/blogs/journal/` slugs, `/collections/` URL pattern.
- **13 marketing pages** + 2 orphaned season pages (`fall-2025-merchants`, `spring-2025-merchants`) no longer in the sitemap.
- **53 collections** named `mm1` … `mm45` (plus a few duplicates like `mm8-1`, `mm45-1`) — these map 1:1 to indoor vendor booth IDs. **All are empty.** There is no `sitemap_products_*.xml` at all.
- **Zero products.** Nothing has ever been sold online. The entire Shopify subscription is paying for a brochure site and a blog.
- **The merchant application is a native Shopify contact form** posting to `/pages/thank-you`, piped through a **Zapier Zap ("Mermade Merchant Applications") into a Google Sheet** (e.g. *Fall 25 Merchant Applications-River Street*). That's the entire application system.
  - ⚠️ Zapier sent an error alert on that exact Zap on Feb 24, 2025 — mid-application-window. **A silently failed Zap means applications that were submitted and never landed anywhere.** There is no way to detect this after the fact, and no way for the applicant to know. This is the strongest single argument for moving intake into a real database with a confirmation email.
  - The sheet lives in the `hello@mermademarket.com` account, not Drew's — so there's no shared source of truth either.
- **18 journal posts** (Feb 2022 – Jul 2025), 9 of them "Meet the Maker" vendor profiles. These are the only real SEO asset and must be redirected 1:1 on migration.

**Read that again: you are paying Shopify to run a website that sells nothing, and the "MM##" collections are vestigial.** There is no migration risk here worth worrying about. This is about as clean an exit off Shopify as exists — 13 pages, 18 blog posts, one form, no orders, no customers, no products, no apps of consequence.

---

## 2. The vendor lifecycle today, end to end

```
DISCOVER          Instagram post → "Apps open Sep 7"
   ↓
APPLY             Shopify contact form. No fee. 14-day window.
                  Applicants with no web/social presence email photos
                  to hello@ or hillary@ with a specific subject-line format.
   ↓
JURY              Manual review of an email inbox. Categorize New /
                  Repeat / Needs-improvement. 1–3 makers per category.
                  Decision by an announced date (e.g. "roster announced March 17").
   ↓
ACCEPT            Email + invoice. Payment due within 36 HOURS or the
                  space goes to the waitlist.
   ↓
PREP              Vendor tags every item "MM34 $15" by hand.
                  Lookbook pages set display expectations.
                  Food vendors chase county health permits separately.
   ↓
LOAD IN           Thu 1–7pm staggered. $100 late fee after 6pm, barred after 7pm.
   ↓
SELL              Indoor: staff ring everything at one register, reading tags.
                  Outdoor: vendor's own Square/whatever. Mermade sees nothing.
                  ("this is the only place sales are tracked" — Hillary, Dec 2025)
   ↓
TALLY             Manual reconstruction of who sold what, from tags.
                  Deductions applied: $100 bad labels, $20 no jewelry boxes.
   ↓
REPORT            A per-vendor sales report emailed out one at a time
                  ("Moonchylde: Sales Report! Winter'25").
   ↓
PAY               Vendor emails back who to make the check out to.
                  Paid individually by Venmo, Zelle, or paper check,
                  by hand, one vendor at a time, over days.
```

**Where the time goes:** jurying a spreadsheet, chasing photos, chasing payment inside a 36-hour window, chasing health permits, reconstructing the sales tally, emailing 40 individual sales reports, and then Venmoing 40 people one at a time. Every one of those is a database problem being solved by a human with an email client.

**Note on the payout leg specifically:** Venmo and Zelle are consumer P2P rails. Used to pay ~40 business vendors a share of revenue, every show, they give you no payment record tied to a statement, no 1099 trail, no reconciliation, and — per the vendor-facing "how to spot a bad market organizer" checklists that circulate in maker communities — **"demands untraceable P2P payment" is literally on the scam-warning list.** You're doing nothing wrong; you just look, to a first-time vendor, exactly like the thing they've been told to avoid. Moving to Stripe Connect fixes the operational load *and* the trust signal at the same time. It's also the single clearest "this business is professionally run" artifact a buyer will see.

---

## 3. The holes

Ranked by what actually costs you money, legal exposure, or sale price.

### 🔴 SEVERITY 1 — Legal & financial exposure

**1.1 — Seller's permit verification is missing, and California fines the *operator* for it.**
> **Update, Aug 19:** Drew confirms permits have **never** been collected except from food vendors. The exposure is concentrated on the **outdoor track** — those vendors sell for themselves at your event, which is squarely the Publication 111 fact pattern. At ~75 outdoor vendor-days per show, that's the number to worry about. Indoor is largely covered by Mermade remitting as retailer of record, but collect permits there too — it costs nothing and it's the record you'd want in an audit.

CDTFA **Publication 111** (Operators of Swap Meets, Flea Markets, or Special Events) puts an affirmative duty on the *operator* to obtain and retain, for at least 4 years, written records of every seller at the event: name, address, ID, description of items sold, and **either a valid seller's permit number or a documented reason they don't need one**. The penalty for allowing a seller to operate without a valid permit runs **up to $1,000 per seller**.

Nothing on the current application asks for a seller's permit number. At ~100 merchants per show, worst-case exposure is six figures per show. The Rose Bowl Flea Market — the biggest operator in the state — makes the permit mandatory in its premium zones and requires CDTFA form **410-D** ("occasional seller") everywhere else. That is the standard you should be meeting.
→ **Fix:** permit number or 410-D is a required field on the application, verified against CDTFA's lookup, stored with the vendor record, blocking booth confirmation. This is a two-hour build and it closes a five-figure-plus risk.

**1.2 — Who is the retailer of record on the indoor floor, and what's the tax base?**
> **Update, Aug 19:** Drew confirms **Mermade does pay sales tax.** That's the good answer and it's consistent with Mermade being the retailer of record on the indoor floor. Two things still need pinning down: **(a) the base** — is tax remitted on 100% of indoor gross, or only on the 20% commission? It must be gross; if it's been the commission, there's an accrued underpayment worth quantifying now rather than at diligence. And **(b) the 1099 consequence** — if Mermade is the retailer paying consignors, indoor payouts are likely 1099-NEC/MISC, not 1099-K, which changes how Stripe Connect gets configured. The original analysis below stands as the framing for that conversation.

Mermade runs one register and rings up every indoor sale. That is not the Pub 111 fact pattern (which assumes each vendor sells for themselves); it's much closer to consignment retail, where **Mermade is the retailer** and owes CA sales tax (Dana Point rate ~7.75%) on 100% of indoor gross. Separately, California's **Marketplace Facilitator Act** (Rev. & Tax Code §6041+) defines a "marketplace" as "a physical or electronic place" and includes "processing payment on behalf of the seller" among facilitation activities — read literally, centralized checkout can trip it. CDTFA has published no guidance applying the Act to a physical pop-up.

I do not know what you're doing today. There are only three possibilities and two of them are bad:
- You're collecting and remitting on indoor gross → fine, and the platform should automate it.
- Indoor prices are tax-inclusive and you're remitting out of the 20% → workable but needs to be documented.
- Nobody is remitting on indoor sales → an accruing liability that a buyer's diligence will find.

→ **Fix:** one conversation with a CA sales-tax CPA, this month, before the November show. Then the platform computes and books tax per transaction. **This is the #1 item on the open-questions list.**

> **Update, Aug 25 — this is less open than I made it sound, and the regulation is squarely on point.**
>
> **Cal. Code Regs. tit. 18 §1569:** *"A person who has possession of property owned by another, and also the power to cause title to that property to be transferred to a third person without any further action on the part of its owner, and who exercises such power, **is a retailer** when the party to whom title is transferred is a consumer."*
>
> **CDTFA Publication 114 (Consignment Sales)** restates it as a two-part test — you are the retailer when you *"have possession or control of the item you are selling"* **and** *"can transfer ownership or use of the item to the buyer without further action on the part of the owner"* — and its worked example is a jewelry store selling consigned jewelry.
>
> Indoor Mermade meets both prongs on its face: you hold the goods, you ring the sale, the maker is not in the building. Three consequences:
>
> 1. **The base is gross, not commission** — that answers (a). Tax is on 100% of the indoor retail price.
> 2. **Indoor makers need no seller's permit for your sales.** You are the seller. That narrows §1.1's exposure to the **outdoor** track, where vendors sell for themselves and Publication 111 governs.
> 3. **The 1099 fork in §1.5 likely resolves to "no 1099 at all."** IRS instructions for Forms 1099-MISC and 1099-NEC exclude *"payments for merchandise,"* which is why consignment shops generally don't 1099 consignors.
>
> Still buy the CPA hour — the characterisation is load-bearing, and if the base has historically been the commission there's an accrued underpayment to quantify. But go in with an answer to test rather than a question to explore. Citations in `11-AGREEMENT-RESEARCH.md` §11.

**1.3 — No certificate of insurance requirement surfaced anywhere.**
> **Update, Aug 19:** Drew wants one. Also relevant: **Mermade already carries its own event GL policy** (produced for the River Street landlord in Sept 2025, including a waiver of subrogation), and that landlord's asset manager asked directly — *"Does your policy cover all participating vendors? If so, please have that language added."* That question is the whole decision. Ask your broker whether vendors can be added as additional insureds under the existing policy for a premium delta; if the delta is small, **bake it into the booth fee** rather than requiring ~100 individual COIs. Separately, an **event cancellation** policy was quoted in March 2026 — worth closing given the Nov 2025 rain postponement (see 2.8).

Nothing in the application, the indoor rules, or the outdoor rules requires vendor general liability insurance naming Mermade and the venue as additional insured. Meanwhile the site *disclaims* responsibility for lost/damaged goods — a disclaimer is not insurance. One customer tripping on a vendor's display, one food vendor incident, and the market's own policy (if any) absorbs it.
Junk Bonanza bundles liability coverage into the booth fee. Most juried shows require a COI. You require neither.
→ **Fix:** COI upload with expiration tracking, required before booth confirmation. Or negotiate a blanket vendor policy and bake the cost into the fee — that's a nicer vendor story and a differentiator.

**1.4 — There appears to be no signed vendor agreement.**
Terms are scattered across `/pages/merchant-application`, `/pages/indoor-merchants`, `/pages/outdoor-merchants`, and the FAQ. Nobody signs anything. Every consequential term you rely on — 20% commission, $100 label deduction, $20 jewelry deduction, "all spaces nonrefundable," "no refunds if you must cancel," the 30% weather reimbursement, the 36-hour payment window, loss disclaimers — is enforceable only to the extent a vendor agreed to it, and right now they agreed by *not reading a web page*.
→ **Fix:** one Vendor Agreement, versioned, e-signed at application, with the specific show's terms merged in. Store the signed version + timestamp + IP against the vendor record. This is also a straight-up diligence checklist item at sale.

**1.5 — 1099 reporting for indoor vendors.**
You pay 40-ish people a share of sales revenue every show. That's reportable. Under Stripe Connect, Stripe becomes the filer of record and can issue 1099-K/NEC/MISC — but *which form* depends on whether indoor is legally consignment (you're the retailer paying a consignor) or facilitation (they're the retailer, you're the processor). Same fork as 1.2. Note also the OBBBA restoration of the $20,000 / 200-transaction 1099-K threshold in 2025 — but card-payment transactions under IRC §6050W historically have no de minimis threshold, so don't assume small vendors are exempt.
→ **Fix:** same CPA conversation. Then let Stripe file.

### 🟠 SEVERITY 2 — Operational fragility

**2.1 — Indoor sales attribution is a manual, lossy, adversarial process.**
`MM34 $15` handwritten on a tag, read by a cashier under pressure, at a single register, for three days, across ~40 vendors and thousands of items. There is no SKU, no barcode, no item-level record. The $100 label-noncompliance deduction exists because the system *cannot function* without perfect vendor compliance — you've converted an engineering problem into a penalty regime pointed at your own vendors.

Consequences you're eating right now: no real-time sales visibility (for you or the vendor), no per-item or per-category data, no way to tell a vendor what actually sold, misreads that silently pay the wrong vendor, no returns handling, and a multi-day reconciliation before every payout. It also caps the indoor floor — you cannot grow past ~45 vendors on one register with tag-reading.

The mature version of this exists and is well-trodden: antique malls and vendor collectives run exactly this model on **ConsignCloud/SimpleConsign + a scanner**, where every item carries a barcode encoding vendor + SKU + price, scanning attributes revenue instantly, and payout math is automatic. One operator quote from a ConsignCloud case study: *"I uploaded 50 new SKUs from home last night, and by the time I drove to the store this morning, my items were already in the system."*
→ **Fix:** vendor uploads inventory → system generates SKUs → vendor prints Avery-format label sheets with a scannable code → central register scans. This is the highest-ROI single change in the entire project. Detailed in `04-PAYMENTS-AND-POS.md`.

**2.2 — Single point of checkout failure.**
One register, three days, ~$100k+ of indoor gross at stake, on venue wifi. No documented fallback. If the network drops during Saturday morning peak, what happens?
→ **Fix:** offline-first POS (local catalog cache + queued transactions), a dedicated cellular router rather than venue wifi, at least 2 registers + 1 cold spare, and a written degradation procedure. Stripe Terminal's offline mode has real teeth but real limits — reader must have been online within 24h, same local network, $10,000 cap per transaction, and **you own 100% of the decline risk**.

**2.3 — The 36-hour payment window is a self-inflicted wound.**
It's the tightest window of any comparable show I found (West Coast Craft gives 48 hours; most give days). It generates chase work for you, anxiety for vendors, and forfeited spaces you then have to backfill from the waitlist — all so that a manual invoicing process doesn't drag. With instant online payment on acceptance, the window can stay tight *and* stop costing anyone anything.

**2.7 — The payout process is the most fragile thing in the business.**
Manual tally → individually emailed sales reports → vendor emails back a payee name → Venmo/Zelle/check, one at a time, gated on someone having time and cash on hand to do 40 of them. Every step is a place a vendor gets paid late, twice, or the wrong amount, and none of it produces a record you could hand an accountant or a buyer. This is Phase 5 of the build and it's the module with the highest ratio of pain removed to code written.

**2.4 — Everything lives in one head.**
Curation judgment, vendor relationships, the tally, the layout, the standards — all undocumented. That's the definition of key-person risk, and it's the thing that most reliably knocks a multiple off a small business at sale.

**2.5 — No structured vendor history.**
"We don't *want* to accept our old vendors a million times" is a curation philosophy that requires knowing who's been in, how they performed, and how they behaved. Right now that's memory and old email. There is no per-vendor record of shows attended, sales, penalties, complaints, or scores.

**2.8 — Venue instability is the quiet structural risk.**
Three venues in three shows: Ocean Institute → River Street Marketplace (Fall 2025) → Dana Point Community House (Spring and Fall 2026). Fall 2025 was also **postponed from mid-November to Dec 5–7 for rain**, and Hillary's own read afterward was *"we had a couple things working against us — new location & the postponement."* Meanwhile the Community House raised rates when their fiscal year turned on 5/31/26 and **declined to book beyond a year out**, so you can't lock rates or dates on a multi-year horizon.

Three consequences worth naming:
- **Attendance doesn't compound** when the location changes every cycle. Your 6,000 repeat attendees have to relearn where you are, and third-party listings (Yelp, press, Dana Point Harbor) still point at the Ocean Institute.
- **A buyer will price venue risk.** "Twice-yearly market with no secured venue beyond 12 months" is a real discount. A multi-year venue agreement is one of the highest-leverage things you could do for sale value, and it costs nothing but negotiation.
- **Weather is an uninsured single point of failure.** You quoted event cancellation insurance in March 2026 and, as far as I can tell, didn't bind it. After a rain postponement that measurably hurt a show, that quote is worth revisiting — and it's a diligence checkbox.

**2.6 — Venue discrepancy in the wild.**
Press and Yelp still list the Ocean Institute; the site says Community House. Attendees are being sent to the wrong place by third-party listings.

**2.7 — Season pages orphaned.**
`fall-2025-merchants` and `spring-2025-merchants` resolve but aren't in the sitemap. Past-show archives are a genuine SEO and social-proof asset — every one of those vendor names is a searchable term and a backlink opportunity.

### 🟡 SEVERITY 3 — Revenue and positioning left on the table

**3.1 — No application fee.** "No Application Fee! No Entrance Fee!" is currently framed as generosity. It's also why you get an unfiltered inbox. Every peer charges one: Renegade Craft **$35**, West Coast Craft **$25**, Patchwork Show charges a fee but *refunds the booth fee* if you're rejected. At ~600 applications a year, a $20 fee is ~$12,000 of pure margin that also raises applicant quality. The tradeoff is real — it's a brand promise you'd be walking back — so treat it as a decision, not a recommendation.

**3.2 — Zero online revenue between shows.** Two shows a year means ~6 days of revenue and 359 days of nothing. You already have the ingredients for a year-round marketplace and haven't used them: 17k Instagram followers, 10k email subscribers, and — once 2.1 is built — a fully SKU'd catalog of every indoor vendor's inventory sitting in your database. A post-show "shop the market" storefront on the same commission is close to free once the inventory system exists.

**3.3 — Sponsorships are a page, not a program.** `/pages/collaborate` cites the audience numbers but there's no rate card, no inventory of placements, no past-sponsor proof. 4,000–5,000 affluent OC attendees over three days is a legitimately sellable audience.

**3.4 — No ticketing, ever.** Free entry is core to the brand and I would not change it. A paid **early-access hour** (Friday 8–9am, capped, $25) is the standard way to monetize without touching the free promise — and it's a recurring-revenue line item a buyer will value. Test it once.

**3.5 — The waitlist isn't monetized or managed.** "Late applicants may not hear from us at all" is a leak. A managed waitlist with automatic backfill on forfeiture converts your 36-hour-window losses into revenue.

### 🔵 SEVERITY 4 — Exit readiness (the "institutional" goal)

You said you want the site to feel institutional because you may sell in a few years. The site is the smallest part of that. What a buyer actually diligences:

| What they'll ask for | What you have today |
|---|---|
| 3 years of clean revenue by segment (indoor commission / outdoor booth / other) | Reconstructable, painfully, from bank records |
| Vendor retention & churn cohorts | Not tracked |
| Attendance data, by day, over time | Self-reported estimates |
| Signed vendor agreements | None found |
| Sales tax compliance history | Unknown — see 1.2 |
| Documented SOPs so the business runs without the founder | In her head |
| Transferable IP: brand, domain, list, platform | Brand & list yes; platform is Shopify's |
| Recurring / diversified revenue | Two events a year, one venue, one market |
| Customer + vendor database with consent | Email list; no vendor DB |

Every 🔴 and 🟠 above is also a diligence finding. **The platform you're about to build is not primarily an efficiency project — it is the mechanism that converts an owner-operated event into a transferable asset with data behind it.** That's the framing I'd hold onto, and it should drive prioritization: instrument everything, store everything, sign everything.

---

## 4. What's genuinely good and should not be touched

Worth naming, because a redesign can easily destroy it:

- **The curation itself.** "1–3 makers per category," "we don't want to accept our old vendors a million times," rejecting 13 of 15 leather applicants. That discipline is the entire product and the reason 6,000 people come back.
- **Free entry.** Do not put a paywall on the front door.
- **The lookbook pages.** `/pages/indoor-lookbook` and `/pages/outdoor-lookbook` enforcing "vertical space is everything," "tables are a cop-out," "Required: a BACKDROP!" — this is why the floor photographs well, which is why Instagram works, which is why attendance works. Most markets have nothing like it. Make it *more* prominent, not less.
- **The indoor no-vendor-present format.** Genuinely differentiated. "Pressure-free" browsing with baskets is a better shopping experience than 40 makers making eye contact with you, and it's why the 20% is defensible.
- **The Meet the Maker journal.** 9 posts of real vendor storytelling. Underused, not broken.
- **"Shop small. Think Big."** Keep it.

---

## 5. Recommendations, in priority order

1. **Book the CA sales-tax CPA conversation this week.** Nothing else in this document can be correctly built until you know whether Mermade is the retailer of record indoors. (§1.2, §1.5)
2. **Add seller's permit / CDTFA 410-D and COI to the application, and put a signed vendor agreement behind it.** Ships with Phase 1. Closes §1.1, §1.3, §1.4.
3. **Build item-level inventory + scannable tags for indoor.** Single highest-ROI change. Kills the manual tally, the penalty regime, and the growth ceiling in one move. (§2.1)
4. **Move applications into a real database with a jury pipeline before September 7.** (§2.3, §2.5)
5. **Instrument everything from day one** — sales by vendor/item/hour, attendance, applications by category, acceptance rates, retention. Three years of this is worth real money at sale. (§4)
6. **Then** redesign the public site. It's the most visible piece and the least urgent.
7. **Decide on the application fee** as a deliberate business call, not a default. (§3.1)
8. **Post-show, turn the SKU catalog into a year-round storefront.** (§3.2)

---

*Sources: mermademarket.com (sitemap, `/pages/merchant-application`, `/pages/faq`, `/pages/indoor-merchants`, `/pages/outdoor-merchants`, `/pages/schedule`, `/pages/collaborate`, `/pages/spring-2026-merchants`, `/blogs/journal/`); CDTFA Publication 111; CDTFA Marketplace Facilitator Act guide; Stripe Connect, Terminal, and pricing documentation; Renegade Craft, West Coast Craft, Patchwork Show, Junk Bonanza, and Rose Bowl Flea Market vendor prospectuses; ConsignCloud and SimpleConsign product documentation; NBC Los Angeles (2024); Orange Coast Magazine (2019).*
