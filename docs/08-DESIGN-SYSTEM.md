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
MM codes, ticker, and every tracked caps label in the admin.
Figtree → body copy, ledes, the founder letter, grid answers, form inputs, hints,
table cells, prices, everything an operator reads at 14px.

```css
--font-c: var(--f-oswald),  'Arial Narrow', sans-serif;  /* display, uppercase */
--font-g: var(--f-figtree), system-ui, sans-serif;       /* prose */
--font-j: var(--f-figtree), system-ui, sans-serif;       /* UI, forms, tables */
--font-r: var(--f-garamond), Georgia, serif;             /* reserve serif, unused */
--font-m: 'JetBrains Mono', ui-monospace, monospace;     /* admin machine text, §5.1 */
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
| `title-adm` | clamp(27, 3.1vw, 38) / 1.06 | Figtree 500, sentence case | Admin page titles. **Not** uppercase and not Oswald: see §5.1 |
| `mono` | 11.5–12.5 / 1.55 | JetBrains Mono 400 | Admin machine text: subtitles, dates, ids, emails, counts |
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

The two halves of this product are not one design at two densities. They share a
business and a wordmark; almost nothing else.

| | **Shopper pages** (`/`, `/schedule`, `/journal`) | **Vendor + admin** (`/apply`, `/portal`, `/admin`, `/pos`) |
|---|---|---|
| Voice | Warm, plain, reassuring | Precise, complete, unambiguous |
| Type | Huge Oswald display, Figtree prose | Oswald caps labels, Figtree names and titles, mono for machine text |
| Imagery | Dominant | Identification only, never decoration |
| Ground | Bone and shell, gold accent | Near-black sidebar, near-white content, no accent |
| Radii | Pills and arches | 2px, or none |
| Job | Make her want to come | Make the next action obvious to someone eight hours into a load-in day |

**The admin half is for Drew, Hillary and a future buyer, not for shoppers.** It should
look like an instrument. Warmth is not the opposite of precision; noise is.

### 5.1 The admin language

**Locked September 2026,** on Drew's call: the Mermade admin follows the design
language of slowpokeshop.com, which he also built and knows works for this kind of
work. The implementation of record is `src/app/globals.css`, which is imported by
`src/app/admin/layout.tsx` and by nothing else, and the components in
`src/app/admin/ui.tsx`.

**Layout.** A fixed dark sidebar, 300px, `#0B0B0B`, against a near-white content
area, `#FAFAF8`. The sidebar carries the wordmark on a small white sticker plate,
the word ADMIN under it in tracked caps, then the nav. Each nav row is a
full-width outlined block: a 20px line icon, a letter-spaced caps label, and a
count badge on the rows that have one. The content column opens with a slim strip
reading ADMIN PANEL, the show it is scoped to, and a bordered square button top
right.

**Type, which is where the personality lives.** Three registers, and the pairing is
the whole move:

- **Oswald, uppercase, tracked** for anything you scan: nav rows, table headers,
  tabs, buttons, small labels, statuses.
- **Figtree, sentence case, plain** for the page title, which is large and
  low-contrast and never uppercase, and for names and prose. Figtree is the plain
  grotesque this system already owns; a third sans face would cost a download and
  say nothing the mono does not say better.
- **JetBrains Mono** for machine text: the subtitle under every page title, dates,
  ids, emails, counts, money in a secondary position, permit digits, the body of a
  sent message. Free under the OFL and self-hosted at
  `public/theme/fonts/jetbrains-mono-var-latin.woff2`. It was chosen for its tall
  x-height, which matches Figtree's closely enough that a name in the sans and an
  email in the mono read as one stacked cell rather than two typefaces.

The signature is the title pair: a large plain sentence-case title with a grey
monospace line under it carrying the counts. "Review queue" over
"30 applications to Fall 2026 · applications close Sep 18, 11:59 PM".

**The shapes.** Five, and every screen is built from them:

- **Stat card** — a bordered white card: caps label top left, line icon top right,
  one loud plain figure, a quiet mono note. Three or four across.
- **Action card** — wider, in the same style: icon, caps title, one mono line
  saying what is waiting. The whole card is the link.
- **Progress** — figure loud, unit quiet beside it, a solid black bar, a mono
  status line, a right-aligned caps link. Used for spaces filled and fees
  collected.
- **Tabs with count pills** — the filter strip above a table. Each tab is a caps
  label with its count in a pill; the active one takes a thick underline and its
  pill fills. `aria-current="page"` always accompanies it.
- **Table** — a real `<table>` with `<caption>` and `<th scope>`. Small tracked
  caps headers, hairlines only, generous row height. Where an entity has a primary
  and a secondary identifier they stack in one cell: name in Figtree over email in
  grey mono. Money and counts are right-aligned and tabular. **Status is plain
  text, never a coloured badge.** A small square thumbnail can lead a row, for
  identification and not for judgement. A chevron on the right expands the row in
  place.

**Buttons.** The primary is a solid black rectangle with white tracked caps, top
right of the page, one per screen at most. Row actions are quiet outlined caps
buttons. Secondary navigation is a caps link with a trailing arrow.

**Colour does one job each.** Ink on off-white carries everything. Red
(`--ad-warn`) marks only what is genuinely wrong. The bright blue appears in
exactly one place, as the 2px outline on the active nav row, and it is never the
only signal: that row also carries `aria-current="page"`, a white label and a
filled marker.

**Expanding a row.** The queue expands in place rather than opening a drawer: a
checkbox inside the chevron label, a CSS `:has()` rule on the row's `<tbody>`, no
JavaScript. Written so a browser without `:has()` renders every row expanded
rather than hiding content it cannot reveal.

**On a phone.** The sidebar becomes a drawer behind a menu button in the top
strip. Closed, it is `visibility: hidden`, which takes every link in it out of the
tab order without any focus management. Table columns step out from the right as
the viewport narrows, lowest value first, and everything they carried is still in
the expanded row.

**Accessibility is not a later pass.** Sidebar labels run at least 7:1 on the dark
ground, the blue outline 4.4:1, body grey 6.7:1 and muted grey 4.9:1 on the
content ground. Every table has a caption, every icon is `aria-hidden` with a
label beside it, every repeated control carries the shop name in visually hidden
text so a hundred rows do not announce a hundred identical "Shortlist"s.

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

---

## 8. The information system

Added September 2026, after the maker-rules pages were rebuilt. The direction
Drew asked for: "I want our organization of information to be incredibly well
presented." This is the part of the system that decides *shape*, not style,
and it applies in both registers.

### The rule behind all of it

**Answer the obvious questions before you explain anything.** Every page that
carries facts opens with the facts, in a form you can read without reading,
and puts the prose underneath. A maker deciding whether to apply has six
questions. They should be able to answer all six in about ten seconds, and
then read two thousand words only if they want to.

The failure this replaced: three columns of identical 15px paragraphs, where
the commission rate, the booth fee and the deadline were sentences in the
middle of the third one.

### The four shapes

Use the shape that matches what the information *is*. Don't reach for a
paragraph when the content is a table.

**Fact table** (`FactTable`) — a short list of label/value pairs answering the
questions a reader arrives with. Labels are Oswald 600 uppercase and small,
values are Figtree and can be a phrase or a whole sentence. Six to eight rows;
past that it stops being scannable and you want a section instead. Give it a
CTA when the obvious next move is one link.

**Price table** (`PriceTable`) — anything with money in it. Three columns:
what it is, what it suits, what it costs. Figures live in their own
right-aligned column with tabular numerals so they stack and compare. Add-ons
go in a labelled sub-band inside the same table, never in a second table, so a
maker sees the whole cost of a decision in one place.

**Stat row** (`StatRow`) — three to five tiles for counts, where the number is
the message. The figure is large, its label is small and uppercase beneath it.
Never invent a figure to fill a tile; a tile that has no real number does not
ship (see §6).

**Timetable** — dated or sequenced things as a ruled list with the date in its
own column. Used for the show schedule and for "dates that matter" on /apply.
The reader's eye should run down the dates, not through the sentences.

### In the admin

The same four shapes, in the institutional register: smaller, denser, no
photography, ruled rather than airy. A screen staff sit in for hours has one
extra obligation, which is to make the *next action* obvious. So:

- Open with a stat row of the counts the operator is working against.
- Sort so the rows that need action come first. A roster is not an alphabet.
- Every table is a real `<table>` with real `<th>` scope, tabular numerals,
  and no more columns than the decision needs.
- Group a long form into named sections. `/admin/show` drives every date,
  price and rate on the public site, and it should read like an instrument
  panel, not a wall of inputs.

### What not to do

- Don't put a number in prose if it belongs in a column.
- Don't use a card where a row will do. Cards cost vertical space and give
  nothing back unless there is an image.
- Don't repeat a page's title as the heading of a section inside it.
- Don't write a label that restates the value ("Booth fee: the booth fee").
- Don't ship a shape with placeholder content in it. An empty table is a bug;
  a table you filled with guesses is worse.
