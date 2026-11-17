import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { usd } from '@/lib/money'
import { fmtRange } from '@/lib/dates'
import { bestSeller, lineLabel, showStatements } from '@/server/modules/statements/show-statements'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * One maker's statement, as she will get it, plus the letter it goes with.
 *
 * The page prints. Everything that is not the statement itself drops out on
 * paper, so the thing that reaches her is the thing on the screen and nobody
 * has to maintain a second copy of it in a template somewhere.
 *
 * The email draft sits underneath, in a box, so Elise reads the figures and
 * the words she is about to send in the same glance. Still nothing sends.
 */

const css = `
.sv { max-width: 7.5in; margin: 0 auto; background: #fff; color: var(--ad-ink) }
.sv .sv-bar {
  display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap;
  border-bottom: 1px solid var(--ad-line); padding-bottom: 11px; margin-bottom: 26px;
  font-size: var(--t-s); color: var(--ad-ink-3);
}
.sv .sv-bar a { text-decoration: underline; text-underline-offset: 2px }
.sv h1, .sv h2, .sv .cap {
  font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; margin: 0;
}
.sv .cap { font-size: 8.5pt; color: var(--ad-ink-3); letter-spacing: .11em }
.sv .mark { line-height: 0; margin-bottom: 14px }
.sv .mark img { height: 30px; width: auto; display: block }
.sv h1 { font-size: 17pt; letter-spacing: .04em; margin-top: 3px }
.sv .sub1 { margin-top: 5px; font-size: 9.5pt; color: var(--ad-ink-3) }
.sv hr.hard { border: 0; border-top: 1.5px solid var(--ad-ink); margin: 13px 0 }
.sv .who { display: flex; align-items: baseline; gap: 11px; flex-wrap: wrap; margin-bottom: 3px }
.sv .id { font-family: var(--font-m); font-size: 12pt; font-weight: 500;
  border: 1.25px solid var(--ad-ink); padding: 1px 8px }
.sv h2 { font-size: 14pt; letter-spacing: .03em }
.sv .meta { font-size: 9pt; color: var(--ad-ink-3); margin: 3px 0 0 }

.sv .sum { margin: 16px 0 0; border: 1.5px solid var(--ad-ink); padding: 11px 15px 3px }
.sv .sum table { width: 100%; border-collapse: collapse; font-size: 10.5pt }
.sv .sum td { padding: 4px 0 }
.sv .sum td.m { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
.sv .sum tr.rule td { border-top: 1px solid var(--ad-line); padding-top: 8px }
.sv .sum tr.pay td { border-top: 1.5px solid var(--ad-ink); padding-top: 10px; padding-bottom: 10px;
  font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .05em; font-size: 13pt }
.sv .sum .soft { color: var(--ad-ink-3) }

.sv table.items { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 8px }
.sv table.items th { text-align: left; font-family: var(--font-c); font-weight: 600;
  text-transform: uppercase; font-size: 8pt; letter-spacing: .09em; color: var(--ad-ink-3);
  border-bottom: 1.25px solid var(--ad-ink); padding: 0 9px 5px 0 }
.sv table.items td { padding: 3px 9px 3px 0; border-bottom: 1px solid var(--ad-line);
  vertical-align: top }
.sv table.items td.m, .sv table.items th.m { text-align: right; padding-right: 0;
  font-variant-numeric: tabular-nums; white-space: nowrap }
.sv .sku { font-family: var(--font-m); color: var(--ad-ink-3); white-space: nowrap }
.sv .lessd { display: block; font-size: 8pt; color: var(--ad-ink-3) }
.sv .note { font-size: 8.5pt; line-height: 1.5; color: var(--ad-ink-3);
  border-left: 2px solid var(--ad-line); padding-left: 11px; margin: 16px 0 0 }
.sv h3.sec { font-family: var(--font-c); font-weight: 600; font-size: 8.5pt;
  letter-spacing: .11em; text-transform: uppercase; color: var(--ad-ink-3); margin: 18px 0 0 }

.sv .mail { margin: 34px 0 0; border: 1px solid var(--ad-line); border-radius: 10px;
  background: var(--ad-sunk); padding: 16px 18px }
.sv .mail .cap { display: block; margin-bottom: 9px }
.sv .mail pre { margin: 0; white-space: pre-wrap; font-family: var(--font-j);
  font-size: var(--t-s); line-height: 1.6; color: var(--ad-ink) }
.sv .mail .to { font-size: var(--t-cap); color: var(--ad-ink-3); margin: 0 0 10px;
  font-family: var(--font-m) }

@media print {
  @page { size: letter; margin: .55in }
  .sv { max-width: none }
  .sv .sv-bar, .sv .mail { display: none }
}
`

export default async function OneStatement({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const set = await showStatements(db, show.id)
  if (!set.ok) throw new Error(set.detail)

  const m = set.makers.find((x) => x.code.toUpperCase() === code.toUpperCase())
  if (!m) notFound()

  const t = m.totals
  const top = bestSeller(m.lines)
  const first = (m.contact || '').trim().split(/\s+/)[0] || 'there'

  const money = (c: number) => usd(c)

  const email = [
    `Hi ${first},`,
    '',
    `Thank you for bringing your work to ${show.name}. Here is how your table did.`,
    '',
    `${t.itemsSold} items sold across ${m.orders} sales.`,
    '',
    `Gross sales ${money(t.grossCents)}`,
    ...(t.discountsCents ? [`Discounts at the register ${money(-t.discountsCents)}`] : []),
    ...(t.refundsCents ? [`Refunds ${money(-t.refundsCents)}`] : []),
    `Mermade commission ${money(-t.commissionCents)}`,
    `Due to you ${money(t.payoutCents)}`,
    '',
    ...(top
      ? [`Your ${usd(top.unitCents)} ${lineLabel(top).toLowerCase()} was the one that moved, `
        + `${top.qty} of them over the three days.`, '']
      : []),
    'The attached statement lists every item that sold. Payment follows once all',
    'statements have been checked and we will write again with the date.',
    '',
    'If a line looks wrong, reply here and we will look it up.',
    '',
    'Mermade Market',
  ].join('\n')

  return (
    <div className="sv">
      <div className="sv-bar">
        <Link href="/admin/statements">All statements</Link>
        <span>Print this page for the PDF. Cmd+P.</span>
        <span>Nothing has been sent.</span>
      </div>

      <div className="mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mermade-wordmark.svg" alt="Mermade Market" />
      </div>
      <span className="cap">Statement of sales</span>
      <h1>{show.name}</h1>
      <p className="sub1">
        {show.venueName} {'·'} {fmtRange(show.startsOn, show.endsOn)}
      </p>
      <hr className="hard" />

      <div className="who">
        <span className="id">{m.code}</span>
        <h2>{m.shop}</h2>
      </div>
      <p className="meta">{t.itemsSold} items sold across {m.orders} sales</p>

      <div className="sum">
        <table>
          <tbody>
            <tr>
              <td>Gross sales</td>
              <td className="m">{money(t.grossCents)}</td>
            </tr>
            {t.discountsCents ? (
              <tr>
                <td>Discounts at the register</td>
                <td className="m">{money(-t.discountsCents)}</td>
              </tr>
            ) : null}
            {t.refundsCents ? (
              <tr>
                <td>Refunds</td>
                <td className="m">{money(-t.refundsCents)}</td>
              </tr>
            ) : null}
            {t.discountsCents || t.refundsCents ? (
              <tr className="rule">
                <td>Net sales</td>
                <td className="m">{money(t.netSalesCents)}</td>
              </tr>
            ) : null}
            <tr className="rule">
              <td>
                Mermade commission <span className="soft">{t.commissionBps / 100}%</span>
              </td>
              <td className="m">{money(-t.commissionCents)}</td>
            </tr>
            <tr className="pay">
              <td>Due to you</td>
              <td className="m">{money(t.payoutCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="sec">Every item sold</h3>
      <table className="items">
        <thead>
          <tr>
            <th className="sku">Code</th>
            <th>Item</th>
            <th className="m">Price</th>
            <th className="m">Sold</th>
            <th className="m">Total</th>
          </tr>
        </thead>
        <tbody>
          {m.lines.map((l) => (
            <tr key={l.sku}>
              <td className="sku">{l.sku}</td>
              <td>
                {lineLabel(l)}
                {l.discountsCents ? (
                  <span className="lessd">less {usd(l.discountsCents)} discount</span>
                ) : null}
              </td>
              <td className="m">{usd(l.unitCents)}</td>
              <td className="m">{l.qty}</td>
              <td className="m">{usd(l.grossCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note">
        Figures are taken from the register and cover every sale rung at the
        show. Commission is calculated on net sales, so anything discounted at
        the till or refunded is taken off before our share, never after.
        <br />
        Payment follows once all statements have been checked. Any question
        about a line on this statement, reply to the email this came with and
        we will look it up.
      </p>

      <div className="mail">
        <span className="cap">The email that goes with it</span>
        <p className="to">To: {m.email || 'NO ADDRESS ON FILE'}</p>
        <p className="to">Subject: Your {show.name} sales</p>
        <pre>{email}</pre>
      </div>

      <style>{css}</style>
    </div>
  )
}
