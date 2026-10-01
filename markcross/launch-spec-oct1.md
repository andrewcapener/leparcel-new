# Mark Cross — Prospecting Launch Spec (Oct 1, freeze-lift)

Prepared for Andrew's go/no-go. Nothing below is executed until he says go.
Build order: create everything PAUSED via API → Andrew eyeballs in Ads
Manager → activate. Maximum ban-safety; one reviewable changeset.

## 1. Pre-launch checks (ran Oct 1)

- **Retargeting ladder: GREEN.** rt-nc DABA last 7d: $900 spend, 5
  purchases → **$180 CAC** vs $450 ceiling; Meta-claimed $9,290 (10.3x).
  Step: CBO $130 → **$162/day (+25%)**.
- **Shopping recovery: continuing, modest.** Non-brand this week 0.39
  attr. purchases / $774 on $619 (1.25x; last week 1.65x; post-fix
  cumulative ≈1.5x, around breakeven and learning). Brand-shop BCs still
  accruing at exactly $55 (16 × $55 = $880). Hold, judge at day-30.
- **RED FLAG — Branding Search delivery collapsed:** $112/wk → **$7.97**
  this week (10 clicks). The expired "Manual CPC" experiment is still
  ENABLED and its 50/50 split now points half the traffic at a $1/day
  trial arm. The API cannot end it (CANNOT_MODIFY_PAST_END_DATE).
  **Andrew must end/delete the experiment in the Google Ads UI** — this
  releases the profitable (2.2x) brand-defense campaign to full delivery.
  No longer cosmetic.
- Meta purchase-testing remains paused; zombie throttles holding.

## 2. Prospecting rebuild (the main event)

**Campaign:** `pr-nc_cbo_prospecting_housework_100126` — Sales objective,
CBO **$150/day**, purchase optimization (7dc/1dv), US.

**Adset 1 — `broad`**: 25+, no interest targeting (creative does the
targeting at this AOV). Exclusions: Website Purchasers 200D, website
visitors 180d, IG+FB 365 engagers, Klaviyo CRM lists — truly cold.

**Adset 2 — `lal-stack`**: the two live 1% purchaser lookalikes
(Website Purchasers 200D excl. 60D; Purchasers 180D) + a **new 1% LAL of
Video Viewers L90D** (62–73k fresh seed; one extra create). Same
exclusions.

**Guardrails:**
- $450 CAC ceiling. Kill/iterate rule: any adset at $900 spend (2× ceiling)
  with zero purchases gets its creative rotated, not its budget raised.
- No edits during the first 72h (learning). Daily CAC check first 7 days
  via meta-signal; weekly +25–30% ladder only while blended prospecting
  CAC ≤ $450.
- All writes minimal-touch, created PAUSED, activated only after Andrew's
  UI review.

## 3. Creative brief — four sets from the client Drive library

House voice rules (per Andrew + the live-ad audit): no em dashes, no
abstract triads ("form, balance, material"), no verdict-words
(considered/resolved/elevated). Concrete nouns, product names, 1845.
CTA: Shop Now. Link UTMs: utm_source=facebook&utm_medium=paid_social&
utm_campaign=prospecting_oct26&utm_content=<set>.

**Set A — Romy (the proven seller, $1,990).**
Files: STILL LIFE/ROMY 25 ("Romy 25 in Black.png", "Romy 25.png",
"Romy Clutches.png", "Romy Detail.png", DEC_24_S1_29/30 luggage-mushroom
vacchetta, DEC_24_S1_22 acorn boxcalf 331/332) + EDITORIAL/WOMENS/ROMY 25
and ROMY CLUTCH.
Format: editorial hero static + colorway carousel (Black / Oxblood /
Ivory cards from the PNGs).
Copy: "The Romy. Boxcalf, a turn-lock we have made since the steamer-trunk
years, and room for exactly what matters. Made by hand since 1845."
Headline: "The Romy Collection".

**Set B — Madeline (editorial/prestige).**
Files: EDITORIAL/WOMENS/MADELINE 21 + MADELINE 30, Madeline40Acorn TIFF,
Goop-shoot frames (EDITORIAL/WOMENS/MASON 24 folder, Aug 2026).
Format: single-image editorial statics, 4:5 + 9:16 crops.
Copy: "Madeline, in acorn boxcalf. Saddle-stitched in the same spirit as
our 1930s originals, sized for now." Headline: "Meet Madeline".

**Set C — Gifting (Q4 lane, lower price points).**
Files: STILL LIFE/GROUP SHOTS, WALLETS, HOME, HARRY WASHBAG.
Format: carousel (wallet / washbag / home objects), gifting angle.
Copy: "A lion stamped in the leather and a name that has meant American
luxury since 1845. Wallets, cases and small goods, ready to give."
Headline: "Gifts from the House".

**Set D — Men's / Archer (untouched audience).**
Files: STILL LIFE/ARCHER 32 + 42, EDITORIAL/MENS, EDITORIAL/WOMENS/
ARCHER 42 + 32.
Format: static + 2-card carousel (32 vs 42 sizes).
Copy: "The Archer, in tumbled grain. Carries a laptop, a day's papers and
its shape. Leather that wears in, not out." Headline: "The Archer 32 & 42".

Mechanics: assets pulled from the shared Drive, uploaded to the ad
account's image library via API, link_data creatives to markcross.com
product pages. Retargeting DABA copy refresh (replace the AI-tell caption)
ships as a NEW ad beside the 14.4x incumbent; the incumbent is never
paused until the replacement proves itself.

## 4. Execution checklist on Andrew's go

1. Retargeting CBO $130 → $162/day (1 write).
2. Create Video Viewers L90D 1% lookalike (1 write).
3. Upload ~14 images; create campaign + 2 adsets + 8–10 ads, ALL PAUSED.
4. Andrew reviews in Ads Manager; on his thumbs-up, activate campaign.
5. Log everything; daily CAC watch for 7 days; creative performance
   section on the dashboard picks the ads up automatically as they spend.

Andrew-side (UI, urgent first): END the "Manual CPC" experiment
(releases Branding Search); end "BR Category eCPC" too while there.
