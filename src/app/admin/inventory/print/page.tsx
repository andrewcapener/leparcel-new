import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { fmtDate, fmtRange } from '@/lib/dates'
import { inventoryExport } from '@/server/modules/roster/inventory-export'
import {
  blankRows, printMakers, sheetSummary, type PrintMaker,
} from '@/server/modules/roster/inventory-print'

export const dynamic = 'force-dynamic'
/* Every indoor maker's whole list, two queries plus the payout columns. Well
   inside a minute, but not inside the platform's default. */
export const maxDuration = 60

/**
 * The inventory, as paper.
 *
 * Elise sits down with one maker at a time and reads her list back to her, so
 * this is a page per maker with the Mermade number large enough to find in a
 * stack, the maker's own words for her own goods, and a signature block at
 * the foot. The cover page is the index she works down and the chase list of
 * whoever has filed nothing.
 *
 * Rendered bare, with no admin sidebar, because it exists to go through a
 * printer. Still behind the staff gate, which is in the proxy on /admin.
 *
 * Indoor only, and that is a statement about the business rather than a
 * filter: an outdoor maker takes her own money at her own tent, so Mermade
 * never holds her prices and has nothing to read back to her.
 */

/* One stylesheet, scoped to this page, with its own prefix. The admin's
   tokens come from the .adm class on the wrapper; everything here is sized in
   points and inches because the output is a sheet of paper, not a screen. */
const css = `
.inv { --inv-ink: var(--ad-ink); --inv-soft: var(--ad-ink-3); background: #fff; color: var(--inv-ink) }
.inv .inv-page { max-width: 7.4in; margin: 0 auto; padding: 0.5in 0 0.75in }
.inv h1, .inv h2, .inv h3, .inv .inv-cap {
  font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; margin: 0;
}
.inv .inv-cap { font-size: 8.5pt; color: var(--inv-soft); letter-spacing: .1em }

/* ── cover ── */
.inv .inv-mark { height: 28px; width: auto; display: block; margin-bottom: 18px }
.inv h1 { font-size: 18pt; line-height: 1.1; letter-spacing: .04em }
.inv .inv-sub { margin-top: 6px; font-size: 10pt; color: var(--inv-soft) }
.inv .inv-rule { border: 0; border-top: 1.5px solid var(--inv-ink); margin: 15px 0 }
.inv .inv-hair { border: 0; border-top: 1px solid var(--ad-line); margin: 0 }
.inv .inv-tally { display: flex; flex-wrap: wrap; gap: 0 30px; margin: 14px 0 18px }
.inv .inv-tally div { min-width: 80px }
.inv .inv-tally b { display: block; font-size: 16pt; font-family: var(--font-c); font-weight: 600 }
.inv .inv-tally span { font-size: 8pt; text-transform: uppercase; letter-spacing: .09em; color: var(--inv-soft) }
.inv .inv-note {
  font-size: 8.75pt; line-height: 1.5; color: var(--inv-soft);
  border-left: 2px solid var(--ad-line); padding-left: 11px; margin: 0 0 18px;
}

/* ── tables ── */
.inv table { width: 100%; border-collapse: collapse; font-size: 9.25pt }
.inv th { text-align: left; font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  font-size: 8pt; letter-spacing: .09em; color: var(--inv-soft);
  border-bottom: 1.25px solid var(--inv-ink); padding: 0 8px 5px 0 }
.inv td { padding: 3px 8px 3px 0; border-bottom: 1px solid var(--ad-line); vertical-align: top }
.inv .inv-n { width: 26px; color: var(--inv-soft); font-variant-numeric: tabular-nums }
.inv .inv-money { text-align: right; width: 56px; font-variant-numeric: tabular-nums;
  white-space: nowrap; padding-right: 0 }
/* The index's price range. Wide enough for "Nothing filed", which is the
   longest thing it ever says and the one row that has to be readable. */
.inv .inv-range { text-align: right; width: 128px; white-space: nowrap;
  font-variant-numeric: tabular-nums; padding: 3px 0 3px 18px }
.inv th.inv-range { padding: 0 0 5px 18px }
.inv .inv-code { font-family: var(--font-m); white-space: nowrap; width: 62px }
.inv .inv-tick { width: 34px; border-left: 1px solid var(--ad-line); padding-left: 10px }
.inv th.inv-tick { padding: 0 8px 5px 10px }
.inv tr { page-break-inside: avoid }

/* ── a maker's block ── */
/* Not a page each. Most makers list a handful of things, and a page each was
   thirty-odd sheets that are seven eighths white. They pack instead, and the
   rule is only that a maker is never split: page-break-inside keeps her block
   whole and pushes it to the next sheet if it will not fit on this one. A
   maker whose list is longer than a page cannot be kept whole, so she spills,
   and the repeating header below is what makes that safe. */
.inv .inv-maker { page-break-inside: avoid; margin-top: 26px }
/* A list longer than a sheet cannot be kept whole, and holding it back anyway
   leaves the sheet before it half empty. So the long ones are allowed to flow
   and fill that gap. They are only ever broken where they have to be, and the
   repeating header means the continuation still says whose it is. */
.inv .inv-long { page-break-inside: auto }
.inv .inv-long .inv-hd, .inv .inv-long .inv-meta { page-break-after: avoid }
.inv .inv-maker .inv-hd { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap }
.inv .inv-maker h2 { font-size: 12.5pt; letter-spacing: .03em }
.inv .inv-maker .inv-id {
  font-family: var(--font-m); font-size: 11pt; font-weight: 500;
  border: 1.25px solid var(--inv-ink); padding: 1px 7px; letter-spacing: 0;
}
.inv .inv-meta { margin: 4px 0 8px; font-size: 8.5pt; color: var(--inv-soft) }
.inv .inv-meta b { color: var(--inv-ink); font-weight: 500 }
/* Repeats at the top of a spilled page, so a loose sheet still says whose it
   is. A maker with sixty lines is the reason this is a thead and not a div. */
.inv thead .inv-runner td {
  border: 0; padding: 0 0 7px; font-size: 8pt; letter-spacing: .09em;
  text-transform: uppercase; font-family: var(--font-c); color: var(--inv-soft);
}
.inv .inv-none {
  border: 1.25px solid var(--inv-ink); padding: 9px 11px; margin: 2px 0 0;
  font-size: 9.25pt; line-height: 1.45;
}
/* The empty rows. Taller than a printed line because somebody is writing in
   them by hand, and greyed numbers so the filled part of the list still reads
   as the filled part at a glance. */
.inv .inv-blank td { height: 20px }
.inv .inv-blank .inv-n { color: var(--ad-line-2) }

/* ── on paper ── */
@media print {
  @page { size: letter; margin: 0.55in }
  .inv { background: #fff }
  .inv .inv-page { max-width: none; margin: 0; padding: 0 }
  .inv .inv-screen { display: none }
  .inv thead { display: table-header-group }
}
@media screen {
  .inv { padding: 20px 16px 60px }
  .inv .inv-maker { border-top: 1px solid var(--ad-line); padding-top: 20px }
  .inv .inv-screen {
    position: sticky; top: 0; z-index: 2; background: #fff;
    border-bottom: 1px solid var(--ad-line); margin: -20px -16px 22px;
    padding: 11px 16px; font-size: 9.5pt; color: var(--inv-soft);
    display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap;
  }
}
`

/* Roughly what fits on one sheet once the maker's heading and signature strip
   have taken their share. Past this she is going to span pages whatever we do,
   so she may as well start on the page we are already on. */
const FITS_A_SHEET = 30

function Maker({ m }: { m: PrintMaker }) {
  return (
    <section className={m.lines.length > FITS_A_SHEET ? 'inv-maker inv-long' : 'inv-maker'}>
      <div className="inv-hd">
        <span className="inv-id">{m.code}</span>
        <h2>{m.shop}</h2>
      </div>
      <p className="inv-meta">
        <b>{m.contact}</b>
        {' · '}
        {m.lines.length === 1 ? '1 item' : `${m.lines.length} items`}
        {m.lines.length > 0 && m.cheapest ? ` · ${m.cheapest} to ${m.dearest}` : ''}
        {' · '}
        {m.filed === 'Filed' ? 'Submitted' : m.filed === 'Started' ? 'Not yet submitted' : 'Nothing submitted'}
      </p>

      {m.lines.length === 0 && (
        <p className="inv-none">
          Nothing has come through for this maker yet. Her goods cannot be
          priced or sold at the register until she sends a list, so take it
          down here and we will enter it.
        </p>
      )}

      <table>
          <thead>
            <tr className="inv-runner">
              <td colSpan={5}>
                {m.code} {'·'} {m.shop}
              </td>
            </tr>
            <tr>
              <th className="inv-n" />
              <th>Item, as the maker listed it</th>
              <th>Multi-buy</th>
              <th>Note for the register</th>
              <th className="inv-money">Price</th>
            </tr>
          </thead>
          <tbody>
            {m.lines.map((l) => (
              <tr key={l.n}>
                <td className="inv-n">{l.n}</td>
                <td>{l.item}</td>
                <td>{l.multiBuys}</td>
                <td>{l.note}</td>
                <td className="inv-money">{l.price}</td>
              </tr>
            ))}
            {/* Room for whatever she names while Elise is sitting with her,
                numbered on from her last line so it comes back as more of the
                same list rather than as a note somebody has to interpret. */}
            {Array.from({ length: blankRows(m.lines.length) }, (_, i) => (
              <tr className="inv-blank" key={`blank-${i}`}>
                <td className="inv-n">{m.lines.length + i + 1}</td>
                <td />
                <td />
                <td />
                <td className="inv-money" />
              </tr>
            ))}
          </tbody>
        </table>
    </section>
  )
}

export default async function InventoryPrint() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const { items, makers } = await inventoryExport(db, show.id)
  const blocks = printMakers(items, makers)
  const sum = sheetSummary(blocks)
  const today = fmtDate(new Date().toISOString())

  return (
    <div className="adm inv">
      <div className="inv-page">
        {/* Screen only: how to get this onto paper, since the browser's own
            print command is the only thing that can do it. */}
        <div className="inv-screen">
          <b>Print this page</b>
          <span>Cmd+P, or Ctrl+P. One maker per sheet.</span>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="inv-mark" src="/mermade-wordmark.svg" alt="Mermade Market" />

        <span className="inv-cap">Inventory for review</span>
        <h1>
          {show.name}
          <br />
          Consignment price list
        </h1>
        <p className="inv-sub">
          {show.venueName} {'·'} {fmtRange(show.startsOn, show.endsOn)}
        </p>
        <hr className="inv-rule" />

        <div className="inv-tally">
          <div>
            <b>{sum.makers}</b>
            <span>Makers</span>
          </div>
          <div>
            <b>{sum.lines}</b>
            <span>Items</span>
          </div>
          <div>
            <b>{sum.variants}</b>
            <span>Ways to buy</span>
          </div>
          <div>
            <b>{sum.missing}</b>
            <span>Still to file</span>
          </div>
        </div>

        <p className="inv-note">
          Every indoor maker holding a space at this show, with the items she
          listed, in her own words and her own order. Outdoor makers are not
          here: they take their own payments at their own tents, so Mermade
          never holds their prices.
          <br />
          These are the prices the register will charge. A correction marked on
          a maker page has to be entered before load-in to take effect.
          <br />
          Prepared {today}.
        </p>

        <span className="inv-cap">Index</span>
        <hr className="inv-hair" />
        <table>
          <thead>
            <tr>
              <th className="inv-code">ID</th>
              <th>Shop</th>
              <th>Maker</th>
              <th className="inv-money">Items</th>
              <th className="inv-range">Range</th>
              <th className="inv-tick">OK</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((m) => (
              <tr key={m.code}>
                <td className="inv-code">{m.code}</td>
                <td>{m.shop}</td>
                <td>{m.contact}</td>
                <td className="inv-money">{m.lines.length}</td>
                <td className="inv-range">
                  {m.lines.length === 0
                    ? 'Nothing filed'
                    : m.cheapest === m.dearest
                      ? m.cheapest
                      : `${m.cheapest} to ${m.dearest}`}
                </td>
                <td className="inv-tick" />
              </tr>
            ))}
          </tbody>
        </table>

        {blocks.map((m) => <Maker key={m.code} m={m} />)}
      </div>
      <style>{css}</style>
    </div>
  )
}
