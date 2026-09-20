import { Card, CardNote } from './Shell'
import { startConnectOnboarding, refreshPayoutStatus } from '@/app/actions'
import type { ConnectState } from '@/server/modules/payments/connect'

/**
 * How a maker gets paid. The other direction from the invoice above it.
 *
 * Indoor only, and rendered by the account page only when payouts are
 * configured on this deployment. Drew, 21 September 2026: "so that they only
 * have to set up stripe once and we can pay them automatically."
 *
 * Two things this card is careful about.
 *
 * It never says "restricted", which is Stripe's word and tells a maker
 * nothing. When Stripe is waiting on something, that something is named in
 * plain words, because the whole failure mode here is a maker who thinks they
 * finished, did not, and finds out on statement day in November.
 *
 * And it never implies their money is at risk. It is not: an unfinished
 * payout account holds up the transfer, not the sale, and the money waits for
 * them. A card that reads as a threat gets a phone call; one that reads as an
 * errand gets done.
 */
export function PayoutSetup({
  state, needs, notice,
}: {
  state: ConnectState
  /** What Stripe is still waiting for, already in the maker's words. */
  needs: string[]
  /** Set when the maker has just come back from Stripe, or something failed. */
  notice?: 'back' | 'unavailable'
}) {
  const done = state === 'ready'

  return (
    <Card title="How you get paid" id="payouts" wide>
      {notice === 'unavailable' && (
        <p className="rte" role="status"><strong>
          We could not open Stripe just then. Try again in a minute, and if it
          keeps happening write to us and we will sort it out by hand.
        </strong></p>
      )}

      <p className="mk-card__lede">
        {done
          ? 'You are set up. After the show closes we send your share straight to your own bank account, and there is nothing else for you to do.'
          : state === 'in_review'
            ? 'Stripe is checking what you sent. That is normal, it is usually quick, and there is nothing for you to do while they look.'
            : state === 'disabled'
              ? 'Stripe has put a hold on your payout account. Opening it below shows you what they need.'
              : 'We sell your work at the register and send you your share after the show. Stripe needs to know who you are and where that money goes. About ten minutes, once, and it carries over to every show after this one.'}
      </p>

      {!done && needs.length > 0 && (
        <>
          <p className="rte">Stripe still needs:</p>
          <ul className="mk-needs">
            {needs.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </>
      )}

      {/* A div and not a <p>, which is not pedantry: a form inside a
          paragraph is invalid nesting, and the browser hoists the form out of
          it on parse, so React hydrates against a tree that no longer matches
          what the server sent. */}
      <div className="mk-task__do">
        {done ? (
          /* No button. There is nothing to press, and a live control on a
             finished row invites somebody to go and break something. */
          <p>Nothing left to do here.</p>
        ) : (
          <form action={startConnectOnboarding}>
            <button className="btn btn--primary" type="submit">
              {state === 'not_started' ? 'Set up payouts' : 'Continue with Stripe'}
            </button>
          </form>
        )}

        {/* Only after they have come back. The webhook usually beats them
            here, and a refresh button on a page nobody is waiting on is
            clutter. */}
        {notice === 'back' && !done && (
          <form action={refreshPayoutStatus} style={{ marginTop: 10 }}>
            <button className="btn btn--secondary" type="submit">Check my status again</button>
          </form>
        )}
      </div>

      <CardNote>
        Stripe holds your bank details, not us. We never ask you to send or
        receive money by Zelle, Venmo or a wire, and a link that did not come
        from us is not from us.
      </CardNote>
    </Card>
  )
}
