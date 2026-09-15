# Mark Cross — Running Status Log

Internal working log, follows the initial audit (`audit-2026-09-02.md`).
Clean-data era began 2026-09-03 (Begin Checkout demoted, tROAS reset, junk
paused). Day-14 clean-data report auto-fires 2026-09-17.

## 2026-09-11 (Fri pre-weekend check)

- Clean era Sep 3–11: $71.8k rev / $5.3k spend, MER 13.6, 34 new customers,
  CAC $155.
- Fresh search-term sweep: two new zero-conv junk terms found
  ("luxury items every woman should own" $71/55c on brand-shop;
  "dog store austin" $30 on non-brand). Action
  `google_add_junk_negatives_0911` built + deployed; execution blocked by
  sandbox on Friday.
- Meta spend drifting down (~$190/day → ~$72/day) since purchase-testing
  pause — remaining campaigns not absorbing budget. Left alone (Meta API
  write freeze; manual-UI-only per caution protocol).

## 2026-09-15 (Mon check-in)

**Executed**
- `google_add_junk_negatives_0911` ran clean: exact negatives created on
  6963027077 and 1507311510 (criteria 920870509125, 391747175448).
- New keyed read `?report=checkouts` (Shopify abandoned checkouts, no PII)
  added to markcross-execute for site-health checks.

**Findings — revenue anomaly Sep 12–15**
- Daily Shopify revenue: Sep 12 $954, Sep 13 $0, Sep 14 $0, Sep 15 $555
  (partial). Prior era averaged ~$8–9k/day. Sessions held ~600–870/day.
- GA4 independently shows $0 revenue across ALL channels Sep 13–14
  (email/organic/direct included) — not a paid-media problem, and two
  independent sources agree, so not a data-pipe problem.
- Abandoned checkouts Sep 12–14: 5 shoppers reached checkout (email
  entered) totaling ~$19.9k, zero completed. Sep 7–10 comparison: 15
  abandoned vs 16 completed web orders (~50% completion for
  checkout-reachers). Recent completion ≈ 0. Suspicion: possible
  checkout/payment completion failure; needs a human test order.
- Outlier: single-item abandoned checkout on Sep 10 for **$297,447.46** —
  possible live mispriced variant; check in Shopify admin → Abandoned
  checkouts.
- Context: Sep 7 was Labor Day ($20.5k spike); some of the trough is
  plausibly post-promo pull-forward. Sessions down ~40% vs early era.

**Channel picture (Sep 3–15)**
- Totals: $79.2k rev / $7.5k spend, MER 10.6, 38 new customers, CAC $197,
  AOV $1,885. Returning-orders proxy still reads 0 (sanity-check due at
  day 14).
- Meta: $1,785 spend → $33.3k attributed (18.6x), but spend has decayed to
  ~$53/day; only 2 spending adsets, 4 purchases/wk vs ~50 learning
  threshold. First scale candidate — manual UI budget raises only.
- Google: $5,690 spend, 2 tracked purchases / $1,298 (honest post-demotion
  accrual). GA4 last-touch: Paid Shopping 1,018 sessions / $0 rev. Biggest
  spend line, weakest evidence; day-14 report owns keep/kill.
- Zombie experiments still ENABLED (20534342865 @ $10/day,
  23295771342 @ $55/day) — API cannot end trials; Andrew must "end
  experiment" in Google UI.
- Klaviyo (era): campaigns $25.4k/13 orders, flows $12.9k/6 orders — email
  ≈ 48% of attributed revenue. With ~$60k/wk of real abandoned-checkout
  value, abandoned-checkout flow aggressiveness is a live lever.

**Holds**
- Meta API write freeze (manual UI only) until ~Sep 17–Oct 1.
- No margin number from client → no honest tROAS floors, no scale math.
- Recommendation: verify checkout health before any scale move.
