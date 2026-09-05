# Design System — "Driftwood"

**Locked Aug 27, 2026.** Build against these tokens. Don't invent values.

> Supersedes "Salt & Sun" (Aug 20), which ran EB Garamond + Jost over a clay/sage
> accent pair and aimed institutional. That direction was abandoned on Drew's call:
> *"make the site fun and clean and craft / surf / handmade — less serious."* An
> intermediate palette (bright teal / marigold / coral) was rejected as juvenile —
> it was a primary triad at full saturation. The system below is what replaced it.
> The implementation of record is `src/app/globals.css`.

---

## 1. Typography

**Revised September 2026.** The market's own two faces, not a fresh choice.

The Shopify theme export settles a question this document previously got wrong.
The old site's headings and nav are `type_heading_font: oswald_n6` and its body
is `type_base_font: figtree_n4`. It was never Trade Gothic. So the previous
entry here — Barlow Condensed chosen as "the closest free face to the Trade
Gothic Drew likes on the current site" — was solving for a face the site does
not use. Both real ones are free on Google Fonts, so we simply use them.

| Role | Family | Why |
|---|---|---|
| **Display + labels** | **Oswald**, set uppercase | What mermademarket.com already sets. A classic American gothic: flat terminals, tight apertures, poster-scaled. Returning shoppers should not have to wonder whether they are in the right place. |
| **Prose + UI** | **Figtree** | The old site's body face. Even colour at small sizes, a real italic, and it keeps forms and admin tables inside the same voice. |

**The rule: Oswald uppercase for anything you scan, Figtree for anything you read
or type into.**

Oswald → hero, section heads, nav, buttons, chips, eyebrows, table headers,
MM codes, ticker, admin page titles.
Figtree → body copy, ledes, the founder letter, grid answers, form inputs, hints,
table cells, prices, everything an operator reads at 14px.

```css
--font-c: var(--f-oswald),  'Arial Narrow', sans-serif;  /* display, uppercase */
--font-g: var(--f-figtree), system-ui, sans-serif;       /* prose */
--font-j: var(--f-figtree), system-ui, sans-serif;       /* UI, forms, tables */
--font-r: var(--f-garamond), Georgia, serif;             /* reserve serif, unused */
```

EB Garamond stays loaded as `--font-r` and nothing uses it. It was the previous
prose face and it is the obvious move if long-form reading (the journal, the
maker rules) ever wants a serif back. Deleting it is a one-line change; so is
bringing it back.

Real Trade Gothic Bold Condensed remains an option and would need a web licence
bought from Monotype. Shopify's font licence covers Shopify storefronts and does
not travel to a site we host. Nothing here depends on that renewal, which matters
for a business that may be sold.

The typography comparison lives at `/preview/type` — unlisted, so it is reachable
by link but not in the nav, the sitemap, or search.

### Scale

| Token | Size / line | Family | Use |
|---|---|---|---|
| `hero` | clamp(50, 11.4vw, 148) / .86 | Cond 700 upper | Home hero only |
| `band` | clamp(42, 9vw, 114) / .88 | Cond 700 upper | The one-claim band |
| `display` | clamp(34, 5.8vw, 74) / .90 | Cond 700 upper | Apply block, section heads |
| `heading` | clamp(30, 4.3vw, 52) / .94 | Cond 700 upper | Founder letter, subheads |
| `title-adm` | 34 / 1 | Cond 700 upper | Admin page titles |
| `prose` | 18.5 / 1.62 | Figtree 400 | Body copy |
| `prose-s` | 17 / 1.55 | Figtree 400 | Grid answers, captions in prose |
| `ui` | 14-17 / 1.5-1.6 | Figtree 400 | Interface text, table cells |
| `label` | 12–13 / .11em tracked, upper | Cond 600 | Eyebrows, field labels, th |
| `button` | 15–16 / .06em tracked, upper | Cond 700 | CTAs |
| `button-adm` | 13 / .07em tracked, upper | Cond 600 | Dense row actions |

Display sizes take `letter-spacing: -.006em` to −.008em. Tracked uppercase never goes
below 12px — condensed uppercase at 10px is unreadable, which is why the old 9.5px
labels are gone.

**The dynamic range is the point.** 13px to 148px on one page. When the range flattens,
the page reads underwhelming no matter how good the palette is.

---

## 2. Color

**Ported September 2026.** These are the Shopify theme's own values, read out of
`config/settings_data.json`, not a palette designed for this project. The
decision was to keep the site people already recognise rather than introduce a
new one.

| Token | Value | Theme setting |
|---|---|---|
| `--bone` | `#FFFFFF` | `bg_col` |
| `--shell` | `#F6F7F7` | faint tint band (ours, between white and scheme 1) |
| `--dune` | `#EBEFED` | `color_scheme_1_col` |
| `--ink` | `#171717` | `font_col_heads` |
| `--ink-2` | `#5C5C5C` | `font_col_base` |
| `--line` | `#DFE3E8` | `head_nav_div_col` |
| `--deep` | `#232323` | `btn_color` |
| `--accent` | `#BC9658` | `font_col_link`, `btn_color_hover` |
| `--foot-bg` | `#C5B9B9` | `foot_bg_col` |
| `--foot-text` | `#746767` | `foot_text_col` |

Buttons are `#232323` with white caps, `slightlyrounded` (3px), going gold on
hover — `btn_color` / `btn_color_text` / `btn_color_hover`. The gold is the one
accent and it does exactly one job: links, hovers, and the emphasised half of a
headline.

**What this replaced.** The previous palette was sage `#4A5B52` and straw
`#CBB27A` over bone and shell, with full-bleed colour bands. It was more
distinctive. It was also not what the business's audience has been looking at
for eleven years, and that was the call: a returning shopper should not have to
wonder whether they are in the right place. Recovering it means editing one
token block; nothing else in the stylesheet names a colour.

## 3. Imagery

The theme applies one thing to a photograph: `image_overlay_bg` black at
`image_overlay_opacity` 12%, with white text over it. That is now all `.ph`
does, and photographs are shown square.

**What this replaced.** A film pipeline — a soft-light duotone in sage and
straw, halation, two grain tiles, a vignette — plus an arched top on cards
that rhymed with the Community House trusses, plus paper grain on every flat
colour field. All of it is removed rather than dialled down, because a
half-applied treatment reads as a mistake where none reads as a decision.

The one exception is the hero, which keeps a centre-weighted scrim behind its
type. That is not decoration: white type at 100px over a bright photograph is
unreadable without it, and the old site solved the same problem with a darker
image.

## 4. Layout

- **Phone first, 390px.** Traffic arrives from Instagram stories. Design and review
  every shopper page at 390 before looking at desktop.
- Above the fold on a phone, always: one photograph, the dates, **"free"**, and one
  action. The hero is sized `min(calc(100svh - 132px), 850px)` precisely so the sticky
  masthead cannot push the date and the CTA below the fold.
- **Rules, not boxes** — but heavier than before. `2px solid var(--ink)` separates major
  bands; `1px solid var(--line)` does interior structure.
- Radii: `999px` on buttons, chips and inputs; `--arch` (`999px 999px 6px 6px`) on
  portrait photography. The arch echoes the barrel roof of the Community House and is
  the one ornamental move in the system — use it on maker portraits and the founder
  letter, not on landscape plates.
- Full-bleed imagery is encouraged; text never is.
- **Grid cells must divide evenly, or draw separators as borders on the cells rather
  than as a coloured gap.** A `gap`-bleed grid paints leftover cells as grey panels the
  moment the item count stops being a multiple of the column count.

---

## 5. Two registers, one system

The same tokens serve both audiences — the shift is in density, not in palette.

| | **Shopper pages** (`/`, `/schedule`, `/journal`) | **Vendor + admin** (`/apply`, `/portal`, `/admin`, `/pos`) |
|---|---|---|
| Voice | Warm, plain, reassuring | Precise, complete, unambiguous |
| Type | Huge Oswald display, Figtree prose | Oswald labels, Figtree data, tabular numerals always |
| Imagery | Dominant | None |
| Colour | Sage fields, straw highlights | Neutral ground; sage for status and links, straw for shortlist |
| Radii | Pills and arches | Pills, but small — `.btn-o` is 13px, five fit in one table cell |
| Job | Make her want to come | Make a maker trust you with $280 and a season of inventory |

**The admin half is for Drew, Hillary and a future buyer — not for shoppers.** It should
look like an instrument. Warmth is not the opposite of precision; noise is.

---

## 6. Content rules that outrank styling

These convert better than any typeface:

- **Dates, venue, and "free" above the fold.** If she has to hunt for whether it costs
  money, she's gone.
- **Price ranges on category chips.** Her question isn't "is this curated," it's "is
  there something for me and can I afford it."
- **A "Before you come" block** — parking, strollers, coffee, how long people stay. The
  most under-served content on every market site in America, and the difference between
  "maybe" and "I'm going."
- **Add to calendar** as the primary action outside application season.
- Real shop names and real faces over abstract craft language.
- Cut the exclamation points on shopper pages. Keep the warmth in the journal and on
  Instagram.

---

## 7. Assets

`brand/mermade-wordmark.svg` — primary lockup, vector, `currentColor`. The only mark in
nav and footer.
`brand/mermade-ribbon.png` — a stamp. Once or twice a page, often reversed white over
photography. Never the primary mark.
`brand/mermade-pennant.png` — ornament at section markers only. Sparingly.

**Still needed:** a one-line horizontal lockup, an **MM monogram** (the vendor-code
system is a brand asset nobody's using), reversed and single-color variants, clear-space
rules, and a portrait of Elise to replace the placeholder in the founder letter.
