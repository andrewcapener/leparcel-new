# The POS — Build Sheet

**Revised Aug 19 after correcting a bad assumption.** I'd designed this like a vendor mall — barcodes, printed label sheets, hundreds of SKUs per vendor. That's wrong for Mermade. Your tags are `MM21` + a price, and a vendor brings **6–20 items**. At that size, barcodes are solving a problem you don't have, and asking 40 hobbyist makers to print label sheets at home is real adoption risk for near-zero gain.

**The register should read exactly what your tags already say: a vendor code and a price.**

---

## 1. The interaction

Cashier picks up a candle. Tag says `MM07 $18`.

```
  types  0 7   →  vendor grid appears
  types  1 8   →  line added, cart updated
```

Four keystrokes. No scanning, no tapping, no reaching for a second device. A cashier who's done it twice can do it without looking down, which is the actual requirement on a Saturday morning.

And because a vendor only has 6–20 items, **the price is almost always unique within that vendor** — so `07` + `18` resolves to a specific item, and you get item-level data for free without anyone printing anything.

```
┌──────────────────────────────────────────────────────────────┐
│  MERMADE · Register 1        Fall 2026     ● online      ⚙   │
├────────────────────────────────────┬─────────────────────────┤
│                                    │  VENDOR  MM07           │
│  Beeswax Candle             $18    │  Laurel Grace Studios   │
│  MM07 · Laurel Grace          ✕    │                         │
│                                    │  ┌────────┬────────┐    │
│  Sea Glass Earrings         $15    │  │ $12    │ $18    │    │
│  MM34 · Coastal Cottage       ✕    │  │ Taper  │ Beeswax│    │
│                                    │  ├────────┼────────┤    │
│  Linen Apron                $48    │  │ $24    │ $32    │    │
│  MM12 · Drawers Co.           ✕    │  │ Votive │ Pillar │    │
│                                    │  ├────────┼────────┤    │
│  ────────────────────────────────  │  │ $45    │ OTHER  │    │
│  Subtotal                   $81    │  │ Trio   │  $__   │    │
│  Tax                      $6.28    │  └────────┴────────┘    │
│                                    │                         │
│  TOTAL                   $87.28    │  [ 7 ][ 8 ][ 9 ]        │
│                                    │  [ 4 ][ 5 ][ 6 ]        │
│                                    │  [ 1 ][ 2 ][ 3 ]        │
│                                    │  [ 0 ][ ⌫ ][ ↵ ]        │
│                                    │                         │
│                                    │ ┌─────────────────────┐ │
│                                    │ │       CHARGE        │ │
│                                    │ └─────────────────────┘ │
│                                    │ [ CASH ] [SPLIT] [VOID] │
└────────────────────────────────────┴─────────────────────────┘
```

Two ways to add the same line, both always available:
- **Type the price** (`18` ↵) — fastest, what a trained cashier does
- **Tap the tile** — what a nervous volunteer does on hour one

Same result. No mode to learn, no wrong way to do it.

---

## 2. Three tiers, and tier 1 alone is a complete system

This is the part that de-risks November.

### Tier 1 — Vendor + price. Works day one. Vendors change nothing.
Cashier enters `MM07` and `$18`. That's precisely the information on your tags today, so **there is no vendor-side dependency at all.** No uploads, no printing, no new instructions in the acceptance email.

What you get immediately: correct per-vendor totals, real-time sales, automatic 20% commission, automatic statements, automatic Stripe payouts. Every operational problem in the audit — the manual tally, the emailed reports, the Venmo queue — is solved by tier 1 alone.

What you don't get: item names. A vendor's statement says "17 sales totaling $412," not "you sold 6 candles."

### Tier 2 — Vendor uploads their 6–20 items. Strongly encouraged, never blocking.
A form with a few rows: item name, price, and optionally quantity. Six to twenty rows is a five-minute task, not a CSV project — most vendors will do it on their phone.

Now the grid shows names, and `07` + `18` resolves to *Beeswax Candle*. You get sell-through, "what actually sold" reports for vendors, category performance, and per-square-foot analysis by category. **And it's the seed catalog for a post-show online shop** — a vendor's 6–20 items with prices is already 80% of a product listing.

Crucially: **tier 2 failing degrades to tier 1, silently and correctly.** A vendor who never uploads still gets paid exactly right. Nobody's money depends on anybody's homework.

### Tier 3 — Barcodes. Not now.
Only worth revisiting if item counts grow past ~50 per vendor, or if you go year-round online and want scan-based fulfillment. Parked, not planned.

**This tiering is why I'd now say the November POS is low-risk.** The blocking dependency I flagged last round — "if vendors don't upload inventory, the register has nothing to read" — no longer exists. The register always works.

---

## 3. Handling the messy middle

**Two items at the same price.** A vendor has a $24 votive and a $24 mug. Typing `24` shows both tiles; cashier taps one. If they're rushed and pick wrong, the *money is still exactly right* — only the item label is off. Money correctness never depends on a judgment call. That's the design rule.

**A price not in the vendor's list.** Vendor restocked with something new, or the tag's been marked down. `OTHER $__` accepts any keyed amount, attributed to that vendor, flagged for review. Vendor sees it on their statement.

**Vendor code missing or illegible.** `UNATTRIBUTED` at a keyed price. Resolved in an admin queue after the show. **Never guess a vendor** — guessing pays the wrong person and you'd never know.

**Vendor code you don't recognize.** Grid shows "MM88 — not on the roster." Cashier can still take the money as unattributed. The line moves.

**Discounts.** Apportioned pro-rata across the affected lines so commission math stays honest. Permission-gated, reason-coded.

---

## 4. Task breakdown — revised down

Removing barcodes takes real work off the board: no label PDF generation, no Avery grid alignment, no scanner integration, no "tag won't scan" failure path, no vendor printing instructions or support burden.

| Task | Est. |
|---|---|
| Cart screen, vendor grid, numeric entry, state machine | 2d |
| Vendor/price resolution + ambiguity handling | 1d |
| Catalog cache to IndexedDB (~600 rows — trivial) | 0.5d |
| Terminal SDK: discover, pair, connect, collect, confirm | 1.5d |
| **Offline queue + idempotent sync** | 3d |
| Discounts apportioned across vendors | 1.5d |
| Returns reversing the right vendor's ledger line | 1.5d |
| OTHER / UNATTRIBUTED flows + admin resolution queue | 1d |
| Register close, cash count, variance | 1d |
| Receipts, void, no-sale, staff identity | 0.5d |
| Simple item upload form (tier 2) | 1d |

**≈ 14 days of build, down from ~18.** Plus the dry run, training, and hardware burn-in.

The offline queue is still the piece that deserves the most care — it's where correctness lives, and it's unchanged by any of this.

---

## 5. Hardware — one line item just disappeared

| Item | Qty | Cost |
|---|---|---|
| Stripe Reader S710 (cellular) | 2 | ~$600 |
| Stripe Reader S700 (spare) | 1 | ~$299 |
| Stripe Reader M2 (emergency) | 1 | $59 |
| iPad / tablet | 3 | — |
| ~~Barcode scanners~~ | ~~3~~ | **$0** |
| Cellular hotspot + travel router | 1 | ~$200 |
| Second-carrier hotspot (failover) | 1 | ~$100 |
| Cash drawer + receipt printer (optional) | 1 | ~$200 |

**Order by Oct 2.** Stripe publishes no shipping SLA and you want three weeks of testing, not three days.

---

## 6. Offline — still the one genuinely hard constraint

Unchanged by the tag decision, and worth repeating because it's the only place "easy" is misleading:

- Reader must have been online within the **last 24 hours**, on the **same local network** — you cannot switch networks mid-outage
- **$10,000 cap** per offline transaction
- **You own 100% of the decline risk.** The card isn't authorized until connectivity returns; if it declines then, the goods are gone and Stripe says there's no recovery

→ Cap it yourself: **$300 per offline transaction, $3,000 accumulated**, then card refuses and the register demands cash. Surface the running offline count on the admin dashboard. And run the registers on a **dedicated cellular router**, never venue wifi. That's a $200 line item that protects a $120k weekend.

---

## 7. Day-of runbook

Laminate it. Tape it to the register.

| If this happens | Do this |
|---|---|
| Network drops | Keep selling. Banner turns amber. Card still works within caps. |
| Offline caps hit | Card refuses. Take cash. Keep going. |
| Price isn't on the vendor's grid | `OTHER` → key the price off the tag |
| Two items, same price | Tap either. Money's right regardless. |
| No vendor code on the tag | `UNATTRIBUTED` → key the price. **Never guess a vendor.** |
| Vendor code not on the roster | Take it as unattributed, flag after |
| Reader freezes | Swap to the spare. Pairing is ~30 seconds. |
| Both readers down | Tap to Pay on the staff iPhone |
| Everything down | Cash + paper. Key the sales in after close. |

Nothing on that list ends with "the line stops."

---

## 8. What changed, and why it matters

The barcode design assumed a vendor-mall problem — hundreds of SKUs, staff who can't know the catalog, scanning as the only viable input. Your floor is 40 vendors × 6–20 items, tagged with a system that already works and that vendors already comply with.

Building the register around `MM21 + price` means:
- **Zero new vendor requirements** for the November show
- **No dependency** between inventory uploads and the register working
- **Four keystrokes** per item, faster than reaching for a scanner
- **Item-level data anyway**, for every vendor who spends five minutes on the upload
- **Four fewer days** of build and one fewer hardware category

And it means the thing that has to be true on November 13 is just: the register turns on and someone can type two numbers.
