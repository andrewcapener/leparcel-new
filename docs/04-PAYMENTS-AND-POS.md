# Payments, POS & Payouts

Everything here is verified against Stripe's docs as of **August 2026**. Where something is genuinely unresolved (mostly California tax), it's flagged rather than guessed.

---

## 1. Answering your questions directly

> **"I wanna pay everybody through Stripe. Isn't that the best way to do it?"**

Yes — with one correction to how you're picturing it. Vendors don't "set up a Stripe account" the way you'd think of signing up for Stripe. They complete an embedded **Stripe Connect Express** onboarding inside your vendor portal: name, DOB, address, last-4 SSN, bank account. Five to ten minutes. They never see a Stripe dashboard beyond a lightweight balance view. You control payout timing entirely.

> **"I hope Stripe has a POS."**

Partly. Stripe sells the **hardware** (Terminal readers) and the **SDKs**, but there is **no first-party Stripe POS app** that does carts, line items, and multi-vendor attribution. Stripe's only no-code in-person options are Tap to Pay from the Stripe Dashboard app (one amount, no cart) and "standalone mode" on the S700/S710 (keyed amount, no cart). **For what you need — scan a tag, attribute to a vendor, take a card — you build the POS UI yourself on the Terminal SDK.** That's a real build, and it's the single biggest reason the November show is the right target rather than next week.

> **"I do wanna make sure on this first one that we approve those commissions."**

That's exactly how it should work, and it's natively supported. Money sits in your Stripe balance until *you* create the transfer. Nothing moves until a human clicks approve.

---

## 2. Money flow — the actual design

### 2.1 Booth fees & application fees (money in)

Plain Stripe Payment Intents on the Mermade account. Card + ACH (`us_bank_account` — **0.8% capped at $5**, so on a $450 outdoor booth that's $5 instead of $13.35 — offer it and default to it for larger booths).

Vendor accepted → pay link → PI → webhook `payment_intent.succeeded` → booking `confirmed`. Never mark paid from the browser.

### 2.2 Indoor sales at the register (money in, then out)

**Pattern: separate charges and transfers.** Not destination charges. This is the only pattern that supports a single customer swipe covering four different vendors' items, with commission retained, and payout deferred until you approve.

```
Customer buys 4 items from 3 vendors — one $180 card swipe
        │
        ▼
  ONE PaymentIntent on the Mermade platform account, $180
  transfer_group = "fall26_sale_<sale_id>"
        │
        ▼
  $180 lands in Mermade's Stripe balance and STAYS THERE
  (there is no time limit on holding platform balance before transfer)
        │
     ... show ends, statements generate, you review, you approve ...
        │
        ▼
  Transfer  → vendor A connected acct   $52.00  (their $65 gross − 20%)
  Transfer  → vendor B connected acct   $36.00
  Transfer  → vendor C connected acct   $56.00
  Retained by Mermade                   $36.00  commission
```

The commission is never "collected." You simply transfer less than 100%. No `application_fee_amount` needed in this pattern.

Per-sale transfers would be thousands of API calls and thousands of $0.25 payout-fee events. **Transfer once per vendor per show, at statement approval.** One transfer, one number, one thing to reconcile — and it matches how the vendor thinks about it ("what did I make at the show?").

### 2.3 Approval gate

Two levers exist; you need the first, and I recommend against the second for v1:

- **Lever 1 (use this): don't call `transfers.create` until approved.** The approve button in `/admin/payouts` *is* the gate. Simple, obvious, auditable.
- **Lever 2 (skip in v1): `payouts.schedule.interval = manual`** on each connected account, so money also can't leave Stripe for the vendor's bank without a second explicit call. This adds a second checkpoint but also adds a support burden — vendors see a balance sitting there and email you asking where their money is. Leave connected accounts on the default automatic schedule; your transfer timing is the control.

The exception: if you want a clawback window after approval (late refund, discovered error), lever 2 buys you that. Decide after the first show, when you know your actual error rate.

### 2.4 Outdoor vendors

No money flows through you at all. They pay a booth fee and run their own Square. Do not build them into the payout pipeline — resist the temptation to "unify" the two tracks.

---

## 3. Connect configuration

**Account type: Express.**

Under Stripe's current controller-properties model this means:
- `controller.losses.payments = application` — **you** eat negative balances from refunds/chargebacks. Required for you to control payout timing and pause payouts.
- `controller.fees.payer = application` — you pay processing fees (they come out of your 20%, which is how the economics should work anyway).
- `controller.requirement_collection = stripe` — Stripe chases vendor KYC, not you. Worth a lot at 40 vendors.
- `controller.stripe_dashboard.type = express` — vendors get a light dashboard, not a full one.

**Why not Standard:** vendor owns loss liability but you lose payout-timing control. **Why not Custom:** you'd have to build every piece of onboarding UI yourself. Express is the right answer and it isn't close.

**Onboarding UX:** embed Connect onboarding directly in the vendor portal checklist step 6. Vendor never leaves your domain except for Stripe's hosted flow.

**Vendors who don't finish:** account sits `restricted`, `payouts_enabled = false`. The system must:
- Show the vendor exactly what Stripe is still asking for (`requirements.currently_due`)
- Block statement approval for that vendor (invariant #4 in the data model)
- Escalate to staff at T-7 before the show
- Have a documented manual fallback (paper check) for the vendor who simply won't complete it — because at 40 vendors, one won't

**Timing:** open Connect onboarding at acceptance, not at show time. Some vendors need Stripe to review ID documents, which can take a day or more. Two weeks of runway minimum.

---

## 4. The POS

### 4.1 Hardware

| Reader | Price | Notes |
|---|---|---|
| **Stripe Reader S700** | **$299** | Smart reader, WiFi + Ethernet dock, offline capable, standalone mode. **This is the pick.** |
| **S710** | ~same class | Adds **cellular**. Worth the premium if the venue's wifi is bad — and at the Community House, assume it is. |
| BBPOS WisePOS E | $249 | Cheaper, no standalone mode, otherwise fine |
| Stripe Reader M2 | $59 | Bluetooth, pairs to a tablet. Good cold spare. |
| Tap to Pay on iPhone | $0 | No hardware. Good emergency backup on a staff phone. **Android has no offline mode** — iPhone only for this role. |

**Buy: 2× S710 (two lanes) + 1× S700 (spare) + 1× M2 (emergency).** ≈ $900. Order by **early October** — Stripe publishes no shipping SLA, and you want three weeks of testing, not three days.

### 4.2 Network — take this seriously

Do not run the register on venue wifi. Bring:
- A dedicated **cellular router** (Verizon/AT&T hotspot into a travel router) with its own SSID that only the registers join
- A second carrier's hotspot as failover
- Ethernet docks for the S700s where the physical layout allows — wired beats wireless every time

Stripe Terminal's offline mode has hard constraints worth knowing before you rely on it:
- Reader must have been **online within the last 24 hours**
- Must be on the **same local network** it was online on — you cannot switch networks while offline
- **$10,000 max per offline transaction**
- **You own 100% of the decline risk.** The card isn't authorized until connectivity returns. If it declines, the goods are gone and Stripe explicitly says there's no recovery.

→ Cap offline transactions in your POS logic (I'd set $300/txn and a $3,000 running accumulation before the register refuses card and demands cash), and surface `offlineStatus.reader.offlinePaymentsCount` on the admin live dashboard.

### 4.3 POS application design

Tablet PWA at `/pos`. iPad or an Android tablet, doesn't matter.

**Offline-first is the architecture, not a feature:**

```
OPEN REGISTER
  └─ pull full item catalog for the show → IndexedDB (Dexie)
     ~40 vendors × ~150 items = 6,000 rows. Trivial. Sub-second lookups.

SCAN
  └─ USB/Bluetooth HID scanner acts as a keyboard. Zero driver work.
     Barcode → local lookup → cart line. <200ms. NEVER hits the network.

TENDER
  ├─ ONLINE:  create PaymentIntent → Terminal collects → capture → confirm
  └─ OFFLINE: Terminal offline flow (within caps) OR cash
     Either way: write the sale to IndexedDB with a client-minted UUID

SYNC
  └─ Background loop POSTs queued sales to /api/pos/sync in batches.
     Server upserts on (show_id, client_uuid) → replay is a no-op.
     Badge shows queued count. Never blocks the cashier.
```

**Screen layout:** cart on the left (big, thumb-reachable), numeric/search pad on the right, running total enormous at the top. Optimized for a volunteer who got a 90-second training.

**Must-have interactions:**
- Scan, keyed SKU, and text search (a tag *will* be unreadable)
- **"No tag"** → search by vendor + description + price, or drop to `MISC` under a chosen vendor with a keyed price
- **`UNATTRIBUTED`** → keyed price, no vendor, flagged for post-show resolution. This is the pressure valve; without it, a cashier under pressure will guess a vendor and quietly pay the wrong person.
- Cart-level and line-level discounts, permission-gated, **apportioned pro-rata back across the affected lines** so commission math stays correct
- Split tender (card + cash)
- Returns by scanning the receipt QR or the SKU — reverses the *specific vendor's* ledger line
- Void, no-sale, drawer open — all logged with staff identity
- Email/SMS receipt

**Performance budget:** scan-to-cart under 200ms, offline. If the register ever spins, the line backs up and the show suffers.

### 4.4 Attribution on card-present

Because you're using separate charges and transfers, the Terminal PaymentIntent is a plain platform charge — no `on_behalf_of`, no `transfer_data`. Attribution happens in **your** `sale_lines` table, and the money split happens later at statement approval. This is deliberate: it keeps the register logic dead simple (one charge, one total) and pushes all the complexity into a batch process you can review before it moves money.

### 4.5 Dry run — non-negotiable

Two to three weeks before the show:
- 5 real vendors, real inventory, real printed labels
- Real cards, real charges, real refunds, at least one deliberate offline stretch
- Full statement generation and a real (small) payout to a real vendor bank account
- Kill the network mid-transaction on purpose and watch what happens

A POS that has never processed a real card is not a POS. Budget a full day for this.

---

## 5. Why not Square

Worth writing down because it's the obvious question:

| | Stripe Connect + Terminal | Square |
|---|---|---|
| Multi-vendor cart with per-vendor split | Native | No marketplace primitive for independent 1099 vendors |
| Automated commission + delayed payout | Native | Would require building your own ledger + ACH payouts anyway |
| Out-of-box POS app quality | You build it | Excellent, free |
| Hardware | $250–300 | $0–299 |
| Effort | High | Low for POS, high for everything else |

Square's POS is genuinely better than what you'll build in v1. But Square has no equivalent of Connect for paying independent vendors with their own tax IDs and bank accounts, so you'd end up building the ledger and the payout rail regardless — and running two payment vendors, two sets of fees, and a reconciliation between them. **One stack wins.**

The honest third option, if the November timeline gets tight: **run November on the current manual process for the register, ship everything else, and launch the POS in spring.** That's a legitimate call and it's in `05-BUILD-PLAN.md` as the fallback.

---

## 6. California sales tax — the open question

**This is the single biggest unresolved item in the project and it needs a CPA, not me.**

Two frameworks collide on your indoor floor:

**CDTFA Publication 111** (Operators of Swap Meets, Flea Markets, Special Events) assumes each vendor is their own retailer. Under it your duty is *administrative*: obtain and retain, 4+ years, each seller's name, address, ID, items sold, and seller's permit number (or a documented reason none is needed). Penalty for allowing an unpermitted seller: **up to $1,000 each.** This clearly applies to your outdoor track. **Build the permit-collection feature regardless of how the indoor question resolves** — it's cheap and the exposure is real. Collect it *at onboarding, gating load-in*, not on the application: the statutory duty attaches to renting space, and gating applications on paperwork suppresses exactly the hobbyist makers the market wants. No comparable market does it at the application stage.

**The Marketplace Facilitator Act** (RTC §6041+) defines a marketplace as "a physical or electronic place" and counts "processing payment on behalf of the seller" as facilitation. Read literally, your central register could make Mermade the facilitator — and therefore responsible for collecting and remitting on all indoor sales. CDTFA has published no guidance applying this to a physical pop-up market; every example is Amazon/Etsy/eBay.

**And the simplest reading of all:** if Mermade's register rings the sale and Mermade's name is on the receipt, Mermade looks like the retailer of record, full stop — which is the standard consignment analysis, independent of the facilitator question.

**What to do:**
1. Book a CA sales-tax CPA or attorney **this month**. One hour. Bring this document.
2. Whatever the answer, the platform stores `shows.sales_tax_bps` and `shows.tax_inclusive_pricing`, computes tax per `sale_line`, and produces a filing-ready report. Build it either way; the flag decides the behavior.
3. Structurally, stay as close to Pub 111 as you can: vendors set their own prices, own their item descriptions, own their terms. You're processing payment, not setting the terms of sale.
4. Collect permit numbers from **everyone**, indoor and outdoor, starting with the September application.

**Stripe Tax** calculates for card-present through the same Tax Calculation API as online, keyed to the Terminal Location. It computes the number; it does not answer who owes it.

---

## 7. Fees — real numbers

| | |
|---|---|
| Online card | **2.9% + $0.30** |
| **In-person (Terminal)** | **2.7% + $0.05** |
| ACH (booth fees) | **0.8%, capped at $5** |
| Connect active-account fee | **$2/mo per account that had a payout** (waived on Stripe's default pricing model) |
| Connect payout fee | **0.25% + $0.25 per payout** |
| Instant payout to a connected account | **1%**, $0.50 min |
| Stripe Tax | 0.5%/txn (no-code) or **$0.50/txn** (API); Tax Complete from $90/mo |
| Radar | $0.05/txn or from $10/mo |
| Connect 1099 e-file | $2.99/form federal, $1.49/state (free on Stripe's default pricing) |

### What this costs you per show

Assume indoor gross of **$120,000** across 40 vendors, all card:

| | |
|---|---|
| Terminal processing (2.7% + $0.05 × ~3,000 txns) | ≈ $3,390 |
| Connect payout fees (40 × ($0.25 + 0.25%)) | ≈ $310 |
| Connect active-account fees (40 × $2) | $80 |
| Stripe Tax (API, ~3,000 txns) | ≈ $1,500 *(consider the 0.5% no-code tier or Tax Complete — run the comparison)* |
| **Total** | **≈ $5,280, or ~4.4% of indoor gross** |

Against **$24,000** of commission at 20%, processing eats ~22% of your commission line. That's normal for this model, but it's a number you should be able to state — and it's an argument for pushing booth fees to ACH and for looking hard at whether you need per-transaction Stripe Tax versus a flat tier.

---

## 8. Gotchas — design for these now

- **Refunds hit *your* balance, not the vendor's.** With separate charges and transfers, a refund debits Mermade. To recover it from the vendor you must reverse their transfer — which **fails if you've already paid them and their balance is empty**. → Hold payouts at least through your stated return window, and keep a small reserve. This is the strongest argument for the 7–10 day payout timing you already use. Keep it.
- **Chargebacks on multi-vendor sales.** One disputed $180 sale covering three vendors is **one dispute against Mermade**, not three. You need internal logic to apportion it back across those vendors' statements if you intend to. Decide the policy before it happens.
- **Mid-show Connect risk holds.** A brand-new connected account with a sudden volume spike looks like fraud to a risk model. It doesn't affect the register (charges are on your account), but it can block a payout. Watch `account.updated` webhooks and have a manual path.
- **First payouts are slow.** A fresh connected account's first payout typically takes 7–14 days. Standard payouts are calculated in **business days**, so a Sunday show close means money lands the following week. Say "7–10 business days" in the vendor agreement, not "one week," and stop over-promising — the site currently says both.
- **1099 form type depends on the tax answer.** If Mermade is the retailer paying consignors, that's likely 1099-NEC/MISC. If Mermade is a facilitator, 1099-K. Stripe Connect 1099 lets you pick — but you have to know. Same CPA conversation.
- **Negative platform balance reserves.** With `losses.payments = application`, Stripe may hold a reserve against your platform balance to cover connected-account negatives, and pulls from it after 180 days if an account stays negative. Cash-flow planning item.
- **Rounding.** 20% of an odd cent amount doesn't divide evenly. Round commission **up** to the cent (house absorbs nothing, vendor is never shorted by rounding drift across thousands of lines) and assert that the sum reconciles exactly. Property-test it.

---

## 9. "Won't Stripe take a fee?" — the honest math

You currently take booth fees by PayPal, Venmo and Zelle to avoid fees, and pay vendors the same way. Here's what changes, in real numbers.

### 9.1 Yes, Stripe charges on payouts — but it's the smallest number on the page

| Leg | Fee | On a typical show |
|---|---|---|
| **Transfer** platform → vendor's connected account | **$0** | free |
| **Payout** connected account → their bank | **0.25% + $0.25** (self-managed pricing) | ~40 vendors, ~$96k total → **≈ $250** |
| **Active account fee** | **$2/mo** per account that got a payout — **$0** on Stripe's default pricing model | $0–80 |
| Instant payout (optional, vendor-initiated) | 1%, $0.50 min | only if offered |

**≈ $250–330 per show to pay every vendor automatically.** That's roughly **0.3% of indoor gross**, or about **1.3% of your commission line.**

> Ask Stripe which pricing model you're on. Under their **default** model the per-account and payout fees are waived and Stripe takes its margin on processing instead. It can be cheaper at your volume — worth one email before launch.

### 9.2 The fee you're actually paying is at the register, and you're already paying it

| | |
|---|---|
| Register processing, in-person | **2.7% + $0.05** → on $120k indoor gross ≈ **$3,300** |
| Vendor payouts (§9.1) | ≈ **$280** |
| Booth fees by card | 2.9% + $0.30 |
| **Booth fees by ACH** | **0.8%, capped at $5** |

Whatever you run the indoor register on today already takes ~2.6–2.9%. **Moving to Stripe Terminal doesn't add that cost — it's the same cost, on a system that also does the attribution and the payout.** Payout fees are ~8% of the register fee. They are not the thing to optimise.

### 9.3 Booth fees: ACH kills the fee objection outright

This is the actual answer to "we don't want to pay fees."

| Booth fee | Card (2.9% + $0.30) | **ACH (0.8%, $5 cap)** |
|---|---|---|
| $280 indoor | $8.42 | **$2.24** |
| $450 outdoor Sunday | $13.35 | **$3.60** |
| $625+ | $18.43+ | **$5.00 — capped** |

Across a full show that's roughly **$1,400 on card versus ~$350 on ACH.** Make ACH the default and offer card as the convenience option. Some markets add a card surcharge or bake ~3% into the card price; either is normal and defensible when ACH is offered free alongside.

### 9.4 What the P2P rails are actually costing you

The fee isn't zero. It's just paid somewhere that doesn't show up on a statement.

- **Reconciliation labour.** Forty individual Venmos plus forty emailed sales reports plus chasing payee names. That's a day of Elise's time per show, twice a year, and it's the bottleneck that gates payouts on someone having time.
- **No automatic booking confirmation.** A Venmo payment doesn't tell the system a booth is paid. Someone has to notice and mark it — which is exactly what makes the 36-hour payment window a chase.
- **Terms-of-service risk.** Zelle on a consumer account is generally not permitted for business payments, and Venmo requires a business profile for goods-and-services (which carries its own ~1.9% + $0.10). Personal-account business revenue is a real exposure, not a technicality.
- **1099 obligations don't disappear.** You still owe reporting on what you pay vendors — P2P just makes it a manual tracking job instead of something Stripe files for you.
- **Exit value.** This is the big one. **Revenue and payouts that moved through personal P2P accounts are the messiest thing a buyer's diligence can find.** Clean, dated, per-vendor records in one system are worth far more than the few hundred dollars a show of fees you're avoiding. Two or three years of that history is a line item in the valuation.

### 9.5 Recommendation

1. **Booth fees → ACH by default**, card as an option. Fee objection solved (§9.3).
2. **Payouts → Stripe Connect.** ~$280 a show buys automatic, dated, auditable payouts, Stripe-filed 1099s, and the end of the Venmo queue.
3. **Retire personal Venmo and Zelle for business money entirely.** Keep a paper-check fallback for the one vendor a season who won't complete Connect onboarding.
4. **Confirm your Connect pricing model with Stripe** before launch — it may zero out §9.1 altogether.
5. **Decide who absorbs card fees on booth fees.** Absorbing is cleanest; surcharging is common. Just make it a decision rather than a default.
