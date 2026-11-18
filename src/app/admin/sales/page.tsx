import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, spaceTypes, vendors } from '@/db/schema'
import { usd } from '@/lib/money'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { fetchSales } from '@/server/modules/sales/fetch'
import {
  byDay, byHour, byMaker, hourLabel, pacific, totals, HOUSE_CODES,
} from '@/server/modules/sales/read'
import { byCode } from '@/server/modules/roster/inventory-print'
import { PageHead } from '../ui'
import { Refresh } from './Refresh'

export const dynamic = 'force-dynamic'
/* Several pages of orders out of Shopify on a busy afternoon. */
export const maxDuration = 60

/**
 * What the register has taken, while it is taking it.
 *
 * Drew, mid Saturday: "can you put together a live tracking dashboard."
 *
 * Shopify is the source of truth for what has been sold, because the sale
 * happens at the till and nowhere else. The commission rate is not: that is
 * each maker's own snapshot off her booking (rule 6), so what this screen
 * says she is owed is what her statement will say in December rather than a
 * flat twenty percent that happens to be right today.
 *
 * Read only. Nothing on this page writes anything anywhere.
 */

const PT_TODAY = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  })

const css = `
.sx { max-width: 1100px }
.sx .sx-top { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 4px }
.sx .sx-refresh {
  background: none; border: 1px solid var(--ad-line); border-radius: 999px;
  padding: 4px 11px; font: inherit; font-size: var(--t-cap); color: var(--ad-ink-3);
  cursor: pointer; font-variant-numeric: tabular-nums;
}
.sx .sx-refresh:hover { border-color: var(--ad-line-2); color: var(--ad-ink-2) }
.sx .sx-bad { color: var(--ad-warn); font-size: var(--t-s); margin: 10px 0 0 }

/* Six figures, and the column count is stated rather than fitted: auto-fit
   put five on a row and left the sixth beside a grey hole, which reads as a
   tile that failed to load rather than as a tidy row. */
.sx .sx-figs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1px; background: var(--ad-line); border: 1px solid var(--ad-line);
  border-radius: 10px; overflow: hidden; margin: 16px 0 26px }
@media (max-width: 980px) { .sx .sx-figs { grid-template-columns: repeat(3, minmax(0, 1fr)) } }
@media (max-width: 560px) { .sx .sx-figs { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
.sx .sx-fig { background: var(--ad-card); padding: 14px 16px 15px }
.sx .sx-fig b { display: block; font-family: var(--font-c); font-weight: 600;
  font-size: 22px; line-height: 1.15; font-variant-numeric: tabular-nums }
.sx .sx-fig span { display: block; margin-top: 5px; font-size: var(--t-cap);
  text-transform: uppercase; letter-spacing: .09em; color: var(--ad-ink-3) }
.sx .sx-fig.lead { background: var(--ad-ink); }
.sx .sx-fig.lead b { color: #fff }
.sx .sx-fig.lead span { color: #B9B8B2 }

.sx h2 { font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; font-size: var(--t-cap); color: var(--ad-ink-3);
  margin: 0 0 12px; padding-top: 6px }
.sx .sx-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 30px }
@media (max-width: 820px) { .sx .sx-cols { grid-template-columns: minmax(0, 1fr) } }

.sx .sx-hour { list-style: none; margin: 0; padding: 0 }
.sx .sx-hour li { display: grid; grid-template-columns: 46px 1fr auto;
  align-items: center; gap: 10px; padding: 3px 0; font-size: var(--t-s) }
.sx .sx-hour i { display: block; height: 15px; border-radius: 3px;
  background: var(--ad-ink); min-width: 2px }
.sx .sx-hour .t { color: var(--ad-ink-3); font-variant-numeric: tabular-nums }
.sx .sx-hour .v { font-variant-numeric: tabular-nums; white-space: nowrap }
.sx .sx-hour li.now i { background: var(--sd-blue) }

.sx table { width: 100%; border-collapse: collapse; font-size: var(--t-s) }
.sx th { text-align: left; font-family: var(--font-c); font-weight: 600;
  text-transform: uppercase; font-size: var(--t-cap-s); letter-spacing: .09em;
  color: var(--ad-ink-3); border-bottom: 1px solid var(--ad-line-2); padding: 0 10px 6px 0 }
.sx td { padding: 6px 10px 6px 0; border-bottom: 1px solid var(--ad-line);
  vertical-align: baseline }
.sx td.m, .sx th.m { text-align: right; padding-right: 0;
  font-variant-numeric: tabular-nums; white-space: nowrap }
.sx .code { font-family: var(--font-m); white-space: nowrap }
.sx .shop { color: var(--ad-ink-3) }
.sx .house { font-size: var(--t-cap-s); text-transform: uppercase; letter-spacing: .07em;
  color: var(--ad-ink-3) }
.sx .quiet td { color: var(--ad-ink-3) }
.sx .sx-days td { border: 0; padding: 3px 14px 3px 0 }
`

export default async function SalesDesk() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const [read, roster] = await Promise.all([
    fetchSales(),
    db
      .select({
        code: bookings.vendorCode,
        bps: bookings.commissionBps,
        shop: vendors.shopName,
        status: bookings.status,
        track: spaceTypes.track,
      })
      .from(bookings)
      .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
      .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
      .where(eq(bookings.showId, show.id)),
  ])

  if (!read.ok) {
    return (
      <div className="sx">
        <PageHead title="Sales" sub="What the register has taken." />
        <p className="sx-bad">The register could not be read: {read.detail}</p>
        <style>{css}</style>
      </div>
    )
  }

  const bpsOf = new Map(roster.map((r) => [r.code.toUpperCase(), r.bps]))
  const shopOf = new Map(roster.map((r) => [r.code.toUpperCase(), r.shop]))

  const today = PT_TODAY()
  const salesToday = read.sales.filter((s) => pacific(s.at).day === today)
  const makersToday = byMaker(salesToday, bpsOf, show.commissionBps ?? 2000)
  const t = totals(salesToday, makersToday)

  const allMakers = byMaker(read.sales, bpsOf, show.commissionBps ?? 2000)
  const showTotal = totals(read.sales, allMakers)
  const days = byDay(read.sales)
  const hours = byHour(salesToday)
  const peak = Math.max(1, ...hours.map((h) => h.goodsCents))
  const nowHour = pacific(new Date().toISOString()).hour

  /**
   * Who sold nothing, out of those who could have.
   *
   * Indoor and still holding a space, which is the same test the register
   * and the price push use. Built off every booking at the show, this listed
   * ninety codes: outdoor makers, who take their own money at their own tents
   * and can never ring through this till, plus released bookings and a
   * handful of codes nobody uses. A maker who was never going to appear here
   * reads as a maker who had a bad show, which is alarming and wrong.
   */
  const sold = new Set(allMakers.map((m) => m.code))
  const quiet = roster
    .filter((r) => r.track !== 'outdoor' && holdsSpace(r.status))
    .map((r) => r.code.toUpperCase())
    .filter((c) => !sold.has(c))
    .sort(byCode)

  return (
    <div className="sx">
      <div className="sx-top">
        <PageHead title="Sales" sub={`${show.name}. What the register has taken.`} />
        <Refresh />
      </div>

      <div className="sx-figs">
        <div className="sx-fig lead">
          <b>{usd(t.goodsCents)}</b>
          <span>Goods today</span>
        </div>
        <div className="sx-fig">
          <b>{usd(t.totalCents)}</b>
          <span>Collected with tax</span>
        </div>
        <div className="sx-fig">
          <b>{t.orders}</b>
          <span>Orders</span>
        </div>
        <div className="sx-fig">
          <b>{usd(t.basketCents)}</b>
          <span>Average basket</span>
        </div>
        <div className="sx-fig">
          <b>{usd(t.commissionCents)}</b>
          <span>Commission</span>
        </div>
        <div className="sx-fig">
          <b>{usd(t.netCents)}</b>
          <span>Owed to makers</span>
        </div>
      </div>

      <div className="sx-cols">
        <div>
          <h2>Today, by the hour</h2>
          {hours.length === 0 ? (
            <p className="shop">Nothing has rung up yet today.</p>
          ) : (
            <ul className="sx-hour">
              {hours.map((h) => (
                <li key={h.hour} className={h.hour === nowHour ? 'now' : undefined}>
                  <span className="t">{hourLabel(h.hour)}</span>
                  <i style={{ width: `${Math.max(2, (h.goodsCents / peak) * 100)}%` }} />
                  <span className="v">{usd(h.goodsCents)}</span>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: 26 }}>The show so far</h2>
          <table className="sx-days">
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td>{dayName(d.day)}</td>
                  <td className="shop">{d.orders} orders</td>
                  <td className="m">{usd(d.goodsCents)}</td>
                </tr>
              ))}
              <tr>
                <td><b>Total</b></td>
                <td className="shop">{showTotal.orders} orders</td>
                <td className="m"><b>{usd(showTotal.goodsCents)}</b></td>
              </tr>
              <tr>
                <td className="shop">Commission</td>
                <td />
                <td className="m">{usd(showTotal.commissionCents)}</td>
              </tr>
              <tr>
                <td className="shop">Owed to makers</td>
                <td />
                <td className="m">{usd(showTotal.netCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2>By maker, the show so far</h2>
          <table>
            <thead>
              <tr>
                <th className="code">ID</th>
                <th>Shop</th>
                <th className="m">Items</th>
                <th className="m">Sold</th>
                <th className="m">She keeps</th>
              </tr>
            </thead>
            <tbody>
              {allMakers.map((m) => (
                <tr key={m.code}>
                  <td className="code">{m.code}</td>
                  <td>
                    {shopOf.get(m.code) ?? (HOUSE_CODES.has(m.code) ? 'Mermade Market' : '')}
                    {HOUSE_CODES.has(m.code) ? <span className="house"> &middot; house</span> : null}
                  </td>
                  <td className="m">{m.units}</td>
                  <td className="m">{usd(m.grossCents)}</td>
                  <td className="m">{usd(m.netCents)}</td>
                </tr>
              ))}
              {quiet.length > 0 ? (
                <tr className="quiet">
                  <td colSpan={5}>
                    Sold nothing: {quiet.join(', ')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <style>{css}</style>
    </div>
  )
}
