'use client'

import { useActionState, useState } from 'react'
import { usd } from '@/lib/money'
import { runImport, emptyImport, type ImportState } from './actions'

/**
 * Paste the sheet, read what would happen, then do it.
 *
 * The order is enforced rather than suggested. The Accept button does not
 * exist until a dry run has drawn the list, and it carries a fingerprint of
 * the text that list was drawn from, so editing the box after reading the
 * list puts you back at the start. Seventy eight bookings is not a thing
 * anybody should be able to do twice by accident.
 */
export function ImportForm({ spaces }: { spaces: { label: string; priceCents: number }[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(runImport, emptyImport)
  /* The textarea is uncontrolled so typing stays fast, which means the server
     cannot know it has been edited until the next submit. This can. */
  const [edited, setEdited] = useState(false)
  const s = state.summary
  const ran = state.done !== null
  const stale = edited && !ran
  const canAccept = s !== null && s.willBook > 0 && !ran && !stale

  const book = state.plan.filter((p) => p.kind === 'book')
  const already = state.plan.filter((p) => p.kind === 'already')
  const trouble = state.plan.filter((p) => p.kind === 'problem')

  return (
    <form action={action}>
      <input type="hidden" name="digest" value={state.digest} />

      <div className="adm-field">
        <label className="lb" htmlFor="sheet">The sheet, pasted</label>
        <textarea
          id="sheet" name="sheet" className="inp" rows={10}
          defaultValue={state.text}
          onChange={() => setEdited(true)}
          spellCheck={false}
          placeholder="Shop&#9;Sign-in email&#9;Book this space&#9;CHARGE"
          aria-describedby="sheet-help"
        />
        <span className="hint" id="sheet-help">
          Select the rows in the sheet including the heading row, copy, paste here. Tabs or
          commas both read. The columns used are Sign-in email, Book this space and CHARGE.
          Everything else is ignored. The fee in CHARGE is the whole fee and nothing is added
          on top of it.
        </span>
      </div>

      <div className="adm-acts">
        <button className="adm-btn-q" type="submit" name="mode" value="plan" disabled={pending}>
          {pending ? 'Working' : 'Dry run'}
        </button>
        {canAccept && (
          <button className="adm-btn" type="submit" name="mode" value="apply" disabled={pending}>
            Accept these {s.willBook} makers
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="adm-note" style={{ marginTop: 18 }}>
        {stale && s
          ? 'The sheet has changed since that dry run. Run it again before accepting.'
          : state.message}
      </p>

      {s && (
        <>
          <div className="adm-sec"><h2>What this paste would do</h2></div>
          <dl className="adm-facts">
            <div><dt>{ran ? 'Booked' : 'Would book'}</dt><dd>{ran ? state.done!.booked : s.willBook}</dd></div>
            <div><dt>Already booked</dt><dd>{s.already}</dd></div>
            <div><dt>Problems</dt><dd>{s.problems + state.problems.length}</dd></div>
            <div><dt>Fees, total</dt><dd className="mono">{usd(s.totalCents)}</dd></div>
            <div>
              <dt>Not the list price</dt>
              <dd>{s.overridden}<span className="adm-sub2">The number the girls signed off on. If it has moved, the sheet has.</span></dd>
            </div>
          </dl>
        </>
      )}

      {state.problems.length > 0 && (
        <>
          <div className="adm-sec"><h2>Rows that could not be read</h2></div>
          <table className="adm-tbl">
            <thead><tr><th scope="col">Line</th><th scope="col">Why</th></tr></thead>
            <tbody>
              {state.problems.map((p) => (
                <tr key={`${p.line}-${p.detail}`}>
                  <td className="mono">{p.line}</td>
                  <td>{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {trouble.length > 0 && (
        <>
          <div className="adm-sec">
            <h2>Will not be booked</h2><span className="c">{trouble.length}</span>
          </div>
          <table className="adm-tbl">
            <thead>
              <tr><th scope="col">Line</th><th scope="col">Maker</th><th scope="col">Why</th></tr>
            </thead>
            <tbody>
              {trouble.map((p) => (
                <tr key={p.line}>
                  <td className="mono">{p.line}</td>
                  <td>
                    <span className="adm-nm">{p.shop}</span>
                    <span className="adm-sub2">{p.email}</span>
                  </td>
                  <td>{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {book.length > 0 && (
        <>
          <div className="adm-sec">
            <h2>{ran ? 'Booked' : 'Would be booked'}</h2>
            <span className="c">{book.length}</span>
          </div>
          <table className="adm-tbl">
            <caption className="adm-sr">
              Every maker this paste accepts, with the space and the fee that will be charged.
            </caption>
            <thead>
              <tr>
                <th scope="col">Maker</th>
                <th scope="col">Space</th>
                <th scope="col" className="r">Fee</th>
                <th scope="col" className="r">List price</th>
              </tr>
            </thead>
            <tbody>
              {book.map((p) => (
                <tr key={p.line}>
                  <td>
                    <span className="adm-nm">{p.shop}</span>
                    <span className="adm-sub2">{p.email}</span>
                  </td>
                  <td>{p.spaceLabel}</td>
                  <td className="r adm-money">{usd(p.priceCents)}</td>
                  <td className="r">
                    {p.priceCents === p.defaultCents
                      ? <span className="adm-sub2">list</span>
                      : <span className="adm-tag" data-warn="1">{usd(p.defaultCents)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {already.length > 0 && (
        <>
          <div className="adm-sec">
            <h2>Left exactly as they are</h2><span className="c">{already.length}</span>
          </div>
          <table className="adm-tbl">
            <thead><tr><th scope="col">Maker</th><th scope="col">Why</th></tr></thead>
            <tbody>
              {already.map((p) => (
                <tr key={p.line}>
                  <td><span className="adm-nm">{p.shop}</span></td>
                  <td>{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {state.done && state.done.failed.length > 0 && (
        <>
          <div className="adm-sec"><h2>Could not be booked</h2></div>
          <table className="adm-tbl">
            <thead><tr><th scope="col">Maker</th><th scope="col">What happened</th></tr></thead>
            <tbody>
              {state.done.failed.map((f) => (
                <tr key={f.shop}><td>{f.shop}</td><td className="mono">{f.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="adm-sec"><h2>Space labels on this show</h2></div>
      <table className="adm-tbl">
        <caption className="adm-sr">
          The labels the Book this space column has to match, and their list prices.
        </caption>
        <thead><tr><th scope="col">Label</th><th scope="col" className="r">List price</th></tr></thead>
        <tbody>
          {spaces.map((sp) => (
            <tr key={sp.label}>
              <td className="mono">{sp.label}</td>
              <td className="r adm-money">{usd(sp.priceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </form>
  )
}
