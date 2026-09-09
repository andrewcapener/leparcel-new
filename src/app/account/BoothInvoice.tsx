import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { payBoothFee } from '@/app/actions'
import type { Invoice } from '@/server/modules/payments/invoice'
import { deadlineMeans, offersCard, offersBank, type PaymentMethods } from '@/server/modules/payments/methods'

/**
 * The one screen an accepted maker actually needs.
 *
 * Until this existed, `decide()` emailed every accepted maker "Pay to confirm
 * within 48 hours" and there was nowhere to pay: /account said their
 * acceptance "carries a payment link" and no such link was ever built. With
 * roughly a hundred acceptances going out between September 22 and 25, that
 * was the gap worth closing before anything else.
 *
 * Every figure is the booking's own snapshot, so what a maker was quoted at
 * acceptance is what they are charged, whatever the show settings say later
 * (CLAUDE.md rule 6). The total is summed from the lines on screen rather than
 * stored beside them, so the rows a maker adds up cannot disagree with the
 * button.
 */
export function BoothInvoice({
  invoice, status, dueAt, paidAt, vendorCode,
  payable, testMode, notice, methods, preview = false, id = 'booth-fee',
}: {
  invoice: Invoice
  status: string
  dueAt: string
  paidAt: string | null
  vendorCode: string
  /** False when Stripe has no key on this deployment. */
  payable: boolean
  testMode: boolean
  notice?: 'paid' | 'unavailable' | 'missing' | 'failed'
  /** The Show's policy. Decides both what Stripe offers and, because ACH does
   *  not settle inside the window, what the deadline is asking for. */
  methods: PaymentMethods
  /** Rendered inside the admin preview. Everything looks the same; the button
   *  is inert, because pressing a real Pay button from a preview would start a
   *  checkout against whatever booking the presser happens to own. */
  preview?: boolean
  /** Unique per instance. The admin preview renders four of these on one page
   *  and four elements sharing an id is invalid HTML that quietly breaks
   *  in-page anchors and confuses a screen reader's landmark list. */
  id?: string
}) {
  const paid = status === 'confirmed'
  const lost = status === 'forfeited' || status === 'cancelled'
  /* Bank transfer authorised, money still moving. Stripe puts ACH settlement
     at about four business days, which is longer than the payment window, so
     this state exists to tell a maker the truth: you have done your part and
     the space is yours while the transfer clears. */
  const inFlight = status === 'payment_processing'

  return (
    <div className="shopify-section section-rich-text" id={id}>
      {/* The theme reveals `data-cc-animate` rows on scroll, which is right on
          a maker's own page and wrong on a preview whose whole job is showing
          four states side by side: they would each start invisible and the
          comparison would be a page of gaps. */}
      <div className="fully-spaced-row--medium" {...(preview ? {} : { 'data-cc-animate': '' })}>
        <div className="container container--reading-width">
          <div className="subheading subheading--over lightish-spaced-row-above">
            {paid
              ? 'Your space is confirmed'
              : inFlight
                ? 'Your transfer is on its way'
                : lost
                  ? 'This space was released'
                  : 'Your booth fee'}
          </div>

          <dl className="fact-table">
            {invoice.lines.map((l) => (
              <div className="fact-table__row" key={l.label}>
                <dt>{l.label}</dt>
                <dd>{usd(l.amountCents)}</dd>
              </div>
            ))}
            <div className="fact-table__row">
              <dt><strong>Total</strong></dt>
              <dd><strong>{usd(invoice.totalCents)}</strong></dd>
            </div>
            <div className="fact-table__row">
              <dt>Your Mermade ID</dt>
              <dd>{vendorCode}</dd>
            </div>
            {paid ? (
              <div className="fact-table__row">
                <dt>Paid</dt>
                <dd>{paidAt ? fmtDateTime(paidAt) : 'Yes'}</dd>
              </div>
            ) : inFlight ? (
              <div className="fact-table__row">
                <dt>Status</dt>
                <dd>Bank transfer sent, clearing now</dd>
              </div>
            ) : lost ? (
              /* No deadline row on a released space. The admin preview caught
                 this: a forfeited booking was still showing a live-looking
                 "Start by" date in the future, under a heading that said "Your
                 booth fee", on a space that is gone. */
              <div className="fact-table__row">
                <dt>Status</dt>
                <dd>Returned to the pool on {fmtDateTime(dueAt)}</dd>
              </div>
            ) : (
              <div className="fact-table__row">
                {/* "Start your transfer by" when bank is the only option: four
                    business days does not fit in the payment window, so
                    labelling it "due" would be asking for something
                    impossible. */}
                <dt>{deadlineMeans(methods) === 'be paid by' ? 'Due' : 'Start by'}</dt>
                <dd>{fmtDateTime(dueAt)}</dd>
              </div>
            )}
          </dl>

          {/* One sentence per state, and never more than one. A maker reading
              this is often reading it on a phone with a deadline running. */}
          {paid && (
            <p className="rte">
              That is everything. Your space is held and you will hear from us next about
              load-in. Nothing else is due before the show.
            </p>
          )}

          {inFlight && (
            <p className="rte">
              We have your bank transfer and your space is held. Transfers take about four
              business days to arrive, so there is nothing more for you to do and the
              deadline does not apply to you any more. We will email you when it lands.
            </p>
          )}

          {lost && (
            <p className="rte">
              This space is no longer held. Write to us if you think that is wrong and we
              will look at it the same day.
            </p>
          )}

          {!paid && !lost && !inFlight && (
            <>
              {notice === 'failed' && (
                <p className="rte"><strong>
                  That did not go through, and nothing was charged. Try again, and if it
                  happens twice write to us rather than trying a third time.
                </strong></p>
              )}
              {notice === 'unavailable' && (
                <p className="rte"><strong>
                  Card payment is not switched on yet. Your space is still held and the
                  deadline will not be held against you.
                </strong></p>
              )}
              {notice === 'missing' && (
                <p className="rte"><strong>
                  We could not find the space to charge for. Write to us and we will sort it.
                </strong></p>
              )}

              {offersCard(methods) && offersBank(methods) && (
                <p className="rte">
                  Pay to confirm. Card or bank transfer, whichever suits you. Bank transfer
                  costs us less, so it is the kinder one on a larger fee, and both confirm
                  the same way.
                </p>
              )}
              {!offersCard(methods) && (
                <p className="rte">
                  Pay by bank transfer to confirm. You will link your bank on the next
                  screen. Transfers take about four business days to arrive, so start yours
                  by {fmtDateTime(dueAt)} and your space is held from the moment you do. You
                  do not have to wait for it to land.
                </p>
              )}
              {!offersBank(methods) && (
                <p className="rte">Pay by card to confirm. It takes a minute.</p>
              )}

              {payable && preview ? (
                <button className="btn btn--primary" type="button" disabled>
                  Pay {usd(invoice.totalCents)}
                </button>
              ) : payable ? (
                <form action={payBoothFee}>
                  <button className="btn btn--primary" type="submit">
                    Pay {usd(invoice.totalCents)}
                  </button>
                </form>
              ) : (
                <p className="rte">
                  The payment page is not live yet. It will be before your deadline, and we
                  will email you the moment it is.
                </p>
              )}

              {testMode && (
                <p className="rte"><strong>
                  Staff note: Stripe is in test mode on this deployment. Nothing here takes
                  real money.
                </strong></p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
