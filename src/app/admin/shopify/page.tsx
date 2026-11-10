import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { collectionsFor, makerLines, multiBuySheet, shopifyProducts } from '@/server/modules/shopify/products'
import { PageHead } from '../ui'
import { ArchiveForm, CollectionsForm, ProductsForm } from './PushForms'

export const dynamic = 'force-dynamic'
/* Several hundred products, one HTTP call each on the apply. Comfortably
   inside a minute against Shopify, and well outside the platform default. */
export const maxDuration = 300

/**
 * The register, loaded from here.
 *
 * The show runs on Shopify POS and a hundred makers sell through one counter.
 * Everything that makes the payout possible is decided at the moment a product
 * is created, so it is decided here rather than in a spreadsheet somebody
 * imports: the Mermade ID on every product, one collection per maker, and last
 * season out of the way first.
 *
 * What this page cannot do is multi-buys. "Buy 2 for $296" is a rule about a
 * basket and a plain catalogue has nowhere to put it, so those come out as a
 * list to print and keep by the till rather than being dropped silently, which
 * would have the register charging a customer twice what her maker promised.
 */
export default async function ShopifyPage() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const makers = await makerLines(db, show.id)
  const products = shopifyProducts(makers)
  const collections = collectionsFor(makers)
  const bundles = multiBuySheet(makers)
  const filed = makers.filter((m) => m.lines.length > 0).length
  const wired = Boolean(process.env.SHOPIFY_EXECUTE_KEY?.trim())

  /* Anything made before this show's own first day belongs to a show that is
     over. Offered as the default rather than imposed, since a season that ran
     late is a judgement nobody should have to edit code to make. */
  const cutoff = show.startsOn.slice(0, 10)

  return (
    <div className="adm-narrow">
      <PageHead
        title="The register"
        sub={`${products.length} prices from ${filed} of ${makers.length} indoor makers`}
      />

      {!wired && (
        <p className="adm-note adm-note--bad">
          SHOPIFY_EXECUTE_KEY is not set on this app, so the buttons below cannot
          reach Shopify. The counts are still right and the plan is still worth
          reading.
        </p>
      )}

      <ArchiveForm defaultDate={cutoff} />
      <CollectionsForm />
      <ProductsForm />

      <div>
        <div className="adm-sec"><h2>Multi-buys, for the till</h2></div>
        {bundles.length === 0 ? (
          <p className="adm-sub2">Nobody has filed one.</p>
        ) : (
          <>
            <p className="adm-sub2">
              Shopify has nowhere to put these, so they are not in the push.
              Print this and keep it by the register, or build an automatic
              discount in Shopify for each one.
            </p>
            <table className="adm-tbl">
              <thead>
                <tr><th>SKU</th><th>Maker</th><th>Item</th><th>Offer</th></tr>
              </thead>
              <tbody>
                {bundles.map((b) => (
                  <tr key={b.sku}>
                    <td><span className="adm-code">{b.sku}</span></td>
                    <td>{b.shop}</td>
                    <td>{b.item}</td>
                    <td>{b.offer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <p className="adm-note">
        <strong>Order matters.</strong> Archive last season first, so nothing
        from it is on the register while this season goes on. Then the
        collections, which are rules and so are ready for products that do not
        exist yet. Then the prices, which fall into the right collection the
        moment they land.
      </p>
      <p className="adm-note">
        <strong>Everything here can be run again.</strong> The push matches on
        SKU and the collections on their rule, so a maker who files on Thursday
        night is added by pressing the same button, and nothing is duplicated.
      </p>
    </div>
  )
}
