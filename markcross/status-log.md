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

## 2026-09-18 (efficiency phase begins)

- Executed via API (verified live): non-brand Shopping tROAS 1.5 → **2.5**;
  brand Shopping tROAS 1.2 → **1.5** (margin-based breakeven floor is 1.33).
- Awaiting Andrew UI-side: end 2 experiments (20534342865, 23295771342),
  pause Branding Search 1012389985, brand budget $240 → ~$100/day.
- Margin confirmed 75% (client Slack, 9/17). Mandate from Andrew:
  "ultra efficient, then scale."

## 2026-09-21 (delegated efficiency cuts executed)

Andrew: "Can you run these for me if you feel extremely confident it will
increase performance." Executed via API, both verified live:

- **Branding Search 1012389985 → PAUSED** ($1,060+ since Sep 3, zero
  tracked purchases; GA4 at 93% capture corroborates ~$0 paid-search rev).
- **Brand Shopping 6963027077 budget $240 → $100/day** (zero clean-era
  purchases; budget 6560440057 confirmed non-shared before mutate).
- Weekend read: non-brand tROAS 2.5 is constraining spend as designed
  (~$85/day vs $110 budget). Flows did $5.4k of the week's revenue.
- Still Andrew-only (API cannot): end experiments 20534342865 ($10/day,
  ENABLED) and 23295771342 ($55/day "Manual CPC", ENABLED); optional Meta
  retargeting budget restore (manual UI per caution protocol; freeze lifts
  ~Oct 1 with prospecting rebuild planned: ~$150/day, CAC ceiling ~$450).
- Google run-rate now ~$195/day of intended spend (from ~$430 at takeover).

## 2026-09-22 (attribution cross-check → brand search pause REVERSED)

Andrew challenged the brand-search pause ("what if it's just not reporting
the sales?"). Built GA4 multi-lens attribution read (ga4_attrib: session
source/medium, first-touch channel, session channel). Findings:

- **90d truth: google/cpc last-click = 31 txn / $42,271 on $42,074 spend
  (1.00x blended).** Not zero — my era-based "produces nothing" was a
  19-day small-sample artifact from the September trough.
- **Split flips the verdict per campaign:** Branding Search 90d ≈ $13,225
  last-click rev on $5,894 spend = **2.24x, ABOVE the 1.33 breakeven** —
  the one profitable Google campaign. Paid Shopping 90d = $29,046 on
  ~$36,180 = **0.80x, below breakeven** — shopping cuts stand.
- A $2,910 google/cpc order landed Sep 21 (the pause day) — first-touch
  AND last-click paid search.
- **Action: 1012389985 re-enabled via API, verified ENABLED.** Total
  paused time ~24h.
- Lesson captured: no kill decisions on sub-$100/day campaigns from a
  sub-30-day window at this order volume; 90d multi-lens GA4 check is now
  mandatory before any campaign pause.
- Brand Shopping $100/day budget + tROAS floors: CONFIRMED correct by the
  same lens (0.80x). Sep 3 BC-demotion bidding-signal change may also
  explain part of the era's Paid Shopping zero — watch, don't revert.

## 2026-09-22 pt 2 (bidding signal restored — Andrew-approved)

- **Begin Checkout re-promoted to primary** (verified: primaryForGoal=true)
  **at honest fixed value $55** (alwaysUseDefaultValue) — calibrated from
  118 BCs → 5 purchases / $6,313 last 30d (~$53/BC expected). Old tag
  values averaged $3,175/BC; the phantom stays dead, the signal returns.
- **Dashboard/report Google conversions now Purchase-only** (split GAQL
  queries; verified live: BC no longer pollutes client-facing numbers).
- Rationale: era showed Shopping conversion collapse post-demotion =
  smart-bidding signal starvation (organic/email/direct all improved in
  the same window; Shopping zeroed even during promo week).
- Watch items: BC accrual at $55/fire (check ~Sep 29), Shopping delivery
  recovery over 7–14 days, tROAS held at 2.5/1.5 through the transition.

## 2026-09-24 (zombie spend closed out; Meta bump held)

Andrew delegated items 1+2 from the Friday-call prep ("execute what you
feel extremely confident in").

- **Item 1 done — zombie trial spend stopped via budget throttle.**
  Discovery first (new ?report=experiments read): experiment 10059965045
  "Manual CPC" (expired 2026-01-20, still ENABLED) had been splitting the
  profitable Branding Search 1012389985 50/50 with trial arm 23295771342.
  endExperiment → CANNOT_MODIFY_PAST_END_DATE; campaign pause →
  CANNOT_MODIFY_FOR_TRIAL_CAMPAIGN (both trials API-locked). Fallback that
  worked: budgets to $1/day on 23295771342 and 20534342865 (verified live;
  non-shared budgets confirmed). ~$64/day stopped. Andrew should still
  delete/end the experiments in the UI for cleanliness — and doing so gives
  Branding Search its full traffic share.
- **Item 2 held — Meta retargeting budget bump NOT executed via API**: the
  Meta write freeze (Andrew's own caution protocol post-ban, to ~Oct 1)
  stands; a generic delegation isn't an explicit waiver. Needs either his
  60-second UI change or an explicit instruction to use the Meta API.
