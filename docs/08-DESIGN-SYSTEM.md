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

Three families. All free, all self-hosted through `next/font` — nothing here depends
on a licence renewal, which matters for a business that may be sold.

| Role | Family | Why |
|---|---|---|
| **Display + labels** | **Barlow Condensed**, set uppercase | The closest free face to the Trade Gothic Bold Condensed Drew likes on the current site. Grippy, American, undecorated. Carries a 148px hero and a 12px table header from one family. |
| **Prose** | **EB Garamond** | A humanist letter cut by hand, c. 1530. The oldest honest argument for a handmade market. Keeps the warmth that all-condensed would lose. |
| **UI, forms, tables** | **Barlow** | The upright of the same superfamily, so forms and admin tables sit inside the display voice instead of beside it. |

**The rule: Condensed uppercase for anything you scan, Garamond for anything you read,
Barlow for anything you type into.**

Barlow Condensed → hero, section heads, nav, buttons, chips, eyebrows, table headers,
MM codes, ticker, admin page titles.
EB Garamond → body copy, ledes, the founder letter, answers in the visiting grid.
Barlow → form inputs, hints, table cells, prices, everything an operator reads at 14px.

```css
--font-c: var(--f-cond),     'Arial Narrow', sans-serif;  /* display, uppercase */
--font-g: var(--f-garamond), Georgia, serif;              /* prose */
--font-j: var(--f-body),     system-ui, sans-serif;       /* UI, forms, tables */
```

Oswald was the serious alternative and is still a defensible swap — squarer, more
poster-like. It lost on small sizes: Barlow Condensed is the more legible of the two
in a 12px tracked table header, and this system asks one family to do both ends.

### Scale

| Token | Size / line | Family | Use |
|---|---|---|---|
| `hero` | clamp(50, 11.4vw, 148) / .86 | Cond 700 upper | Home hero only |
| `band` | clamp(42, 9vw, 114) / .88 | Cond 700 upper | The one-claim band |
| `display` | clamp(34, 5.8vw, 74) / .90 | Cond 700 upper | Apply block, section heads |
| `heading` | clamp(30, 4.3vw, 52) / .94 | Cond 700 upper | Founder letter, subheads |
| `title-adm` | 34 / 1 | Cond 700 upper | Admin page titles |
| `prose` | 19.5 / 1.62 | Garamond 400 | Body copy |
| `prose-s` | 18 / 1.55 | Garamond 400 | Grid answers, captions in prose |
| `ui` | 14–17 / 1.5–1.6 | Barlow 400 | Interface text, table cells |
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

```css
/* neutrals */
--bone:   #F6F2E8;  /* page ground */
--shell:  #EDE7D9;  /* recessed panels, factbar, letter */
--dune:   #E2D9C6;  /* the one deeper neutral — email capture */
--ink:    #191714;  /* primary text, dark surfaces */
--ink-2:  #4A463B;  /* secondary text */
--ink-3:  #8A8377;  /* labels, captions, muted */
--line:   #DDD5C5;  /* hairlines */

/* the two colours */
--deep:   #4A5B52;  /* sage */
--accent: #CBB27A;  /* pale straw */
--third:  #8A7A6B;  /* warm grey-brown, sparingly */
--on-deep:   #F6F2E8;
--on-accent: #211A0C;
--warn:   #8C3A2A;  /* admin only, never decorative */
```

**Two colours, not three.** Sage and straw are both earth pigments; they have been used
together for about four thousand years and cannot date, because they were never in
fashion to begin with. The fun comes from how confidently they are used — 114px of
straw on a sage field — not from how bright they are.

**Sage is a field colour.** It carries the utility bar, the claim band and the apply
block as full-bleed backgrounds, and it does double duty as the link/hover colour on
bone. It is dark enough (L≈36) to behave like ink with a cast rather than as a brand
blue. Do not lighten it toward mid-tone; a mid-tone field is what made the earlier
slate-blue version read like a municipal website.

**Straw is a highlight, never a text colour on bone.** `#CBB27A` on `#F6F2E8` is about
1.9:1 — it is legal only as a fill behind `--on-accent`, or as display type over
photography and over `--ink`/`--deep` fields. Never set body or label text in straw
on a light ground.

**Contrast:** `--ink` on `--bone` is 14.6:1. `--ink-2` on `--bone` is 7.3:1. `--ink-3`
is captions only, never body text. `--deep` on `--bone` is 6.4:1 — safe for links and
small labels, which is why every `--clay` role from the old system moved to it.
`--on-accent` on `--accent` is 8.9:1.

**Legacy aliases.** `--paper`, `--paper-2`, `--paper-3`, `--clay`, `--sage`, `--dark`
are kept in `:root` and point at the new tokens so components written against
"Salt & Sun" still render. Do not write new code against them.

---

## 3. Imagery — the film pipeline

Photography is the brand. Direction: **documentary, 35mm, natural light, people over
products.** Faces, hands, kids, the actual room. Not flat-lays on white.

Every image passes through the same treatment so a vendor's phone snapshot and a hired
shoot land in the same world. This is a **pipeline, not a per-photo mood**:

1. **A tinted duotone wash** — `linear-gradient(165deg, var(--accent), var(--deep))` at
   `mix-blend-mode: soft-light`, 0.7. This is what ties every photograph to the palette,
   and it means changing `--deep` re-grades the whole library.
2. **Bidirectional grain.** Silver halide both lightens and darkens — `mix-blend-mode:
   overlay` on mid-gray noise, never `multiply`.
3. **Halation.** Warm bloom off highlights — a `screen`-blended radial, blurred ~26px.
   The single biggest tell of real film versus a digital filter.
4. **Lifted blacks + warm vignette.** Film never reaches true black. Never let a shadow
   hit `#000`; the vignette is warm-toned, never neutral gray.

Reference implementation: `.ph`, `.ph::before`, `.hal`, `.gr`, `.gr2`, `.vig`,
`.vig-soft` in `globals.css`. Ship it as one `<Photo>` component so it can never be
applied inconsistently.

**Captions** are condensed label size: `Fall 2025 · Community House, Dana Point`. They
are what make photographs read as documentation rather than decoration.

**Video** — see `01-PRODUCT-SPEC.md` §2.2. Same grade, same grain, Mux or Cloudflare
Stream, poster frames, captions on testimonials, `prefers-reduced-motion` respected.

---

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
| Type | Huge condensed display, Garamond prose | Condensed labels, Barlow data, tabular numerals always |
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
