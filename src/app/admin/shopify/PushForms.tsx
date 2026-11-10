'use client'

import { useActionState } from 'react'
import { archiveOld, pushCollections, pushProducts } from './actions'
import { empty, type PushState } from './state'

/**
 * Three presses, each with a plan before it.
 *
 * Every one of these rewrites a catalogue a till reads on Friday morning, so
 * each is two buttons rather than one: the first writes nothing and shows
 * what would happen, the second does it. The same shape as the maker numbers
 * screen, which staff already know.
 */
function Result({ state }: { state: PushState }) {
  if (state.error) {
    return <p className="adm-note adm-note--bad" role="alert">{state.error}</p>
  }
  if (state.result === undefined) return null
  return (
    <>
      <p className="adm-note" role="status">
        {state.applied ? 'Done.' : 'Nothing was written. This is what it would do.'}
      </p>
      <pre className="adm-pre">{JSON.stringify(state.result, null, 2)}</pre>
    </>
  )
}

function Pair({ busy, noun }: { busy: boolean; noun: string }) {
  return (
    <div className="adm-acts">
      <button className="btn btn--primary" type="submit" name="intent" value="check" disabled={busy}>
        {busy ? 'Working' : 'Check it'}
      </button>
      <button className="btn" type="submit" name="intent" value="apply" disabled={busy}>
        {busy ? 'Working' : `Send the ${noun}`}
      </button>
    </div>
  )
}

export function ProductsForm() {
  const [state, action, busy] = useActionState(pushProducts, empty)
  return (
    <form action={action}>
      <div className="adm-sec"><h2>Prices</h2></div>
      <p className="adm-sub2">
        One product per line, every indoor maker holding a space. The Mermade ID
        goes in the vendor field, which is what the payout is grouped by and the
        only thing a collection can be ruled on. Matched on SKU, so a maker who
        corrects a price is updated rather than duplicated.
      </p>
      <Pair busy={busy} noun="prices" />
      <Result state={state} />
    </form>
  )
}

export function CollectionsForm() {
  const [state, action, busy] = useActionState(pushCollections, empty)
  return (
    <form action={action}>
      <div className="adm-sec"><h2>A collection per maker</h2></div>
      <p className="adm-sub2">
        Smart collections, ruled on the vendor field, so a price added on
        Thursday night files itself. Only makers who have filed something: an
        empty collection on a register is a wrong tap waiting to happen.
      </p>
      <Pair busy={busy} noun="collections" />
      <Result state={state} />
    </form>
  )
}

export function ArchiveForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, busy] = useActionState(archiveOld, empty)
  return (
    <form action={action}>
      <div className="adm-sec"><h2>Last season</h2></div>
      <p className="adm-sub2">
        Archives everything created before this date, which takes it out of the
        register and out of search. Archived, not deleted: one click in Shopify
        puts any of it back.
      </p>
      <label className="adm-field">
        <span>Created before</span>
        <input type="date" name="createdBefore" defaultValue={defaultDate} />
      </label>
      <Pair busy={busy} noun="archive" />
      <Result state={state} />
    </form>
  )
}
