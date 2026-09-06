/**
 * Unit test for the Google Sheets row mapping.
 *
 * The mapping is the only part of the sync with judgment in it: ids become
 * labels, cents become dollars, a UTC stamp becomes Pacific, and two columns
 * that must never appear (seller's permit, signed name) must keep not
 * appearing. All of it is pure, so all of it is testable.
 *
 * Run with `npm test`. Dependency-free, in the style of money.test.ts.
 */
import { applicationRow, sheetValues, ptStamp, SHEET_COLUMNS, SHEET_HEADERS } from './row'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures++; console.error(`  ✗ ${name} ${detail}`) }
}

const catalog = {
  spaces: [
    { id: 'sp-3x6', label: "3' × 6' space" },
    { id: 'sp-out-sat', label: 'Outdoor Saturday' },
  ],
  addons: [
    { code: 'ENDCAP-IN', name: 'Corner or endcap, inside' },
    { code: 'SHARE', name: 'Share your space' },
  ],
}

const application = {
  id: 'app-1',
  track: 'indoor',
  category: 'Ceramics',
  description: 'Wheel-thrown stoneware, glazed in small batches.',
  priceLowCents: 1_800,
  priceHighCents: 18_500,
  madeByYou: 'all',
  usesAiArtwork: false,
  isMlm: false,
  requestedSpaceIds: JSON.stringify(['sp-3x6', 'sp-out-sat']),
  loadInSlots: '[]', wantsOnboardingCall: false, permitStatus: null, requestedAddons: JSON.stringify(['ENDCAP-IN', 'SHARE']),
  // Postgres hands timestamptz back in this shape: a space, not a T.
  submittedAt: '2026-09-05 01:38:42.097708+00',
}

const vendor = {
  shopName: 'Kiln & Coast',
  contactName: 'Maya Ruiz',
  email: 'maya@example.com',
  phone: '949-555-0148',
  instagram: '@kilnandcoast',
  website: 'https://kilnandcoast.example',
  city: 'Dana Point',
  state: 'CA',
}

const row = applicationRow({ application, vendor, catalog, siteUrl: 'https://mermademarket.com/' })

// 1 · ids and codes become labels a person can read, in the order checked.
//
// Joined on a middle dot. This assertion used to read
//   'Corner or endcap, inside, Share your space'
// which is the whole argument for the change: an add-on called "Corner or
// endcap, inside" has a comma inside its own name, so a comma-joined list of
// two reads as a list of three to anyone scanning the Sheet.
check('spaces are labels', row.spaces === "3' × 6' space · Outdoor Saturday", row.spaces)
check('add-ons are names',
  row.addons === 'Corner or endcap, inside · Share your space', row.addons)

// 2 · money comes out of src/lib/money.ts, formatted from integer cents
check('price low', row.priceLow === '$18', row.priceLow)
check('price high', row.priceHigh === '$185', row.priceHigh)

// 3 · the timestamp renders Pacific (CLAUDE.md rule 8). 01:38 UTC on Sep 5 is
//     18:38 on Sep 4 in Los Angeles, which is the day the team would look for.
check('submitted renders Pacific', row.submittedAt === '2026-09-04 18:38 PT', row.submittedAt)
check('a T-shaped stamp works too',
  ptStamp('2026-09-05T01:38:42.097Z') === '2026-09-04 18:38 PT',
  ptStamp('2026-09-05T01:38:42.097Z'))
check('PST, not just PDT', ptStamp('2026-12-01T02:00:00Z') === '2026-11-30 18:00 PT',
  ptStamp('2026-12-01T02:00:00Z'))

// 4 · flags read as words, not booleans
check('made by them', row.madeByYou === 'Makes everything', row.madeByYou)
check('ai artwork', row.usesAiArtwork === 'No', row.usesAiArtwork)
check('mlm', row.isMlm === 'No', row.isMlm)
check('track', row.track === 'Indoor', row.track)
{
  const flagged = applicationRow({
    application: { ...application, usesAiArtwork: true, isMlm: true, track: 'both', madeByYou: 'curate_resell' },
    vendor, catalog, siteUrl: 'https://mermademarket.com',
  })
  check('ai artwork yes', flagged.usesAiArtwork === 'Yes', flagged.usesAiArtwork)
  check('mlm yes', flagged.isMlm === 'Yes', flagged.isMlm)
  check('both tracks', flagged.track === 'Indoor and outdoor', flagged.track)
  check('resells', flagged.madeByYou === 'Curates and resells', flagged.madeByYou)
}

// 5 · the admin link is absolute and has exactly one slash after the origin
check('admin link', row.adminLink === 'https://mermademarket.com/admin/applications/app-1',
  row.adminLink)

// 6 · a missing website is empty, never the string "null"
{
  const noSite = applicationRow({
    application, vendor: { ...vendor, website: null }, catalog, siteUrl: 'https://x.test',
  })
  check('null website is blank', noSite.website === '', JSON.stringify(noSite.website))
}

// 7 · a space or add-on the catalog no longer offers still shows, as its raw
//     value. Losing a maker's request silently is worse than an ugly cell.
{
  const stale = applicationRow({
    application: {
      ...application,
      requestedSpaceIds: JSON.stringify(['sp-3x6', 'sp-retired']),
      loadInSlots: '[]', wantsOnboardingCall: false, permitStatus: null, requestedAddons: JSON.stringify(['GONE']),
    },
    vendor, catalog, siteUrl: 'https://x.test',
  })
  check('unknown space kept', stale.spaces === "3' × 6' space · sp-retired", stale.spaces)
  check('unknown add-on kept', stale.addons === 'GONE', stale.addons)
}

// 8 · malformed JSON in a text column must not lose the row
{
  const broken = applicationRow({
    application: { ...application, requestedSpaceIds: 'not json', requestedAddons: '{}' },
    vendor, catalog, siteUrl: 'https://x.test',
  })
  check('bad json is empty, not a throw', broken.spaces === '' && broken.addons === '',
    `${broken.spaces}|${broken.addons}`)
  check('the rest of the row survives', broken.shopName === 'Kiln & Coast')
}

// 9 · the row is exactly the columns, in order, and nothing else
{
  const values = sheetValues(row)
  check('values match headers', values.length === SHEET_HEADERS.length,
    `${values.length} vs ${SHEET_HEADERS.length}`)
  check('every cell is a string', values.every((v) => typeof v === 'string'))
  check('first column is the timestamp', SHEET_HEADERS[0] === 'Submitted (PT)')
  check('last column is the dedupe key',
    SHEET_HEADERS[SHEET_HEADERS.length - 1] === 'Application ID'
    && values[values.length - 1] === 'app-1')
  check('no duplicate headers', new Set(SHEET_HEADERS).size === SHEET_HEADERS.length)
}

// 10 · PII the sheet does not need never reaches it (CLAUDE.md rule 9)
{
  const keys = SHEET_COLUMNS.map((c) => c.key) as string[]
  for (const forbidden of ['sellerPermit', 'signedName', 'juryNotes', 'photos', 'occasionalSeller']) {
    check(`${forbidden} is not a column`, !keys.includes(forbidden))
  }
  const blob = JSON.stringify(
    applicationRow({
      application: { ...application },
      vendor, catalog, siteUrl: 'https://x.test',
    }),
  )
  check('no permit number leaks through', !blob.includes('signedName'))
}

if (failures) { console.error(`\n${failures} failing assertions`); process.exit(1) }
/* Set-up times. Indoor makers are asked which staggered load-in slots they can
   make, and staff build the arrival schedule from the answers, so the column
   has to carry them in the order they were checked. */
{
  const slotted = applicationRow({
    application: { ...application, loadInSlots: JSON.stringify(['1-3pm', '5-7pm']) },
    vendor, catalog, siteUrl: 'https://mermademarket.com',
  })
  check('set-up times', slotted.loadInSlots === '1-3pm, 5-7pm', slotted.loadInSlots)
  check('set-up times is a column', SHEET_HEADERS.includes('Set-up times'))
  check('application id stays last, which the Apps Script keys on',
    SHEET_HEADERS[SHEET_HEADERS.length - 1] === 'Application ID')
}

const empty = applicationRow({
  application: { ...application, loadInSlots: '[]' },
  vendor, catalog, siteUrl: 'https://mermademarket.com',
})
check('no set-up times is empty, not "[]"', empty.loadInSlots === '', empty.loadInSlots)

/* The pre-show Zoom call. Staff build the call list from this column, so a no
   has to be a visible "No" rather than a blank they have to interpret. */
{
  const wants = applicationRow({
    application: { ...application, wantsOnboardingCall: true },
    vendor, catalog, siteUrl: 'https://mermademarket.com',
  })
  check('wants the call', wants.onboardingCall === 'Yes', wants.onboardingCall)
  check('does not want it', empty.onboardingCall === 'No', empty.onboardingCall)
  check('it is a column', SHEET_HEADERS.includes('Wants Zoom call'))
}

console.log('sheets: row mapping holds (labels, cents, Pacific, flags, PII)')
