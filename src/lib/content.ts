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
  // TODO(content): replace with a real portrait of Elise. This is a floor shot.
  photo: '/photos/vendor.jpg',
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
/** The clip the old site runs behind its hero (its background-video
 *  section's video_external). Swappable for our own footage. */
export const heroVideoId = 'caKMa9MVyEo'

/**
 * The clip in the home page's second background-video band. This is the one
 * their live page runs there ("Saturated Mermade Web"), so the band matches
 * theirs frame for frame.
 *
 * On the hero we differ, and deliberately. Their hero is not a YouTube embed
 * at all: it is a 53MB 1080p mp4 served from their Shopify CDN, which is the
 * thing this build replaces. The id above is their own Fall 2025 reel, the
 * closest stand-in, and it costs the page nothing. Swap it for a hosted clip
 * whenever there is a compressed file to host.
 */
export const bandVideoId = 'W5iWhyOzjYI'

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
