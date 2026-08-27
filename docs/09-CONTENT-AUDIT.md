# Homepage Content Audit

**What every element is for, who it serves, and whether it earns its place.**
Aug 21, 2026. Audited against `00-BUSINESS-AUDIT.md`.

---

## 1. The homepage has four jobs, and they compete

| # | Job | Who | What it's worth | Share of traffic |
|---|---|---|---|---|
| **1** | Get a shopper to come | Coastal moms, from Instagram, on a phone | Attendance → vendor sales → 20% commission → vendor retention → next season's applications. **Everything downstream depends on this.** | **~90%** |
| **2** | Recruit and qualify vendors | Makers, 2 windows a year | Booth fees (~$28k/show) + the commission base | ~7%, concentrated in Sept and Mar |
| **3** | Sell sponsorship | Brands, media buyers | High-margin, currently ~$0, most under-built line in the business | ~1% |
| **4** | Be the asset a buyer diligences | Acquirer, 2–3 years out | The multiple | ~0% today, 100% at exit |

**The finding: the version I built last serves jobs 2, 3, and 4 well and starves job 1.** An archive table of Show XVII merchant counts is superb for a vendor deciding where to spend $280, and for a buyer's diligence. A mom who tapped a story link at 9pm does not care, and she is nine out of ten visitors.

That's the audit in one line. Everything below follows from it.

---

## 2. Element-by-element

**Verdicts:** ✅ keep · ⤵️ demote to a sub-page · ✂️ cut · ⚠️ keep but it must be true · ➕ missing

| Element | Job it does | For whom | Verdict |
|---|---|---|---|
| Masthead: *Est. 2015 · Twenty-second show* | Establishes age in one line, above everything | All four | ✅ Cheapest institutional signal on the page |
| Wordmark + "a juried market of independent makers" | Says what this *is* to a first-timer | 1, 2 | ✅ "Juried" is doing heavy lifting — it tells a shopper it's curated and a vendor it's competitive |
| Three-tier nav (utility / mast / subnav) | Implies depth | 2, 4 | ⚠️ Only honest if the pages exist. Ship Archive and Press or drop the links |
| Hero photograph, full bleed | The single highest-converting element for job 1 | 1 | ✅ Non-negotiable |
| Hero headline *"One hundred makers, chosen by hand"* | Positions curation as the benefit | 1, 2 | ✅ |
| **Missing above the fold: dates, "free," and one action** | — | 1 | ➕ **Biggest miss on the page.** They're in the subnav in 11px caps. A phone visitor decides in ~5s |
| Hero credit line (*Show XX · 96 merchants · 4,100 attending*) | Institutional texture | 2, 4 | ⤵️ Beautiful, wrong audience for the top of the page. Move to the archive |
| Factbar: *2015 / 22 / 1,940 / 6,000 / $0* | Proof, fast | All | ✅ but **reorder for job 1**: lead with *Free · 3 days · 100+ makers*, keep 2015 and 22 shows |
| Press row | Third-party validation | 1, 3 | ✅ Strongest trust signal you own and were not using |
| § 01 Position (3 paragraphs) | The differentiator, argued | 1, 2 | ✅ Keep, but **cut to two paragraphs on the homepage** and link the full piece. Paragraph 3 is vendor mechanics |
| Full-bleed plate + caption | Atmosphere, proof of scale | 1 | ✅ |
| § 02 **Archive table** | The strongest institutional artifact on the page | 2, 4 | ⤵️ **Move to `/archive`.** Keep a 3-line teaser + "every show since 2015 →". It's the best thing here and it's in the wrong place |
| § 03 Merchant directory (40 names) | Proof of scale; answers "will I find something" | 1, 2 | ✅ **but make the names links.** A wall of un-clickable names is decoration; a directory is an asset — and it's 100+ pages of long-tail SEO you don't have |
| Merchant cards ×4 with price ranges | Answers her real question: *is there something for me, can I afford it* | 1 | ✅ Most underrated block on the page |
| § 04 Selling with us | Qualifies vendors, sets expectations | 2 | ⤵️ Condense to 3 lines + link to `/apply`. It's a whole page |
| Dark section *"Eleven years, three venues, one rule"* | Turns venue instability into an asset | 1, 2, 4 | ✅ Honest and disarming |
| Film / video | Highest-fidelity proof there is | 1, 3 | ✅ Keep prominent once it exists |
| § 05 Visiting | Removes the last friction | 1 | ✅ **Promote it.** Parking, strollers, how long, free — this converts "maybe" into "going" |
| Apply CTA | Job 2 conversion | 2 | ✅ |
| Footer sitemap + colophon | Depth, seriousness | 2, 4 | ✅ |
| **Missing: email capture** | Two shows a year means the list *is* the business | 1 | ➕ **The single biggest revenue miss.** No capture anywhere. You have 10k subscribers and no way to grow it |
| **Missing: add-to-calendar** | Converts intent 3 months before the show | 1 | ➕ One line of code, real attendance impact |
| **Missing: sponsorship entry** | Job 3 has no front door | 3 | ➕ A footer link is not a program |
| **Missing: "shop the market" / online** | Year-round revenue | 1 | ➕ Not v1, but the IA should leave room |
| **Missing: past-show roster links** | SEO + vendor pride + proof | 1, 2, 4 | ➕ Every past merchant name is a search term and a backlink |

---

## 3. What the page is missing that costs actual money

Ranked by revenue impact.

1. **Email capture.** Two shows a year = ~6 revenue days. The list is how you fill them. There is no signup on the page. A single well-placed capture with a real reason to subscribe ("we announce the roster and open early access to the list first") is the highest-ROI element you could add, and it compounds every season.
2. **Add to calendar.** The show is 12 weeks out. Intent decays. `.ics` on the page captures it at the moment of interest.
3. **A sponsorship front door.** 4,000–5,000 affluent OC attendees over three days is a sellable audience. Right now a media buyer would find a footer link. A rate card, placement inventory, and past-sponsor names is a revenue line that doesn't scale with vendor count.
4. **Clickable merchant directory.** 100+ maker pages, each with photos, category, price range, and links out. That's your entire long-tail SEO strategy, a retention gift to vendors ("we built you a page"), and the seed catalog for a future online shop.
5. **Waitlist capture when applications are closed.** For ~10 months a year `/apply` is a dead end. It should collect makers for the next window.

---

## 4. What the homepage should actually be

Ordered for job 1, with jobs 2–4 served by depth behind it.

```
MASTHEAD              Est. 2015 · Show XXII                        [institution, 1 line]
HERO                  photograph · headline · DATES · FREE · [Add to calendar]  ← fix
FACTBAR               Free · 3 days · 100+ makers · Since 2015 · 22 shows
PRESS                 NBC LA · Orange Coast · Dana Point Times
POSITION              two paragraphs, then "read the whole thing →"
PLATE                 full-bleed photograph
WHAT YOU'LL FIND      categories + price ranges + 4 merchants        ← her real question
VISITING              parking · strollers · food · how long · free   ← promoted
FILM                  three minutes
ELEVEN YEARS          venues, the rule, archive teaser →             ← archive demoted
EMAIL CAPTURE         "roster announcements and early access"        ← new
MERCHANTS             directory, linked
SELLING WITH US       3 lines → /apply
FOOTER                sitemap · sponsorship · colophon
```

Everything cut from here gets a real page: `/archive`, `/apply`, `/merchants`, `/press`, `/sponsorship`. **The depth is what makes it institutional; the homepage is what makes it convert.** You get both by separating them — which is also the argument for building this on a real platform instead of a brochure.

---

## 5. The data you need before any of this is true

The archive in the current mockup is **fabricated**. Shows XV–XXI, the attendance figures, the merchant counts, and most of the directory names are plausible inventions so you could see the shape. **A single soft number inverts the entire institutional effect** — it's the one place where "close enough" is worse than nothing.

What has to be real, and where it likely lives:

| Data | Source |
|---|---|
| Every show: number, season, dates, venue | Venue contracts, `Dropbox/MERMADE/2021–2026`, old fliers |
| Merchant count per show | Past roster pages, `Fall 25 Merchant Applications` sheet, `Dropbox/MERMADE/mermade sales` |
| Attendance per show | ⚠️ Probably doesn't exist. **Start counting at the door in November** — a clicker and a tally sheet. Until then, publish a range and say it's an estimate, or omit the column |
| Gross sales per show | `Dropbox/MERMADE/mermade sales` |
| Full merchant list per show | Past roster pages + applications sheets |
| Press | NBC LA 2024, Orange Coast 2019, Dana Point Times |

**Rule: publish only what you can source.** Eight true rows beat twenty-two invented ones, and the footnote — *"Shows I–XIV are listed in the full archive"* — buys you time to reconstruct the early years.

**This is also the diligence pack.** A buyer will ask for exactly this table. Building it for the website builds it for the sale.

---

## 6. Hold each block accountable

Once it's on the new platform, every block should have a job you can measure. If it can't be measured, it's decoration.

| Block | Measures |
|---|---|
| Hero + dates | Scroll depth past hero; add-to-calendar clicks |
| Visiting | Time on block; correlation with attendance |
| Email capture | Signups / visitors — target 2–4% |
| Merchant directory | Organic entrances to maker pages |
| Apply | Application starts / `/apply` visits; started → submitted |
| Archive | Time on page; referrals from vendor and press traffic |
| Press | — trust signal, no direct metric |
| Sponsorship | Inquiries per season |

Instrument these from day one. Three years of it is worth real money at sale — and in the meantime it settles design arguments with evidence instead of taste.
