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

export const founderLetter = {
  eyebrow: 'A note from the founder',
  heading: 'I started this because I wanted somewhere to buy things made by people I could meet.',
  body: [
    'In 2015 that meant sixteen makers in a room by the harbor and a folding table for a register. We had no idea whether anyone would come. Four hundred people did.',
    'Eleven years later the rule hasn’t changed: everything on the floor is made by the person who applied. No resellers, no drop-ship, no wholesale lines dressed up as small batch. We read every application, and most seasons we say no to four out of five — not because the work isn’t good, but because a hundred makers is what fits, and what fits is what makes it worth your Saturday.',
    'Come early, bring a bag, and talk to people. That’s the whole thing.',
  ],
  signature: 'Elise',
  role: 'Founder · Mermade Market',
  // TODO(content): replace with a real portrait of Elise. This is a floor shot.
  photo: '/photos/vendor.jpg',
  photoCaption: 'Show XXI, Fall 2025',
  photoIsPlaceholder: true,
}

export const claim = {
  eyebrow: 'The market',
  lead: 'Every maker here was chosen by a person who ',
  emphasis: 'looked at the work',
  tail: ' — and said no to four out of five.',
}

/** ⚠️ UNVERIFIED — docs/09-CONTENT-AUDIT.md §5: publish only what you can source. */
export const press = {
  quote: 'The best-curated market in Orange County.',
  outlets: ['NBC Los Angeles', 'Orange Coast', 'Dana Point Times'],
  verified: false,
}

export const visiting = [
  { q: 'Where', a: 'Dana Point Community House, 24642 San Juan Avenue. Indoors, one floor, step-free.' },
  { q: 'Admission', a: 'Free, as it has been every year since 2015. No ticket, no line.' },
  { q: 'Parking', a: 'Free lot on site, plus street parking on San Juan and Del Prado. Fills by 11am Saturday — Friday evening is the calm one.' },
  { q: 'Strollers & kids', a: 'Yes to both. Aisles are wide, and there’s a kids’ table near the entrance.' },
  { q: 'How long', a: 'Most people spend about ninety minutes. Bring a tote — one register at the front means one bag at the end.' },
  { q: 'Food', a: 'Coffee and pastry inside; two trucks in the lot Saturday and Sunday.' },
]

export const categoryRanges = [
  { label: 'Ceramics & tableware', range: '$18 – $240' },
  { label: 'Jewelry', range: '$32 – $480' },
  { label: 'Textiles & apparel', range: '$24 – $320' },
  { label: 'Paper & print', range: '$8 – $95' },
  { label: 'Home & candles', range: '$16 – $180' },
  { label: 'Skin & apothecary', range: '$14 – $88' },
  { label: 'Vintage & found', range: '$20 – $600' },
  { label: 'Kids', range: '$12 – $140' },
  { label: 'Food & pantry', range: '$6 – $45' },
]

export const archiveNote = {
  eyebrow: '03 · The archive',
  heading: 'Eleven years, three venues, one rule.',
  body: 'We’ve outgrown two buildings. The Ocean Institute, then River Street, now the Community House. The rule that survived all three moves is the only one that matters: the person who made it is the person who applied.',
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
  heading: 'The roster goes out to the list first.',
  body: 'Two shows a year. We announce the merchant lineup, the floor plan, and Friday-evening early access to subscribers before anyone else. Nothing else — we’re not going to email you in July.',
  fine: 'About six emails a year. Unsubscribe any time.',
}
