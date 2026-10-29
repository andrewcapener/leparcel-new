'use client'

import { useActionState, useState } from 'react'
import { runCodes, type CheckState } from './actions'

const PLACEHOLDER = [
  'MM1\tSkylark Place\tSkyelar Nalley\tskyelarnalley@gmail.com',
  'MM2\tThe Flaky Apple Pie Co.\tBrooke Cazier\tbrooke@flakyapplepieco.com',
].join('\n')

/**
 * Paste the sheet, read what it would do, then do it.
 *
 * One form and two buttons, rather than two forms. The sheet is a thousand
 * lines of spreadsheet padding and it is posted once, from the box it is
 * typed into: the apply used to carry its own copy in a hidden field while
 * React posted the previous state back alongside it, which is three trips
 * over the wire for the same text on every press.
 *
 * The first button writes nothing. A Mermade ID is what a manual payment is
 * matched by, so this screen moves the thing that identifies somebody's
 * money, and it is read before it is pressed.
 */
export function CodeForm() {
  const [state, run, busy] = useActionState<CheckState, FormData>(runCodes, null)
  /* Held here on purpose.
     
     React empties an uncontrolled field once a Server Action has taken it,
     so after Check it the box was blank, and the second button then posted
     an empty sheet and reported that it had changed nothing. Keeping the
     value in the component means it survives both presses and still travels
     over the wire exactly once each time, which is the whole point of not
     putting the sheet back into the returned state. */
  const [sheet, setSheet] = useState('')

  return (
    <form action={run} className="adm-form">
      <label className="adm-field">
        <span className="lb">The sheet, pasted</span>
        <textarea name="sheet" rows={10} className="inp adm-paste"
          placeholder={PLACEHOLDER} value={sheet}
          onChange={(e) => setSheet(e.target.value)} />
      </label>
      <p className="adm-sub2">
        Number, shop, person, email, in the sheet&rsquo;s own order. Everything
        under the roster is ignored: a row needs a number and an email address
        to count. Nothing is written by Check it.
      </p>

      <button className="btn btn--primary" type="submit"
        name="intent" value="check" disabled={busy}>
        {busy ? 'Working' : 'Check it'}
      </button>

      {state?.error && (
        <p className="adm-note adm-note--bad" role="alert">{state.error}</p>
      )}

      {state?.done !== undefined && !state.error && (
        <p className="adm-note" role="status">
          {state.done === 0
            ? 'Nothing was changed.'
            : `Changed ${state.done} maker ${state.done === 1 ? 'number' : 'numbers'}.`}
        </p>
      )}

      {state && !state.error && state.notice && (
        <p className="adm-note" role="status">{state.notice}</p>
      )}

      {state && state.problems.length > 0 && (
        <ul className="adm-probs">
          {state.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {state && state.rows.length > 0 && (
        <table className="adm-tbl">
          <caption className="adm-sr">What each row would do</caption>
          <thead>
            <tr>
              <th scope="col">Maker</th>
              <th scope="col">Now</th>
              <th scope="col">Becomes</th>
              <th scope="col">What happens</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((r) => (
              <tr key={`${r.email}-${r.becomes}`}>
                <td>
                  <strong>{r.shop}</strong>
                  <span className="adm-sub2"> {r.email}</span>
                </td>
                <td>{r.now}</td>
                <td><strong>{r.becomes}</strong></td>
                <td>{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Same form, same textarea, so the sheet travels once. */}
      {state && state.todo > 0 && (
        <>
          <p className="adm-sub2">
            Only the {state.todo} marked &ldquo;will change&rdquo; are written.
            Anything needing a person is left exactly as it is.
          </p>
          <button className="btn btn--primary" type="submit"
            name="intent" value="apply" disabled={busy}>
            {busy ? 'Writing' : `Change ${state.todo} ${state.todo === 1 ? 'number' : 'numbers'}`}
          </button>
        </>
      )}
    </form>
  )
}
