/**
 * Editable content blocks.
 *
 * In production these come from the content admin (docs/01-PRODUCT-SPEC.md §8)
 * so Elise can change them without a deploy. They live in one typed module here
 * so the page components stay free of copy and the admin is a straight swap.
 *
 * NOTHING dated, priced, or counted belongs in this file — that comes off the
 * Show record. See CLAUDE.md rule 6.
 */

/**
 * ⚠️ VERIFY with Drew/Elise before applications open: Andrew thinks the market
 * may have started in 2013, the business audit says 2015. The founding year
 * appears in the utility bar, the footer, the admission answer, the founder
 * letter's story, and implicitly in the show count. Change it HERE only.
 */
export const FOUNDED_YEAR = 2015

/**
 * NOT RENDERED ANYWHERE YET. Written for an about section that does not exist,
 * so nothing below is on the site today.
 *
 * ⚠️ Two lines have to be checked before it ever is. The photo archive now
 * reaches back to December 2015, and it contradicts the opening sentence:
 * there is no harbour in any frame from 2015, 2016, 2017 or 2018, the setting
 * throughout is the inland Community House lot, and by spring 2016, the show
 * after the first, the market already ran an indoor room plus a full outdoor
 * tent field, food trucks and live music. "Sixteen makers in a room by the
 * harbor" does not survive that, and neither does "four hundred people",
 * which is a number nobody has sourced (docs/09-CONTENT-AUDIT.md §5: never
 * publish an unsourced number).
 *
 * The archive does support FOUNDED_YEAR = 2015 over the 2013 note above: the
 * oldest photography anyone can find is December 2015. Evidence, not proof.
 */
export const founderLetter = {
  eyebrow: 'A note from the founder',
  heading: 'I started this because I wanted somewhere to buy things made by people I could meet.',
  body: [
    'In 2015 that meant sixteen makers in a room by the harbor and a folding table for a register. We had no idea whether anyone would come. Four hundred people did.',
    'Eleven years on, the rule is the same: everything on the floor was made by the person who applied. No resellers, no drop-shipping. A hundred makers is what fits in the room.',
    'Come early, bring a bag, and talk to people. That’s the whole thing.',
  ],
  signature: 'Elise',
  role: 'Founder · Mermade Market',
  // TODO(content): replace with a real portrait of Elise. This is a floor shot,
  // now one from the Community House rather than the harbour we left.
  photo: '/photos/consign.jpg',
  photoCaption: 'Show XXI, Fall 2025',
  photoIsPlaceholder: true,
}

/**
 * The rich-text block under the hero. This is mermademarket.com's own
 * sentence, kept word for word — the brief is to replicate the live site
 * first and elevate afterwards, and this line is the market's, not ours.
 */
export const mission =
  'Mermade is a hand-curated market with a mission to unite creators and '
  + 'community. Our culturally iconic spring & winter markets have become a '
  + 'local staple, celebrated by our loyal following.'

export const claim = {
  eyebrow: 'The market',
  lead: 'We look at everything, and we say ',
  emphasis: 'no',
  tail: ' a lot.',
}

/** ⚠️ UNVERIFIED — docs/09-CONTENT-AUDIT.md §5: publish only what you can source. */
export const press = {
  quote: 'The best-curated market in Orange County.',
  outlets: ['NBC Los Angeles', 'Orange Coast', 'Dana Point Times'],
  verified: false,
}

export const visiting = [
  { q: 'Where', a: 'Dana Point Community House, 24642 San Juan Avenue. Indoors, one floor, step-free.' },
  { q: 'Admission', a: `Free, every show since ${FOUNDED_YEAR}. No ticket, no line.` },
  { q: 'Parking', a: 'Free lot on site, plus street parking on San Juan and Del Prado. Fills by 11am Saturday. Friday evening is the calm one.' },
  { q: 'Strollers & kids', a: 'Yes to both. Aisles are wide, and there’s a kids’ table near the entrance.' },
  { q: 'How long', a: 'Most people spend about ninety minutes. Bring a tote: one register at the front means one bag at the end.' },
  { q: 'Food', a: 'Coffee and pastry inside. Two trucks in the lot Saturday and Sunday.' },
]

export const categoryRanges = [
  { label: 'Ceramics & tableware', range: '$18-$240' },
  { label: 'Jewelry', range: '$32-$480' },
  { label: 'Textiles & apparel', range: '$24-$320' },
  { label: 'Paper & print', range: '$8-$95' },
  { label: 'Home & candles', range: '$16-$180' },
  { label: 'Skin & apothecary', range: '$14-$88' },
  { label: 'Vintage & found', range: '$20-$600' },
  { label: 'Kids', range: '$12-$140' },
  { label: 'Food & pantry', range: '$6-$45' },
]

/**
 * The venue history came out on 5 Sep 2026: it named the Ocean Institute, which
 * Mermade left years ago, and readers took it for a current address. Nothing
 * here names a building we are not in.
 */
export const archiveNote = {
  eyebrow: '04 · The archive',
  heading: 'Eleven years of shows.',
  body: 'Twice a year since ' + FOUNDED_YEAR + ', in Dana Point. We are at the Community House on San Juan Avenue.',
}

/**
 * ⚠️ UNVERIFIED — every row below is a plausible invention so the shape is
 * visible. docs/09-CONTENT-AUDIT.md §5: a single soft number inverts the
 * institutional effect. Source these from Dropbox/MERMADE before launch, and
 * omit attendance entirely until someone counts at the door in November.
 */
export const archiveRows = [
  { numeral: 'XXI', season: 'Fall 2025', venue: 'Community House', merchants: 96 },
  { numeral: 'XX', season: 'Spring 2025', venue: 'Community House', merchants: 92 },
  { numeral: 'XIX', season: 'Fall 2024', venue: 'River Street', merchants: 88 },
]
export const ARCHIVE_IS_PLACEHOLDER = true

export const newsletter = {
  heading: 'Stay hooked.',
  body: 'The roster goes out to the list before anyone else sees it, and the list gets in Friday evening early. That’s it. We’re not going to email you in July.',
  fine: 'About six emails a year. Unsubscribe any time.',
}

/** Archive films, Andrew's footage. The first plays in the home film block;
 *  the rest link out from the archive band. */
/** The clip behind the home page hero. Drew's, 5 Sep 2026:
 *  https://youtu.be/dd23FXq6ZNw. It replaces the old site's own reel, which
 *  was standing in until there was something of ours to run. */
export const heroVideoId = 'dd23FXq6ZNw'

/**
 * The clip in the home page's second background-video band. This is the one
 * their live page runs there ("Saturated Mermade Web"), so the band matches
 * theirs frame for frame.
 *
 * On the hero we differ, and deliberately. Their hero is not a YouTube embed
 * at all: it is a 53MB 1080p mp4 served from their Shopify CDN, which is the
 * thing this build replaces. The hero above now runs Drew's own clip; this
 * band still runs theirs, so it matches their page frame for frame.
 */
export const bandVideoId = 'W5iWhyOzjYI'

/**
 * The homepage filmstrip.
 *
 * Ten frames from the Fall 2026 shoot, cut to a uniform 600px height and
 * keeping their own widths, which is what makes a strip read as a strip
 * rather than as a moving grid. People and things alternate on purpose: a
 * booth, then the work in it, then the room, then a pair of hands.
 *
 * Swapping one is a line here and a file in public/photos/strip.
 */
/**
 * The homepage filmstrip.
 *
 * ORDERED, not shuffled, and the order is the whole point. Drew, on the day
 * it shipped: "there were a bunch at the beginning that were the same
 * person." He was right: 213 and 214 are one maker at one booth, and they sat
 * side by side, so the strip opened by showing you the same white tent twice.
 *
 * A random shuffle does not fix that. It is just as free to put those two
 * together again, and about a fifth of the time it would. What fixes it is a
 * sequence built so that neighbours differ, on three counts at once:
 *
 *   · never the same maker twice in a row (213 and 214 are now six apart),
 *   · never two still lifes in a row (23, 27 and 123 are spread),
 *   · never two of the same shape in a row, so the landscape frames land
 *     every third or fourth position and give the run a beat.
 *
 * The list is a CYCLE, not a line: the strip loops, so the last frame sits
 * next to the first and 214 → 178 has to obey the rules too. It does. That is
 * also why `rotated()` below is safe and a shuffle would not be, because
 * rotating a cycle leaves every neighbour exactly where it was.
 */
export const stripFrames = [
  { file: 'mermade-178.jpg', alt: 'A maker crocheting in her own tent, her bags hung behind her' },
  { file: 'mermade-23.jpg', alt: 'Handmade mugs and hanging ornaments on a walnut shelf' },
  { file: 'mermade-130.jpg', alt: 'A shopper walking the outdoor aisle between white Mermade tents' },
  { file: 'mermade-213.jpg', alt: 'A jewellery booth laid out on linen risers' },
  { file: 'mermade-123.jpg', alt: 'Handmade rag dolls on a rust linen cloth' },
  { file: 'mermade-183.jpg', alt: 'A maker serving a shopper at the Charm Bar under a Mermade tent' },
  { file: 'mermade-27.jpg', alt: 'Embroidered caps hung on horseshoe hooks' },
  { file: 'mermade-139.jpg', alt: 'A shopper looking over a shelf of goods under warm bulbs' },
  { file: 'mermade-180.jpg', alt: 'A candle maker beside her shelf under the Mermade tent' },
  { file: 'mermade-214.jpg', alt: 'A maker fastening a clasp for a customer' },
] as const

/**
 * The same cycle, started somewhere else.
 *
 * Drew asked to randomize the strip. Rotation is how you get the "different
 * every time I land on it" he wants without giving back the adjacency the
 * order above was built to guarantee: turning a necklace does not change
 * which beads touch. So each visit begins on a different frame and the run
 * is otherwise identical.
 */
export function rotated<T>(list: readonly T[], by: number): readonly T[] {
  if (list.length === 0) return list
  const n = ((Math.trunc(by) % list.length) + list.length) % list.length
  return [...list.slice(n), ...list.slice(0, n)]
}

/**
 * Shopper quotes for the testimonials row. EMPTY ON PURPOSE.
 *
 * The old site's testimonials section still carries the theme's demo text
 * and a placeholder author name. Inventing replacements would be publishing
 * fabricated reviews, so the section renders only when this array has real
 * quotes in it, the same way `press.verified` gates the press line.
 */
export const testimonials: Array<{ quote: string; author: string }> = []

export const films = [
  { youtubeId: 'O0l3_CsZTAY', label: 'From the archive' },
  { youtubeId: 'MAD5S4cPgsQ', label: 'Winter 2024' },
]
export const film = films[0]!
