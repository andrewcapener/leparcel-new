'use client'

import { useActionState } from 'react'
import { addLines, savePrices, type SaveState } from './actions'

const EMPTY: SaveState = { error: null, note: null, changed: 0 }

function Says({ state }: { state: SaveState }) {
  if (state.error) return <p className="reg-bad">{state.error}</p>
  if (state.note) return <p className="reg-ok">{state.note}</p>
  return null
}

export type Line = { id: string; label: string; price: string; multiBuys: string }

/**
 * The prices, each in a box big enough to hit with a thumb.
 *
 * One button for the whole maker rather than one per line, because the
 * conversation at the counter is "these three are wrong", not three separate
 * errands, and every press is a round trip to Shopify.
 */
export function PriceForm({ bookingId, lines }: { bookingId: string; lines: Line[] }) {
  const [state, action, busy] = useActionState(savePrices, EMPTY)
  return (
    <form action={action} className="reg-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <ul className="reg-lines">
        {lines.map((l) => (
          <li key={l.id}>
            <label htmlFor={`p-${l.id}`}>
              <span className="reg-item">{l.label || 'No name given'}</span>
              {l.multiBuys ? <span className="reg-multi">{l.multiBuys}</span> : null}
            </label>
            <div className="reg-money">
              <span aria-hidden="true">$</span>
              <input
                id={`p-${l.id}`}
                name={`price:${l.id}`}
                defaultValue={l.price}
                inputMode="decimal"
                autoComplete="off"
                aria-label={`Price for ${l.label || 'this line'}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <label className="reg-why" htmlFor="reason">
        Why, for the record
        <input id="reason" name="reason" placeholder="changed at the show" autoComplete="off" />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? 'Sending to the register...' : 'Save and send to the register'}
      </button>
      <Says state={state} />
    </form>
  )
}

/** Whatever she turned up with that is not on the list. */
export function AddForm({ bookingId }: { bookingId: string }) {
  const [state, action, busy] = useActionState(addLines, EMPTY)
  return (
    <form action={action} className="reg-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="list" className="reg-why">
        One a line, with the price
        <textarea
          id="list"
          name="list"
          rows={4}
          placeholder={'Earrings $18\nRings $12, 2 for $20'}
        />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? 'Sending to the register...' : 'Add and send to the register'}
      </button>
      <Says state={state} />
    </form>
  )
}
