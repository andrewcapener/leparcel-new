# Mark Cross — Day-14 Clean-Data Baseline

**Window:** 2026-09-03 → 2026-09-17 (measurement repaired Sep 3: Begin
Checkout demoted from primary, brand tROAS honest-reset to 1.2, junk
paused). Internal report — the client-facing version should be rewritten in
the house voice before it goes out.

## Era totals (DTC / web only — wholesale excluded per 9/15 dash change)

| Metric | Value |
|---|---|
| Web revenue | $76,639 (40 orders, AOV $1,916) |
| Wholesale (drafts) | $9,878 (4 orders, excluded everywhere below) |
| Ad spend | $8,242 (Google $6,274 / Meta $1,968) |
| Blended MER | **9.3** (pre-fix benchmark: 12.0 — but see week split) |
| New customers | 40 · CAC $206 |
| GA4 capture | **93%** of web revenue attributed ($71,293) |

**Week split — the era is two different stores:**

| | Web rev | Orders | Spend | MER |
|---|---|---|---|---|
| W1 (Sep 3–9, Labor-Day week) | $61,919 | 32 | $4,306 | **14.4** |
| W2 (Sep 10–16) | $9,355 | 6 | $3,742 | **2.5** |

W1 beat the 12.0 pre-fix benchmark on honest numbers. W2 was a
post-holiday demand trough (five days totaling ~$1.5k, three zero days;
Sep 13–14 + Sep 16). Sep 17 opened at $5,366/2 orders by mid-morning —
demand returning. The 12.0 benchmark was itself measured on inflated
attribution and blended wholesale, so 9.3-clean vs 12.0-dirty is not a
regression; W1 shows the honest ceiling.

## Google — per-campaign honest (Purchase-only) ROAS, Sep 3–17

| Campaign | Spend | Purchases | Honest ROAS |
|---|---|---|---|
| Brand Shopping (conquest) 6963027077, tROAS 1.2 | $3,719 | **0** | **0.00x** |
| Non-brand Shopping 1507311510, tROAS 1.5 | $1,680 | 1 ($378) | **0.23x** |
| Branding Search 1012389985 | $876 | 0 | 0.00x |
| Zombies (20534342865, 23295771342) | ~$150 est. | 0 | — |

Total: **$6,274 spend → 1 tracked purchase ($378).** GA4 independently
corroborates: Paid Shopping 1,018+ sessions / ~$0 revenue, Paid Search
~$0 — and GA4 is now capturing 93% of web revenue, so "tracking
undercount" can no longer carry the explanation. The pre-fix "non-brand
honest ~3.48x" measured on the trailing window **did not survive** clean
measurement.

### Verdicts (the calls the audit deferred to day 14)

1. **Brand-Shopping impression share: do NOT push.** The conquest thesis
   (Lalage Beaumont / Hermès-adjacent queries at <10% impression share)
   produced zero tracked purchases in 15 days at $250/day. Recommend
   budget $240/day → ~$100/day now, pause entirely if margin (still
   unknown) is under ~40%. Impression-share scaling is dead until the
   campaign proves a single week of honest ROAS ≥ 1.5.
2. **Non-brand does NOT deserve budget.** Recommend tROAS 1.5 → 2.5–3.0
   (constrains delivery to the auctions Google believes convert) via the
   existing `google_set_troas` action; hold $110/day budget, revisit at
   day 30.
3. **Branding Search + zombies: turn off.** $876 + ~$150 for zero
   purchases; "mark cross bag" alone burned $266/138 clicks at 0 conv.
   Requires Andrew in the UI (end the two experiments; pause 1012389985).
   ~$120/day recovered.
4. Net Google recommendation: **$430/day → ~$180/day** with no expected
   revenue loss on tracked evidence.

## Meta

- Purchase-testing: **PAUSED confirmed** (effective_status PAUSED since
  Sep 8; the $43 residual spend in the 7d read pre-dates the pause).
- Spend has decayed $190/day → ~$70/day; ~94% of what remains is the
  **DABA retargeting adset** (rt-nc_maxconv). Reported 18 purchases /
  $36.5k (18.5x) era-to-date is therefore retargeting-flattered — Meta
  claiming credit on warm buyers. Treat as ceiling, not truth.
- Learning state: ~4 purchases + ~18 ATC per week vs the ~50/week
  threshold — still deep in learning limbo; consolidation thesis stands.
- **Scale path (manual UI only; API freeze holds to ~Oct 1):** modest
  budget restore on retargeting now if desired (+20–30% steps); the real
  lever is a prospecting rebuild once the freeze lifts, seeded with the
  margin-based CAC ceiling we still don't have.

## Open items / blockers

- **Margin number: still not supplied** (client unresponsive since
  onboarding). Without it: no true breakevens, no honest tROAS floors, no
  defensible scale plan. Re-ask; escalate via the $297k mispriced-variant
  finding if needed (that got flagged to Andrew 9/15, unknown if actioned).
- Returning-customers proxy: era shows 0 returning orders across 40 web
  orders. Suspicious for a 180-year-old brand; the `orders_count <= 1`
  proxy needs validation against Shopify admin before the day-30 report
  leans on new-vs-returning.
- Site tracking fix (GA4 gap) largely resolved itself under the web-only
  denominator (93% capture) — the remaining paid-attribution gap is now
  more plausibly "paid isn't driving last-click purchases" than "tracking
  is broken."
- Two zero-revenue days recurred (Sep 16). Checkout was reconfirmed
  working (Sep 15 + Sep 17 orders completed). Reading: lumpy demand.

## Bottom line

The clean window did its job: it killed two comfortable stories (brand
conquest "1.25x" and non-brand "3.48x") that only existed under inflated
attribution. This account's paid program is currently **Meta retargeting +
email doing the work while Google burns ~$430/day largely unproven.** The
scaling recommendation the audit promised is therefore an inversion:
**cut Google to ~$180/day, hold Meta, and scale nothing until margin is
known and one honest week proves a channel.** At W1 demand levels that
roughly doubles MER at equal revenue.
