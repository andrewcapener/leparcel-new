import { Card, CardNote } from './Shell'
import { addInventoryItem, saveInventoryItem, removeInventoryItem } from './inventory-actions'
import {
  formatLine, listNotice, oddCentsNote, tag, type Line, type ListState,
} from '@/server/modules/inventory/lines'
import { fmtDateTime } from '@/lib/dates'

/**
 * The item list, typed by the person who knows the prices.
 *
 * Today a maker types this into the body of an email and somebody keys every
 * line of it into the register by hand. Hillary's instruction even says "I
 * repeat, do not send us a separate file", because a spreadsheet per maker
 * was worse than an email per maker. Same list, one shape, typed once.
 *
 * ── why it looks like this ───────────────────────────────────────────────
 * One line is a KIND of goods at a price, not a SKU and not stock. Her own
 * example is the spec: "Maps: $5 or buy 2/$8". A maker with forty stickers
 * at $7 writes one line. That shortness is the only reason this ever gets
 * filled in, so the form must not imply otherwise, which is why there is no
 * quantity field and no stock count anywhere on it.
 *
 * Every row is its own form. Nested forms are invalid HTML, and this has to
 * work with no JavaScript at all: a magic link opened inside a mail client's
 * browser is the normal way a maker arrives here.
 */

export type Row = {
  id: string
  label: string
  priceCents: number
  bundleQty: number | null
  bundleCents: number | null
}

const asLine = (r: Row): Line => ({
  label: r.label, priceCents: r.priceCents,
  bundleQty: r.bundleQty, bundleCents: r.bundleCents,
})

/** Dollars for an input box: no symbol, and no .00 nobody typed. */
const dollars = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)

export function Inventory({
  rows, state, dueAt, notice, echo,
}: {
  rows: Row[]
  state: ListState
  dueAt: string | null
  /** The complaint from the last attempt, already in the maker's words. */
  notice?: string
  /** What they typed when it was refused, so nothing is retyped. */
  echo?: { l?: string; p?: string; bq?: string; bp?: string }
}) {
  const lines = rows.map(asLine)
  const odd = oddCentsNote(lines)
  const open = state === 'open'

  return (
    <Card title="Your item list" id="items" wide>
      <p className="mk-card__lede">
        What you are bringing, with prices, so the register knows your work.
        One line per price, not one line per item: forty stickers at $7 is a
        single line.
      </p>

      {dueAt && (
        <p className="mk-task__due">
          {open ? 'Final list due' : 'Closed'} {fmtDateTime(dueAt)}
        </p>
      )}

      {notice && <p className="mk-note" role="status">{notice}</p>}

      <p className="mk-card__lede">{listNotice(state, rows.length)}</p>

      {rows.length > 0 && (
        <ul className="mk-items">
          {rows.map((r) => (
            <li className="mk-item" key={r.id}>
              {open ? (
                <form action={saveInventoryItem} className="mk-item__form">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="mk-item__f mk-item__f--grow">
                    <span className="lb">What it is</span>
                    <input className="inp" type="text" name="label"
                      defaultValue={r.label} maxLength={80} required />
                  </label>
                  <label className="mk-item__f">
                    <span className="lb">Price</span>
                    <input className="inp" type="text" inputMode="decimal" name="price"
                      defaultValue={dollars(r.priceCents)} required />
                  </label>
                  <label className="mk-item__f mk-item__f--sm">
                    <span className="lb">Buy</span>
                    <input className="inp" type="text" inputMode="numeric" name="bundleQty"
                      defaultValue={r.bundleQty ?? ''} placeholder="2" />
                  </label>
                  <label className="mk-item__f">
                    <span className="lb">For</span>
                    <input className="inp" type="text" inputMode="decimal" name="bundlePrice"
                      defaultValue={r.bundleCents !== null ? dollars(r.bundleCents) : ''}
                      placeholder="8" />
                  </label>
                  <span className="mk-item__do">
                    <button className="btn btn--quiet" type="submit">Save</button>
                  </span>
                </form>
              ) : (
                <p className="mk-item__read">{formatLine(asLine(r))}</p>
              )}
              {open && (
                <form action={removeInventoryItem} className="mk-item__rm">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn--quiet" type="submit"
                    aria-label={`Remove ${r.label}`}>Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form action={addInventoryItem} className="mk-item__form mk-item__form--new">
          <label className="mk-item__f mk-item__f--grow">
            <span className="lb">What it is</span>
            <input className="inp" type="text" name="label" defaultValue={echo?.l ?? ''}
              placeholder="Stickers" maxLength={80} required />
          </label>
          <label className="mk-item__f">
            <span className="lb">Price</span>
            <input className="inp" type="text" inputMode="decimal" name="price"
              defaultValue={echo?.p ?? ''} placeholder="7" required />
          </label>
          <label className="mk-item__f mk-item__f--sm">
            <span className="lb">Buy</span>
            <input className="inp" type="text" inputMode="numeric" name="bundleQty"
              defaultValue={echo?.bq ?? ''} placeholder="2" />
          </label>
          <label className="mk-item__f">
            <span className="lb">For</span>
            <input className="inp" type="text" inputMode="decimal" name="bundlePrice"
              defaultValue={echo?.bp ?? ''} placeholder="12" />
          </label>
          <span className="mk-item__do">
            <button className="btn btn--primary" type="submit">Add</button>
          </span>
        </form>
      )}

      {open && (
        <CardNote>
          Leave Buy and For empty unless there is a multi-buy. Filling them in
          with 2 and 8 reads as &ldquo;buy 2/$8&rdquo; at the register.
        </CardNote>
      )}

      {odd && <CardNote>{odd}</CardNote>}

      {rows.length > 0 && (
        <details className="mk-items__preview">
          <summary>What the register will see</summary>
          <pre className="mk-items__pre">{lines.map(formatLine).join('\n')}</pre>
          <p className="mk-card__lede">
            {rows.length} {rows.length === 1 ? 'line' : 'lines'}, from{' '}
            {tag(Math.min(...lines.map((l) => l.priceCents)))} to{' '}
            {tag(Math.max(...lines.map((l) => l.priceCents)))}.
          </p>
        </details>
      )}
    </Card>
  )
}
