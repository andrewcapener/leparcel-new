# Open Questions & Decisions

Grouped by who has to answer and how badly it blocks the build.

---

> **Answered as of Aug 19, 2026** — struck through below where resolved:
> - **Show dates + venue:** ✅ Nov 12–15, 2026, Dana Point Community House. Contract signed, deposit sent.
> - **Sales tax:** ✅ Mermade does pay it. Narrowed follow-ups in Q2.
> - **Seller's permits:** ✅ Never collected except food vendors. Outdoor track is the exposure.
> - **COI:** ✅ Wanted. Decision narrowed to blanket-policy-vs-individual in Q7.
> - **Payout method:** ✅ Venmo / Zelle / check, individually, after an emailed per-vendor sales report.
> - **Application system:** ✅ Shopify contact form → Zapier → Google Sheet in the `hello@` account.

## 🔴 Blocking — needed before Phase 1 ships

### 0. Send me the actual application ⬅ **new, and the fastest way to sharpen this spec**
I've read the application *page* — pricing, rules, deadlines, the "what we look for" copy. I have **not** seen the form fields or a single submission, because the form is a Shopify contact form (its inputs don't render to a fetch) and the responses land in a Google Sheet in the `hello@mermademarket.com` account, not yours.

Any one of these unblocks it:
- A share link to the applications Google Sheet (headers alone are enough — the columns *are* the form)
- A screenshot of the live form
- One forwarded submission email, with the applicant's details scrubbed

With that, the application schema and the jury card get rebuilt around the questions you actually ask — including the ones I'd never guess, which are usually the ones that carry the curation judgment.

### 1. Application dates
The site says *"Applications open late August for our Mid November show!"* Instagram says *"Apps open Sep 7!"* These are two different sprints. **Which is it, and what are the exact open/close/announce dates?** Also: exact show dates and hours per day.

### 2. Sales tax — narrowed
✅ Mermade pays sales tax. Two things left, both for the CPA:
- **What's the base?** Remitted on 100% of indoor gross, or only on the 20% commission? It should be gross — Mermade's register rings the sale, so Mermade is the retailer of record. If it's been the commission, quantify the accrual now; that's a diligence finding you want to have already fixed, not discovered.
- **Is tax added at the register or are vendor prices tax-inclusive?** Determines whether the POS adds a line or backs tax out of the tag price, and it has to match what vendors are told when they price their items.
- **Consequence for 1099s:** if Mermade is the retailer paying consignors, indoor payouts are likely **1099-NEC/MISC, not 1099-K** — which changes how Stripe Connect gets configured. Ask this in the same call.

### 3. Do you have a signed vendor agreement?
Or are the terms only on the website? If a vendor disputed the $100 label deduction or the "no refunds" policy tomorrow, what would you show them? If there's an existing agreement, send it — we version it and e-sign it in the new flow. If there isn't, we need one drafted before applications open.

### 4. How are indoor vendors paid today?
Check, Venmo, Zelle, ACH? Affects what changes for vendors and how we message the Stripe transition.

### 5. Venue for fall 2026
Community House or Ocean Institute? Press, Yelp, and the Dana Point Harbor listing still point at the Ocean Institute. Also: what's the wifi situation, is there wired ethernet anywhere near the register, and what's cell reception like inside?

---

## 🟠 Business decisions — needed before Phase 1, but they're yours to make

### 6. Application fee — introduce one?
Every comparable show charges one: Renegade $35, West Coast Craft $25, Patchwork charges a fee and refunds the booth fee on rejection. You currently advertise **"No Application Fee! No Entrance Fee!"** as a brand promise.

- **Keep it free:** stays on-brand, maximizes applicant pool, but you keep jurying an unfiltered inbox.
- **Charge $20–25:** ~$12k/year of margin at your volume, meaningfully raises applicant quality, and it's what the market expects — but it's walking back a stated promise.
- **Middle path:** free for returning vendors, $20 for new. Or free, but a $25 *waitlist deposit* credited to the booth fee.

The system supports any of these (`shows.application_fee_cents`). It defaults to 0.

### 7. Certificate of insurance — require it?
Right now nothing requires vendor liability insurance and the site disclaims responsibility for damage. Options:
- **Require a COI** naming Mermade + venue as additional insured. Standard at juried shows. Adds friction and a vendor cost (~$50–200/yr).
- **Buy a blanket vendor policy** and bake the cost into the booth fee. Junk Bonanza does exactly this. Better vendor story, better margin story, one policy to manage.
- **Do nothing.** Not recommended — see `00-BUSINESS-AUDIT.md` §1.3.

### 8. Payment window
Currently **36 hours**, the tightest of any show I looked at. With instant online payment the pressure to keep it that tight disappears. I'd set **48 hours**. Your call — it's a per-show setting.

### 9. Payout timing
Currently stated as both "7–10 days" and "within one week" on different pages. Pick one and say it in business days. I recommend **10 business days**, because it keeps money in your balance through the return window (see `04` §8 — refunds hit *your* balance, and you can't claw back from a vendor you've already paid).

### 10. Vendor sales visibility during the show
The system can show indoor vendors their sales live. That's a strong retention feature — right now they sit at home for three days knowing nothing. But it also means they'll be watching, texting you about slow mornings, and comparing. Do you want it live, delayed to end-of-day, or off for the first show?

### 11. Commission rate and structure
Indoor is a flat 20%. Do you want the ability to vary it — by category, by vendor tier, by returning-vendor status? The schema supports per-booking rates. Say the word and it becomes a form field instead of a constant.

### 12. Does the $100 label penalty survive?
Once labels are system-generated PDFs the vendor prints at home, non-compliance mostly stops being a thing. The penalty exists because the manual system can't function without perfect compliance. I'd drop it to a $25 handling fee for items that arrive genuinely untagged, and delete the $20 jewelry-packaging deduction entirely (make it a checklist item instead). Penalties pointed at your own vendors are a bad look in a business you're trying to sell.

### 13. Application fee / booth fee refunds on rejection
Patchwork Show collects the booth fee up front and refunds within 7 business days if you're rejected — which guarantees the accepted vendor has already paid. Yours collects after acceptance in a 36-hour panic. Worth considering the swap.

---

## 🟡 Product decisions — needed before Phase 2–4

### 14. Outdoor vendor sales — do you ever want visibility?
Today they run their own payments and you see nothing. Options if you ever want the data: require them to use a Mermade-issued reader (rejected by most vendors), ask them to self-report at close (soft, unreliable), or leave it alone. I'd leave it alone — but if you're ever thinking about moving outdoor to a commission model, the data is the prerequisite, and you'd want to start collecting self-reported numbers now.

### 15. Returns policy at the register
What happens today when a shopper wants to return something on Sunday? Is it "all sales final"? If returns exist, what's the window, and does the vendor eat it or does Mermade? This determines whether refunds hit statements or your P&L.

### 16. Cash at the register
What % of indoor sales are cash today? Affects drawer procedure, reconciliation, and whether cash-handling variance matters.

### 17. Number of registers and staffing
One lane or two? Two lanes roughly halves peak queue and doubles hardware and staffing. At 4,000–5,000 attendees over three days, I'd plan two plus a spare.

### 18. Junior Makers (14 & under)
They can't legally hold a seller's permit or complete Stripe KYC. How do they get paid today — to a parent? The system needs a "paid via guardian" path with the guardian's Connect account and W-9.

### 19. Shared spaces
Two vendors sharing one booth — currently a $100 add-on. Whose SKUs? One statement or two? One payout or two? The clean answer is two vendor records, two statements, one shared space assignment. Confirm that matches how it actually works.

### 20. Food and treat vendors
Treats sell through the indoor register with a $10 item cap. Do they get SKU'd and labeled like everything else, or do they need a different flow (weighed items, made-to-order)? Food trucks presumably take their own payment — confirm.

### 21. Restocking mid-show
Current rules let vendors restock in slow afternoons. In the new system, does restocking mean adding quantity to existing SKUs (they bring pre-printed labels — easy) or adding new items mid-show (needs an on-site label printer — harder)? I'd require pre-printed labels only.

### 22. Content editing scope
`01-PRODUCT-SPEC.md` §9 gives Elise structured settings plus a constrained block editor, deliberately not a free-form page builder. Does she want to create genuinely *new* pages, or just edit the ones that exist? If the former, we add Payload CMS in Phase 2 — it's not hard, but I'd rather not add it speculatively.

---

## 🔵 Access & assets — needed for Phase 0/1

- Domain registrar + DNS access
- Shopify admin (to export the journal, and to cancel — what plan, what renewal date?)
- Google Analytics / Search Console
- Email platform (who sends to the 10k list? Shopify Email, Klaviyo, Mailchimp?)
- Instagram + Facebook (for launch coordination, not integration)
- Logo files — vector, ideally
- Licensed fonts, if any
- Photo library from past shows, at full resolution
- Existing vendor list / any spreadsheet of past vendors — this seeds the vendor database and preserves history
- Any past sales data at all, even messy, for baseline reporting
- Business entity name and address for the vendor agreement and Stripe
- Who else needs staff logins, and at what role?

---

## ⚫ Strategic — no rush, but worth thinking about

### 23. The exit
You said a possible sale in a few years. That should shape what gets instrumented now, because a buyer pays for evidence. From `00-BUSINESS-AUDIT.md` §4, the things worth starting *this show*: revenue by segment, vendor retention cohorts, real attendance counts, signed agreements, and documented SOPs. Three years of that data is worth materially more than a nicer website. If a sale is real, tell me the rough horizon and I'll weight the roadmap toward diligence readiness.

### 24. Year-round revenue
Two shows a year is ~6 revenue days out of 365. Once inventory is SKU'd, a post-show online storefront on the same 20% is close to free to build, and you already have 17k Instagram followers and 10k email subscribers to sell into. Is that interesting, or does it dilute the scarcity that makes the show work? Genuine question — scarcity is part of the product.

### 25. A third show
Mid-November and May leaves a big gap. A smaller summer or holiday pop-up is the obvious lever, and a buyer values three shows more than two. Constraint is presumably venue and Elise's bandwidth — which is exactly what this platform is supposed to free up.

### 26. Sponsorships
`/pages/collaborate` cites the audience numbers but there's no rate card, no placement inventory, no past-sponsor proof. 4,000–5,000 affluent OC attendees over three days is a sellable audience and it's high-margin revenue that doesn't scale with vendor count. Worth a real program.

### 27. Paid early access
Free entry is core and I wouldn't touch it. A capped, ticketed **Friday 8–9am early hour** at $25 is the standard way to monetize without breaking the free promise — and it's recurring revenue a buyer will price in. Worth one test.

---

## Application field gaps against the live Shopify form (found 5 Sept 2026)

Their live application is a Globo Form Builder form on mermademarket.com. Its
field list was read out of the page's own config and compared with
`applications` and `vendors` in `src/db/schema.ts`. Everything below is
collected today and is not captured by our form. Ranked by what it costs.

1. **Zelle / Venmo handle.** Their form asks for it, required, on every
   application. Indoor is consignment: Mermade owes 45 makers money after the
   show, payouts are manual, and without this staff chase every one of them
   for a handle in the week the money is due. This is the one to close first.
   It is PII adjacent, so it belongs on `vendors`, is never rendered to the
   jury, and never appears in a log or an error.
2. **TFF permit number.** Their form asks food makers for an annual Temporary
   Food Facility number from the OC Health Agency. We have a generic
   `seller_permit`, which is a different document for a different purpose. A
   food maker without a TFF number cannot legally sell, so this is a load-in
   blocker, not a nicety.
3. **"How will your space be different."** A curation question, and the jury
   is the audience for it. We collect `description` and price band; this asks
   the maker to describe the display, which is what the room actually looks
   like.
4. **Street address and zip.** We keep city and state. They keep the full
   address, which is what an invoice and a mailed cheque need.
5. **Outdoor waitlist opt-in.** Their form has an explicit "outside merchant
   waitlist" box. Ours has no way for a maker to say "put me on the list if
   the day I want is full", so that intent is lost.
6. **Merstaff opt-in.** Their form asks whether the maker wants to work the
   event. Small, but it is free labour they are currently collecting and we
   are not.
7. **Six separate acknowledgements.** Theirs has six `acceptTerms` boxes, one
   per clause. We record one `signed_name` and a `terms_version`. Which shape
   we want is a question for counsel, not a guess: see
   `docs/10-VENDOR-AGREEMENT.md`, still unreviewed.

Each of 1 through 6 needs a forward-only migration and a matching field on
`ApplyForm`. None of them were added in the pass that found them, because the
form was being reworked at the same time and a silent field-name change breaks
the server action that parses it.
