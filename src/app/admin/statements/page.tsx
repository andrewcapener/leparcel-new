import Link from 'next/link'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { usd } from '@/lib/money'
import { byCode } from '@/server/modules/roster/inventory-print'
import { showStatements } from '@/server/modules/statements/show-statements'
import { PageHead } from '../ui'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Every maker's statement, before anybody sees one.
 *
 * Drew: "I definitely do not want any of these to go out until they've been
 * reviewed." So this screen sends nothing and pays nobody. It is a reading
 * room: the whole show on one page, every maker's figures beside every
 * other's, so the one that is wrong stands out before it is in somebody's
 * inbox.
 *
 * Booth fees and add-ons are deliberately absent. Those are settled their own
 * way and a statement that mixed them with sales would need a person to
 * explain it every time. Drew, asked: "simply their sales."
 */

const css = `
.st { max-width: 1060px }
.st .st-bad { color: var(--ad-warn); font-size: var(--t-s) }
.st table { width: 100%; border-collapse: collapse; font-size: var(--t-s); margin-top: 18px }
.st th { text-align: left; font-family: var(--font-c); font-weight: 600;
  text-transform: uppercase; font-size: var(--t-cap-s); letter-spacing: .09em;
  color: var(--ad-ink-3); border-bottom: 1px solid var(--ad-line-2); padding: 0 10px 6px 0 }
.st td { padding: 7px 10px 7px 0; border-bottom: 1px solid var(--ad-line); vertical-align: baseline }
.st td.m, .st th.m { text-align: right; padding-right: 0;
  font-variant-numeric: tabular-nums; white-space: nowrap }
.st .code { font-family: var(--font-m); white-space: nowrap }
.st a.code { text-decoration: underline; text-underline-offset: 2px }
.st .soft { color: var(--ad-ink-3) }
.st tr.tot td { border-top: 1.5px solid var(--ad-ink); border-bottom: 0;
  padding-top: 10px; font-weight: 500 }
.st .warn { color: var(--ad-warn) }
.st .note { font-size: var(--t-s); color: var(--ad-ink-3); line-height: 1.55;
  border-left: 2px solid var(--ad-line); padding-left: 12px; margin: 22px 0 0; max-width: 62ch }
`

export default async function Statements() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const set = await showStatements(db, show.id)
  if (!set.ok) {
    return (
      <div className="st">
        <PageHead title="Statements" sub="What each maker is owed." />
        <p className="st-bad">The register could not be read: {set.detail}</p>
        <style>{css}</style>
      </div>
    )
  }

  const makers = [...set.makers].sort((a, b) => byCode(a.code, b.code))
  const sum = makers.reduce(
    (n, m) => ({
      gross: n.gross + m.totals.grossCents,
      disc: n.disc + m.totals.discountsCents,
      ref: n.ref + m.totals.refundsCents,
      comm: n.comm + m.totals.commissionCents,
      pay: n.pay + m.totals.payoutCents,
      items: n.items + m.totals.itemsSold,
    }),
    { gross: 0, disc: 0, ref: 0, comm: 0, pay: 0, items: 0 },
  )

  const noEmail = makers.filter((m) => !m.email)

  return (
    <div className="st">
      <PageHead
        title="Statements"
        sub={`${show.name}. ${makers.length} makers sold. Nothing has been sent.`}
      />

      <table>
        <thead>
          <tr>
            <th className="code">ID</th>
            <th>Shop</th>
            <th className="m">Items</th>
            <th className="m">Gross</th>
            <th className="m">Discounts</th>
            <th className="m">Refunds</th>
            <th className="m">Commission</th>
            <th className="m">Due</th>
          </tr>
        </thead>
        <tbody>
          {makers.map((m) => (
            <tr key={m.code}>
              <td>
                <Link className="code" href={`/admin/statements/${m.code}`}>{m.code}</Link>
              </td>
              <td>
                {m.shop || <span className="warn">not on the roster</span>}
                {m.email ? null : <span className="warn"> &middot; no address</span>}
              </td>
              <td className="m">{m.totals.itemsSold}</td>
              <td className="m">{usd(m.totals.grossCents)}</td>
              <td className="m soft">{m.totals.discountsCents ? usd(-m.totals.discountsCents) : ''}</td>
              <td className="m soft">{m.totals.refundsCents ? usd(-m.totals.refundsCents) : ''}</td>
              <td className="m soft">{usd(m.totals.commissionCents)}</td>
              <td className="m">{usd(m.totals.payoutCents)}</td>
            </tr>
          ))}
          <tr className="tot">
            <td colSpan={2}>{makers.length} makers</td>
            <td className="m">{sum.items}</td>
            <td className="m">{usd(sum.gross)}</td>
            <td className="m">{sum.disc ? usd(-sum.disc) : ''}</td>
            <td className="m">{sum.ref ? usd(-sum.ref) : ''}</td>
            <td className="m">{usd(sum.comm)}</td>
            <td className="m">{usd(sum.pay)}</td>
          </tr>
        </tbody>
      </table>

      <p className="note">
        Sales only. Booth fees and add-ons are settled their own way and are
        not on any statement.
        <br />
        Commission comes off net sales, so a discount at the till or a refund
        is taken off before Mermade&rsquo;s share rather than after.
        <br />
        Mermade&rsquo;s own stock has no statement: there is nobody to pay.
        {noEmail.length > 0 ? (
          <>
            <br />
            <span className="warn">
              No address on file for {noEmail.map((m) => m.code).join(', ')}.
            </span>
          </>
        ) : null}
      </p>
      <style>{css}</style>
    </div>
  )
}
