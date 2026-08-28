import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db, sqlite } from './index'
import {
  shows, spaceTypes, vendors, applications, bookings,
  auditLog, emailOutbox, subscribers, type Category,
} from './schema'

/**
 * Realistic-shaped seed data. (CLAUDE.md working style: "seed realistic data
 * first — everything is easier to build and demo against real-shaped data.")
 *
 * The names and figures here are INVENTED. Real archive and roster data has to
 * come from Dropbox/MERMADE before anything ships. See docs/09-CONTENT-AUDIT.md §5.
 */

/** Each shop is pinned to the product index that actually fits its name. */
const SHOP_NAMES: Array<[name: string, product: number]> = [
  ['Laurel Grace Studios', 0], ['Kingdom & State', 1], ['Drawers Co.', 2],
  ['Salt Cellar', 3], ['Ocean & Oak', 4], ['Marigold Press', 1],
  ['The Quiet Kiln', 0], ['Hollow Hill Goods', 7], ['Poppy & Pine', 11],
  ['Wren Ceramics', 0], ['Field Notes Paper', 1], ['Sunday Linen', 2],
  ['Harbor Small Batch', 9], ['Tidepool Textiles', 6], ['Cardinal & Co.', 4],
  ['Blue Hour Candle', 5], ['The Mending Table', 2], ['Juniper Row', 5],
  ['Sea Glass Studio', 4], ['Argonaut Leather', 7], ['Foxglove Apothecary', 3],
  ['Little Wolf Kids', 8], ['Bramble & Bone', 10], ['Third Coast Clay', 0],
  ['Almanac Goods', 6], ['Saltbox Provisions', 9], ['The Paper Anchor', 1],
  ['Mesa Verde Weaving', 6], ['Nine Mile Jewelry', 4], ['Copper Rose Metals', 4],
]

const FIRST = ['Hannah', 'Marisol', 'Dev', 'Claire', 'Tom', 'Yuki', 'Priya', 'Sam',
  'Renata', 'Ben', 'Naomi', 'Chris', 'Ada', 'Luis', 'Fern']
const LAST = ['Whitcomb', 'Reyes', 'Patel', 'Ostrander', 'Lund', 'Tanaka', 'Shah',
  'Brennan', 'Ferreira', 'Okafor', 'Villanueva', 'Doyle', 'Kimura', 'Marchetti']

const CITIES: [string, string][] = [
  ['Dana Point', 'CA'], ['San Clemente', 'CA'], ['Long Beach', 'CA'], ['Costa Mesa', 'CA'],
  ['Encinitas', 'CA'], ['Ojai', 'CA'], ['Los Angeles', 'CA'], ['Santa Ana', 'CA'],
  ['Laguna Beach', 'CA'], ['Portland', 'OR'],
]

const PRODUCTS: Array<{ category: Category; blurb: string; low: number; high: number }> = [
  { category: 'Ceramics', low: 1800, high: 18500,
    blurb: 'Wheel-thrown stoneware fired in small batches, glazed in a palette pulled from the tidepools at Salt Creek. Everything is made and finished by me in a garage studio.' },
  { category: 'Paper/Art', low: 800, high: 6400,
    blurb: 'Letterpress and risograph printing on cotton paper, using a 1962 Vandercook I restored myself. Cards, prints, and a small run of bound notebooks.' },
  { category: 'Apparel', low: 4600, high: 29000,
    blurb: 'Naturally dyed linen — indigo, madder, and onion skin — cut and sewn into everyday pieces meant to be worn until they go soft.' },
  { category: 'Bath & Body', low: 1400, high: 7200,
    blurb: 'Small-batch skin and scent formulated in-house. Six products, no fillers, and every batch is numbered and dated on the label.' },
  { category: 'Jewelry', low: 3200, high: 48000,
    blurb: 'Hand-forged brass and sterling, made with a torch and a bench block. No casting, no outsourcing — each piece is worked one at a time.' },
  { category: 'Candles', low: 1600, high: 9800,
    blurb: 'Beeswax candles poured into vintage vessels I source at estate sales across Orange County. Every vessel is one of one.' },
  { category: 'Home', low: 5400, high: 42000,
    blurb: 'Woven wall pieces and table runners on a floor loom, using undyed wool from a mill in the Central Valley.' },
  { category: 'Leather', low: 9000, high: 38000,
    blurb: 'Leather bags cut, punched, and saddle-stitched by hand from vegetable-tanned hides. Built to be repaired, not replaced.' },
  { category: 'Kids', low: 1200, high: 14000,
    blurb: 'Play silks, wooden rattles, and tiny knitted things. Everything is tested against CPSIA limits and made in my kitchen.' },
  { category: 'Treats', low: 600, high: 4500,
    blurb: 'Cottage-licensed shortbread and sea-salt caramels, baked the week of the show. Everything is under ten dollars and travels well.' },
  { category: 'Vintage', low: 2000, high: 60000,
    blurb: 'Curated mid-century glass and California pottery, sourced across estate sales in Orange and San Diego counties. Cleaned and photographed, never restored.' },
  { category: 'Plants', low: 1400, high: 12000,
    blurb: 'Propagated houseplants in pots I throw myself, plus a small run of hanging planters. Nothing here was bought wholesale.' },
]

const DECLINE_TEMPLATES = [
  'Category was full this season — we take one to three makers per category.',
  'The photography made it hard to judge the work. Natural light on a plain background helps.',
  'Not enough differentiation from makers already on the roster.',
]

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!
}

async function main() {
  // Idempotent: wipe and rebuild.
  await db.delete(auditLog)
  await db.delete(emailOutbox)
  await db.delete(subscribers)
  await db.delete(bookings)
  await db.delete(applications)
  await db.delete(vendors)
  await db.delete(spaceTypes)
  await db.delete(shows)

  /* ── the Show. Every date, price, and rate in the app comes from here. ── */
  const showId = randomUUID()
  await db.insert(shows).values({
    id: showId,
    slug: 'fall-2026',
    numeral: 'XXII',
    name: 'Fall 2026',
    season: 'fall',
    year: 2026,
    venueName: 'Community House',
    venueAddress: '24642 San Juan Avenue, Dana Point, CA 92629',
    startsOn: '2026-11-13T12:00:00-08:00',
    endsOn: '2026-11-15T12:00:00-08:00',
    hoursNote: 'Friday 13 November, 5 – 9pm · Saturday 14th, 10am – 5pm · Sunday 15th, 10am – 4pm',
    // CONFIRMED by Drew, 25 Aug 2026: applications open Monday 7 September.
    // Close date mirrors the Spring window's shape (Mon 2 – Fri 13 March, 11 days)
    // — confirm before launch. Editable in /admin/show, never in code.
    applicationsOpenAt: '2026-09-07T09:00:00-07:00',
    applicationsCloseAt: '2026-09-18T23:59:00-07:00',
    rosterAnnouncedOn: '2026-10-05T12:00:00-07:00',
    commissionBps: 2000,
    paymentWindowHours: 36,   // Drew's real published policy; audit §2.3 recommends 48
    indoorCapacity: 82,
    outdoorCapacity: 36,
    isActive: true,
  })

  /* ── priced inventory ── */
  // Real prices from mermademarket.com/pages/merchant-application (Aug 2026).
  // Indoor is granular by footprint; outdoor is priced per DAY, not per weekend.
  const spaces = [
    { code: 'IN-JR',    track: 'indoor' as const,  label: 'JR Space',            priceCents:  6_000, capacity:  6, description: 'For makers 14 and under.' },
    { code: 'IN-TREAT', track: 'indoor' as const,  label: 'Treats on a Shelf',   priceCents: 10_000, capacity:  8, description: 'Shelf space for cottage-food makers. Items $10 and under.' },
    { code: 'IN-BTQ',   track: 'indoor' as const,  label: 'BTQ Space',           priceCents: 15_000, capacity: 10, description: 'Small boutique footprint.' },
    { code: 'IN-3x4',   track: 'indoor' as const,  label: "3' × 4' space",       priceCents: 26_000, capacity: 16, description: 'Compact. Suits jewelry and paper.' },
    { code: 'IN-3x6',   track: 'indoor' as const,  label: "3' × 6' space",       priceCents: 28_000, capacity: 24, description: 'The standard indoor space.' },
    { code: 'IN-3x8',   track: 'indoor' as const,  label: "3' × 8' space",       priceCents: 34_000, capacity: 12, description: 'Room for a rack alongside a table.' },
    { code: 'IN-3x12',  track: 'indoor' as const,  label: "3' × 12' space",      priceCents: 45_000, capacity:  6, description: 'The largest indoor footprint.' },
    { code: 'OUT-FRI',  track: 'outdoor' as const, label: 'Outdoor — Friday',    priceCents: 40_000, capacity: 12, description: '9am – 6pm. You run your own payments and keep 100%.' },
    { code: 'OUT-SAT',  track: 'outdoor' as const, label: 'Outdoor — Saturday',  priceCents: 50_000, capacity: 12, description: '9am – 5pm. You run your own payments and keep 100%.' },
    { code: 'OUT-SUN',  track: 'outdoor' as const, label: 'Outdoor — Sunday',    priceCents: 45_000, capacity: 12, description: '9am – 5pm. You run your own payments and keep 100%.' },
  ]
  const spaceIds: Record<string, string> = {}
  for (const [i, s] of spaces.entries()) {
    const id = randomUUID()
    spaceIds[s.code] = id
    await db.insert(spaceTypes).values({ id, showId, sortOrder: i, ...s })
  }

  /* ── 30 applicants across the pipeline ── */
  // Deliberate distribution: enough in `new` to have something to jury, enough
  // accepted+paid that the homepage roster and the register have real rows.
  const plan: Array<[status: string, count: number]> = [
    ['new', 9],
    ['under_review', 3],
    ['shortlist', 3],
    ['accepted', 10],   // 7 of these get paid below
    ['waitlist', 2],
    ['declined', 3],
  ]

  let i = 0
  let paidCount = 0
  for (const [status, count] of plan) {
    for (let n = 0; n < count; n++, i++) {
      const [shopName, productIdx] = pick(SHOP_NAMES, i)
      const contactName = `${pick(FIRST, i * 3)} ${pick(LAST, i * 5)}`
      const [city, state] = pick(CITIES, i)
      const handle = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '')
      const track = i % 5 === 0 ? 'outdoor' : 'indoor'
      const OUT = ['OUT-FRI', 'OUT-SAT', 'OUT-SUN'] as const
      const IN = ['IN-3x6', 'IN-3x4', 'IN-3x6', 'IN-3x8', 'IN-BTQ', 'IN-3x6',
                  'IN-3x12', 'IN-3x6', 'IN-TREAT', 'IN-3x4', 'IN-JR', 'IN-3x6'] as const
      const spaceCode: string = track === 'outdoor' ? OUT[i % 3]! : IN[i % IN.length]!

      const product = PRODUCTS[productIdx]!

      const vendorId = randomUUID()
      const repeat = i % 4 === 0
      await db.insert(vendors).values({
        id: vendorId,
        shopName,
        contactName,
        email: `${handle}@example.com`,
        phone: `(949) 555-${String(1000 + i).slice(-4)}`,
        website: i % 3 ? `https://${handle}.com` : null,
        instagram: `@${handle}`,
        city, state,
        showsAttended: repeat ? 1 + (i % 3) : 0,
        // one deliberate flag so the jury UI's warning path is visible
        isFlagged: i === 11,
        flagReason: i === 11 ? 'No-show at Spring 2025 after paying' : null,
      })

      const appId = randomUUID()
      const scored = status !== 'new'
      await db.insert(applications).values({
        id: appId, showId, vendorId,
        track,
        spaceTypeId: spaceIds[spaceCode]!,
        category: product.category,
        description: product.blurb,
        priceLowCents: product.low, priceHighCents: product.high,
        madeByYou: i === 17 ? 'curate_resell' : i % 6 === 0 ? 'mostly_sourced_components' : 'all',
        usesAiArtwork: i === 23,
        isMlm: i === 26,
        sellerPermit: i % 8 === 0 ? '' : `1${String(100_000_00 + i * 7).slice(0, 8)}`,
        occasionalSeller: i % 8 === 0,
        hasCoi: i % 3 !== 0,
        status,
        scoreQuality: scored ? 3 + (i % 3) : null,
        scoreOriginality: scored ? 2 + (i % 4) : null,
        scoreBrand: scored ? 3 + (i % 3) : null,
        scoreFit: scored ? 3 + (i % 3) : null,
        juryNotes: status === 'shortlist' ? 'Strong photos. Would sit well near the window.' : '',
        decidedAt: ['accepted', 'declined', 'waitlist'].includes(status)
          ? new Date(Date.now() - (i + 1) * 3600_000).toISOString() : null,
        decidedBy: ['accepted', 'declined', 'waitlist'].includes(status)
          ? 'elise@mermademarket.com' : null,
        declineReason: status === 'declined' ? pick(DECLINE_TEMPLATES, i) : null,
        signedName: contactName,
      })

      if (status === 'accepted') {
        const code = `MM${String(paidCount + 1).padStart(2, '0')}`
        await db.update(vendors).set({ vendorCode: code }).where(eq(vendors.id, vendorId))
        const paid = paidCount < 7
        await db.insert(bookings).values({
          id: randomUUID(), showId, vendorId, applicationId: appId,
          spaceTypeId: spaceIds[spaceCode]!,
          vendorCode: code,
          priceCents: spaces.find((s) => s.code === spaceCode)!.priceCents,
          commissionBps: 2000,
          status: paid ? 'confirmed' : 'awaiting_payment',
          paymentDueAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
          paidAt: paid ? new Date(Date.now() - 2 * 3600_000).toISOString() : null,
        })
        paidCount++
      }
    }
  }

  for (const [n, e] of ['ana', 'jules', 'meg', 'priya', 'tess'].entries()) {
    await db.insert(subscribers).values({
      id: randomUUID(), email: `${e}@example.com`, source: n % 2 ? 'home' : 'instagram',
    })
  }

  console.log(`Seeded: 1 show, ${spaces.length} space types, ${i} applicants, ${paidCount} bookings.`)
}

main().then(() => {
  // Fold the WAL back into mermade.db and close cleanly, so the main db file
  // alone carries all seeded rows. On Vercel only that file is bundled into
  // the serverless functions; without this checkpoint the seed data stays in
  // the -wal sidecar and the deployed db is empty.
  sqlite.pragma('wal_checkpoint(TRUNCATE)')
  sqlite.close()
})
