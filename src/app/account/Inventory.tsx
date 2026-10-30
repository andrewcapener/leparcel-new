import { Card, CardNote } from './Shell'
import {
  addInventoryItem, addPastedList, saveInventoryItem, removeInventoryItem, submitInventory,
} from './inventory-actions'
import {
  formatLine, listNotice, oddCentsNote, tag, sendLabel, sendNotice,
  type Line, type ListState, type SendState,
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

/**
 * A dollar sign inside the box, against the number the maker is typing.
 *
 * Drew, 29 October: "when you fill out information here on the price I think
 * it should have a dollar symbol next to the price your filling out, so its
 * really clear." Two of these four boxes take money and two take a count,
 * and nothing on screen said which was which: the column headings read
 * Price, Buy, For, and a maker typing 12 into For had no way to know whether
 * the register would read twelve dollars or twelve of them.
 *
 * Decoration only, and hidden from screen readers, which have the field's
 * own label. Nothing here reaches the parser: priceFromDollars still takes
 * the raw text, so a maker who types the sign herself is not punished for it.
 */
function Money({ children }: { children: React.ReactNode }) {
  return (
    <span className="mk-money">
      <span className="mk-money__sym" aria-hidden="true">$</span>
      {children}
    </span>
  )
}

/**
 * The multi-buy, folded away until somebody wants one.
 *
 * Drew typed 1 and 12 into Buy and For three separate times, and he was
 * right to: two empty boxes beside a price read as "how many have you got,
 * and for how much". Every one of those lines was refused. The answer was
 * never a better refusal, it was not asking the question. Most lines on most
 * lists are a thing and a price, so that is the whole form now, and the two
 * boxes appear for the makers who actually sell "buy 2/$8".
 *
 * A <details>, so it costs no JavaScript and the form still works without
 * any: the inputs are in the document whether it is open or shut, and an
 * empty pair means no multi-buy, which is what readLine already expects.
 * Open on a line that already has one, so nothing is hidden from the maker
 * who set it.
 */
function MultiBuy({ qty, price }: { qty: string; price: string }) {
  const has = qty !== '' || price !== ''
  return (
    <details className="mk-item__opt" open={has}>
      <summary>{has ? 'Multi-buy' : 'Add a multi-buy'}</summary>
      <span className="mk-item__optf">
        <label className="mk-item__f mk-item__f--sm">
          <span className="lb">Buy</span>
          <input className="inp" type="text" inputMode="numeric" name="bundleQty"
            defaultValue={qty} placeholder="2" />
        </label>
        <label className="mk-item__f">
          <span className="lb">For</span>
          <Money>
            <input className="inp" type="text" inputMode="decimal" name="bundlePrice"
              defaultValue={price} placeholder="8" />
          </Money>
        </label>
        <span className="mk-item__opth">Two or more, for less than they cost singly.</span>
      </span>
    </details>
  )
}

/** Dollars for an input box: no symbol, and no .00 nobody typed. */
const dollars = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)

export function Inventory({
  rows, state, send, dueAt, notice, echo,
}: {
  rows: Row[]
  state: ListState
  /** Whether they have told us it is finished, which is what crosses the
   *  row off their list. Typing one line never should have. */
  send: SendState
  dueAt: string | null
  /** The complaint from the last attempt, already in the maker's words. */
  notice?: string
  /** What they typed when it was refused, so nothing is retyped. */
  echo?: { l?: string; p?: string; bq?: string; bp?: string; list?: string }
}) {
  const lines = rows.map(asLine)
  const odd = oddCentsNote(lines)
  const open = state === 'open'

  return (
    <Card title="Your inventory" id="items" wide>
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

      {/* Only when there is no form to attach it to. An open list puts the
          same sentence directly above the boxes, because that is where the
          maker is looking after pressing Add. */}
      {notice && !open && <p className="mk-note" role="status">{notice}</p>}

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
                    <span className="lb">Price each</span>
                    <Money>
                      <input className="inp" type="text" inputMode="decimal" name="price"
                        defaultValue={dollars(r.priceCents)} required />
                    </Money>
                  </label>
                  <span className="mk-item__do">
                    <button className="btn btn--quiet" type="submit">Save</button>
                  </span>
                  <MultiBuy
                    qty={r.bundleQty !== null ? String(r.bundleQty) : ''}
                    price={r.bundleCents !== null ? dollars(r.bundleCents) : ''} />
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

      {/* Said before the boxes rather than after them. It used to sit under
          the form as a quiet aside, which is the one place a person filling
          the form in has already stopped reading. */}
      {open && (
        <p className="mk-item__hint">
          A thing and what one of them costs. That is all most lines need.
        </p>
      )}

      {/* Against the boxes, in the colour of something that went wrong. */}
      {notice && open && (
        <p className="mk-note mk-note--bad" role="alert">{notice}</p>
      )}

      {open && (
        <form action={addInventoryItem} className="mk-item__form mk-item__form--new">
          <label className="mk-item__f mk-item__f--grow">
            <span className="lb">What it is</span>
            <input className="inp" type="text" name="label" defaultValue={echo?.l ?? ''}
              placeholder="Stickers" maxLength={80} required />
          </label>
          <label className="mk-item__f">
            <span className="lb">Price each</span>
            <Money>
              <input className="inp" type="text" inputMode="decimal" name="price"
                defaultValue={echo?.p ?? ''} placeholder="7" required />
            </Money>
          </label>
          <span className="mk-item__do">
            <button className="btn btn--primary" type="submit">Add</button>
          </span>
          <MultiBuy qty={echo?.bq ?? ''} price={echo?.bp ?? ''} />
        </form>
      )}

      {/* The whole list at once, in the format Elise already asks for.
          Shut by default, because the form above is the quicker way to add
          one thing, and this is the quicker way to add thirty. */}
      {open && (
        <details className="mk-paste" open={Boolean(echo?.list)}>
          <summary>Paste your whole list instead</summary>
          <form action={addPastedList}>
            <p className="mk-item__hint">
              One line per price, the way you would write it in an email. We
              read &ldquo;Maps: $5 or buy 2/$8&rdquo;, and we ignore a heading
              with your name on it.
            </p>
            <label>
              <span className="lb">Your list</span>
              <textarea className="inp mk-paste__box" name="list" rows={6}
                defaultValue={echo?.list ?? ''}
                placeholder={'Maps: $5 or buy 2/$8\nStickers/Maps/gift tags: $7\nTable cloths / Backpacks: $20 or buy 2/$36'} />
            </label>
            <button className="btn btn--primary" type="submit">Add these</button>
          </form>
        </details>
      )}

      {odd && <CardNote>{odd}</CardNote>}

      {/* "That is my list." A signal, not a door closing: they can still add
          and remove, and this asks again when they do. */}
      {open && rows.length > 0 && (
        <div className="mk-send">
          {sendNotice(send) && <p className="mk-card__lede">{sendNotice(send)}</p>}
          {sendLabel(send) ? (
            <form action={submitInventory}>
              <button className="btn btn--primary" type="submit">{sendLabel(send)}</button>
            </form>
          ) : (
            <p className="mk-send__done">Your list is with us.</p>
          )}
        </div>
      )}

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
