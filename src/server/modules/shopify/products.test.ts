import assert from 'node:assert/strict'
import {
  collectionsFor, multiBuySheet, shopifyProducts, skuFor, titleFor, type MakerLines,
} from './products'

/**
 * The register reads this. A wrong vendor is a sale nobody can attribute, and
 * that is only discovered on the Sunday night when somebody is owed money and
 * there is no row with her name on it.
 */

const makers: MakerLines[] = [
  {
    code: 'MM28', shop: 'Spurs & Saddles Co', category: 'Jewelry',
    lines: [
      { label: 'Leather keyring', priceCents: 2400, breaks: [] },
      { label: '', priceCents: 1800, breaks: [] },
      { label: 'Tooled belt', priceCents: 14800, breaks: [{ qty: 2, cents: 29600 }] },
    ],
  },
  { code: 'mm4', shop: 'Happy Jellies', category: 'Treats', lines: [{ label: 'Jam', priceCents: 900, breaks: [] }] },
  { code: 'MM19', shop: 'Sweet Sisters Crafts', category: 'Other', lines: [] },
]

const rows = shopifyProducts(makers)

/* One row per price line, and a maker with nothing filed contributes none. */
assert.equal(rows.length, 4)

/* The vendor is the ID ALONE. A Shopify smart collection rule is an exact
   match on this field, so "MM28 Spurs & Saddles" would belong to no
   collection and show up nowhere on the register. */
for (const r of rows) {
  assert.match(r.vendor, /^MM\d+$/, `vendor is not a bare code: ${r.vendor}`)
  assert.equal(r.vendor, r.vendor.toUpperCase())
  assert.equal(r.vendor, r.sku.split('-')[0], 'vendor and sku disagree about the maker')
}

/* SKUs are unique across the whole push, or the upsert overwrites one maker's
   price with another's. */
const skus = rows.map((r) => r.sku)
assert.equal(new Set(skus).size, skus.length, 'two lines share a SKU')
assert.deepEqual(skus, ['MM28-1', 'MM28-2', 'MM28-3', 'MM4-1'])

/* A lowercase code still produces an uppercase vendor and SKU, because the
   codes screen accepts "mm8" as typed and the collection rule will not. */
assert.equal(rows[3]!.vendor, 'MM4')
assert.equal(rows[3]!.sku, 'MM4-1')

/* Titles carry the code first. A maker who sent a bare price gets the price
   as her title, which is what Drew asked for, and the code is what stops
   forty of them reading identically. */
assert.equal(rows[0]!.title, '(MM28) Leather keyring')
assert.equal(rows[1]!.title, '(MM28) $18')
assert.equal(titleFor('mm3', '   ', 500), '(MM3) $5')
assert.equal(titleFor('MM3', 'Potpourri', 500), '(MM3) Potpourri')
assert.equal(skuFor('mm10', 12), 'MM10-12')

/* Prices stay in cents the whole way. A float here is a wrong receipt. */
for (const r of rows) assert.ok(Number.isInteger(r.priceCents))
assert.equal(rows[2]!.priceCents, 14800)

/* The category rides along for the register's own filtering, and a maker with
   no category still gets a usable one rather than an empty string. */
assert.equal(rows[0]!.productType, 'Jewelry')
assert.deepEqual(rows[0]!.tags, ['MM28', 'Jewelry'])
assert.equal(
  shopifyProducts([{ code: 'MM5', shop: 'x', category: '', lines: [{ label: 'a', priceCents: 1, breaks: [] }] }])[0]!.productType,
  'Other',
)

/* Collections only for makers with something to sell. An empty collection on
   a register is a wrong tap waiting to happen. */
assert.deepEqual(collectionsFor(makers), [
  { code: 'MM28', shop: 'Spurs & Saddles Co' },
  { code: 'MM4', shop: 'Happy Jellies' },
])

/* Multi-buys cannot go into a plain catalogue, so they come out as a sheet
   rather than being dropped. Dropping them silently would have the register
   charging a customer twice what the maker promised. */
const sheet = multiBuySheet(makers)
assert.equal(sheet.length, 1)
assert.deepEqual(sheet[0], {
  code: 'MM28', shop: 'Spurs & Saddles Co', sku: 'MM28-3',
  item: 'Tooled belt', offer: '2 for $296',
})
/* And a bare-price line with a bundle names itself by its price. */
assert.equal(
  multiBuySheet([{ code: 'MM9', shop: 'y', category: 'Other',
    lines: [{ label: '', priceCents: 1500, breaks: [{ qty: 3, cents: 4000 }, { qty: 2, cents: 2800 }] }] }])[0]!.offer,
  '2 for $28 · 3 for $40',
)

console.log('shopify products: the maker is on every row, and no two lines share a SKU')
