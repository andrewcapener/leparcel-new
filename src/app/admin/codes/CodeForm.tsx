'use client'

import { useActionState } from 'react'
import { checkCodes, applyCodes, type CheckState } from './actions'
import { summariseCodes, codeNotice, appliable } from '@/server/modules/roster/codes'

const PLACEHOLDER = [
  'MM1\tSkylark Place\tSkyelar Nalley\tskyelarnalley@gmail.com',
  'MM2\tThe Flaky Apple Pie Co.\tBrooke Cazier\tbrooke@flakyapplepieco.com',
].join('\n')

/**
 * Paste the sheet, read what it would do, then do it.
 *
 * Two presses, and the first one writes nothing. A Mermade ID is what a
 * manual payment is matched by, so this screen moves the thing that
 * identifies somebody's money, and the same rule as /admin/chase and
 * /admin/onboarding applies: it is read before it is pressed.
 */
export function CodeForm() {
  const [state, check, checking] = useActionState<CheckState, FormData>(checkCodes, null)
  const [applied, apply, applying] = useActionState<CheckState, FormData>(applyCodes, null)

  const shown = applied ?? state
  const plan = shown?.plan ?? []
  const sum = summariseCodes(plan)
  const todo = appliable(plan)

  return (
    <>
      <form action={check} className="adm-form">
        <label className="adm-field">
          <span className="lb">The sheet, pasted</span>
          <textarea name="sheet" rows={10} className="inp adm-paste"
            defaultValue={shown?.text ?? ''} placeholder={PLACEHOLDER} />
        </label>
        <p className="adm-sub2">
          Number, shop, person, email, in the sheet&rsquo;s own order. Everything
          under the roster is ignored: a row needs a number and an email address
          to count. Nothing is written by this button.
        </p>
        <button className="btn btn--primary" type="submit" disabled={checking}>
          {checking ? 'Reading' : 'Check it'}
        </button>
      </form>

      {applied?.done && (
        <p className="adm-note" role="status">
          {applied.done.changed === 0
            ? 'Nothing was changed.'
            : `Changed ${applied.done.changed} maker ${applied.done.changed === 1 ? 'number' : 'numbers'}.`}
        </p>
      )}

      {shown && (
        <>
          <p className="adm-note" role="status">{codeNotice(sum)}</p>

          {shown.problems.length > 0 && (
            <ul className="adm-probs">
              {shown.problems.map((p) => (
                <li key={`${p.line}-${p.detail}`}>
                  {p.line > 0 ? `Line ${p.line}: ` : ''}{p.detail}
                </li>
              ))}
            </ul>
          )}

          {plan.length > 0 && (
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
                {plan.map((p) => (
                  <tr key={`${p.row.line}-${p.row.code}`}>
                    <td>
                      <strong>{p.row.shop || p.row.email}</strong>
                      <span className="adm-sub2"> {p.row.email}</span>
                    </td>
                    <td>
                      {p.kind === 'change' ? p.from
                        : p.kind === 'same' ? p.holder.code
                        : p.kind === 'bumped' ? p.from
                        : p.kind === 'shared' ? p.holders.map((h) => h.code).join(' and ')
                        : ''}
                    </td>
                    <td><strong>{p.row.code}</strong></td>
                    <td>
                      {p.kind === 'change' && 'Will change.'}
                      {p.kind === 'same' && 'Already right.'}
                      {p.kind === 'shared' && (
                        <>Two makers share this address, so we cannot tell which
                        one this number belongs to. Give them separate addresses
                        on the roster first.</>
                      )}
                      {p.kind === 'nomaker' && 'Nobody with this address holds a space at this show.'}
                      {p.kind === 'bumped' && (
                        <>Will change. {p.moves.holder.shopName} holds {p.row.code}
                        {p.moves.holder.track === 'outdoor' ? ' outdoors' : ''} and is
                        not in the sheet, so they move up to{' '}
                        <strong>{p.moves.to}</strong>.</>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {todo.length > 0 && !applied?.done && (
            <form action={apply} className="adm-form">
              <input type="hidden" name="sheet" value={shown.text} />
              <p className="adm-sub2">
                Only the {todo.length} marked &ldquo;will change&rdquo; are written.
                Anything needing a person is left exactly as it is.
              </p>
              <button className="btn btn--primary" type="submit" disabled={applying}>
                {applying ? 'Writing' : `Change ${todo.length} ${todo.length === 1 ? 'number' : 'numbers'}`}
              </button>
            </form>
          )}
        </>
      )}
    </>
  )
}
