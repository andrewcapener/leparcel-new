import assert from 'node:assert/strict'
import {
  collectionsFor, multiBuySheet, shopifyProducts, skuFor, titleFor, type MakerLines,
} from './products'

/**
 * The register reads this. A wrong vendor is a sale nobody can attribute, and
 * that is only found out on the Sunday night when somebody is owed money and
 * there is no row with her name on it.
 */

const makers: MakerLines[] = [
  {
    code: 'MM28', shop: 'Spurs & Saddles Co', category: 'Jewelry',
    lines: [
      { label: 'Leather keyring', priceCents: 2400, breaks: [] },
      { label: '', priceCents: 1800, breaks: [] },
      { label: 'Tooled belt', priceCents: 14800, breaks: [{ qty: 2, cents: 28000 }] },
    ],
  },
  { code: 'mm4', shop: 'Happy Jellies', category: 'Treats', lines: [{ label: 'Jam', priceCents: 900, breaks: [] }] },
  { code: 'MM19', shop: 'Sweet Sisters Crafts', category: 'Other', lines: [] },
]

const products = shopifyProducts(makers)

/* One product per price line. A maker with nothing filed contributes none. */
assert.equal(products.length, 4)

/* The vendor is the ID ALONE. A Shopify smart collection rule is an exact
   match on this field, so "MM28 Spurs & Saddles" would belong to no
   collection and appear nowhere on the register. */
for (const p of products) {
  assert.match(p.vendor, /^MM\d+$/, `vendor is not a bare code: ${p.vendor}`)
  assert.ok(p.variants.length >= 1, 'a product with no way to buy it')
  for (const v of p.variants) {
    assert.equal(v.sku.split('-')[0], p.vendor, 'a variant SKU names a different maker')
    assert.ok(Number.isInteger(v.priceCents), 'a price that is not whole cents')
  }
  /* The single is always first and always there: a maker who sells three for
     $15 still sells one to somebody who only wants one. */
  assert.equal(p.variants[0]!.qty, '1')
}

/* SKUs unique across the whole push, variants included, or the upsert
   overwrites one price with another. */
const skus = products.flatMap((p) => p.variants.map((v) => v.sku))
assert.equal(new Set(skus).size, skus.length, 'two variants share a SKU')
assert.deepEqual(skus, ['MM28-1', 'MM28-2', 'MM28-3', 'MM28-3x2', 'MM4-1'])

/* A lowercase code still produces an uppercase vendor and SKU, because the
   numbers screen takes "mm8" as typed and a collection rule will not. */
assert.equal(products[3]!.vendor, 'MM4')
assert.equal(products[3]!.variants[0]!.sku, 'MM4-1')

/* The bundle. Its price is the price of the BUNDLE, not of one item in it:
   rung up once it takes $296, which is what the maker promised. */
const belt = products[2]!
assert.equal(belt.title, '(MM28) Tooled belt')
assert.deepEqual(belt.variants, [
  { sku: 'MM28-3', qty: '1', priceCents: 14800 },
  { sku: 'MM28-3x2', qty: '2', priceCents: 28000 },
])

/* An offer that is not an offer is left off. "2 for $296" against a $148
   single is two times the price with extra steps: a second button on a
   register that charges the same as the first, and one more chance to press
   the wrong one. The line parser already refuses a bundle that is not a
   discount, so this should never fire on real data; it is here because the
   cost of it firing wrongly is a maker's published offer vanishing. */
const noSaving = shopifyProducts([{ code: 'MM7', shop: 'x', category: 'Other',
  lines: [{ label: 'a', priceCents: 1000, breaks: [{ qty: 2, cents: 2000 }, { qty: 1, cents: 900 }] }] }])
assert.equal(noSaving[0]!.variants.length, 1, 'a bundle with no saving was kept')

/* Several bundles come out cheapest first, the order a person reads them. */
const many = shopifyProducts([{ code: 'MM9', shop: 'y', category: 'Other',
  lines: [{ label: 'b', priceCents: 1500, breaks: [{ qty: 3, cents: 4000 }, { qty: 2, cents: 2800 }] }] }])
assert.deepEqual(many[0]!.variants.map((v) => v.qty), ['1', '2', '3'])
assert.deepEqual(many[0]!.variants.map((v) => v.priceCents), [1500, 2800, 4000])

/* Titles carry the code first. A maker who sent a bare price gets the price
   as her title, which is what Drew asked for, and the code is what stops
   forty of them reading identically. */
assert.equal(products[0]!.title, '(MM28) Leather keyring')
assert.equal(products[1]!.title, '(MM28) $18')
assert.equal(titleFor('mm3', '   ', 500), '(MM3) $5')
assert.equal(titleFor('MM3', 'Potpourri', 500), '(MM3) Potpourri')
assert.equal(skuFor('mm10', 12), 'MM10-12')

/* The category rides along for the register's own filtering, and a maker with
   no category still gets a usable one rather than an empty string. */
assert.equal(products[0]!.productType, 'Jewelry')
assert.deepEqual(products[0]!.tags, ['MM28', 'Jewelry'])
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

/* The sheet survives as a reference for whoever is on the till, even though
   the offers are now rung up rather than worked out. */
const sheet = multiBuySheet(makers)
assert.equal(sheet.length, 1)
assert.equal(sheet[0]!.sku, 'MM28-3')
assert.equal(sheet[0]!.offer, '2 for $280')

console.log('shopify products: every bundle is a variant, and no two share a SKU')
