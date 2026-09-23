'use client'

import { useActionState } from 'react'
import { stopScheduledChase } from './actions'
import { emptyStop, type StopState } from './state'

/**
 * Stop what is already scheduled, and say what happened.
 *
 * This was a plain form action returning nothing, which meant a failure and a
 * success looked identical: the page reloaded and the block was still there.
 * Drew pressed it and told me nothing happened, and he was right, and there
 * was no way for either of us to tell why from the screen.
 *
 * So it reports in every case, including the case where the answer is that
 * nothing could be cancelled, and it names the way out that does not depend
 * on this code at all.
 */
export function StopForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState<StopState, FormData>(
    stopScheduledChase, emptyStop,
  )

  return (
    <form action={action}>
      <div className="adm-acts">
        <button className="adm-btn" type="submit" disabled={pending}>
          {pending ? 'Asking Resend to stop them' : `Stop ${count === 1 ? 'it' : `all ${count}`}`}
        </button>
      </div>
      <p className="adm-note" role="status" aria-live="polite">
        {state.message}
      </p>
    </form>
  )
}
