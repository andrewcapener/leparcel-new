import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { payBoothFee } from '@/app/actions'
import type { Invoice } from '@/server/modules/payments/invoice'
import { deadlineMeans, offersCard, offersBank, type PaymentMethods } from '@/server/modules/payments/methods'
import type { ManualOption } from '@/server/modules/payments/manual'
import { ManualPay } from './ManualPay'

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
  action, token, manual = [], codes, manualToken, saidVia, saidAt,
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
  /** Venmo and Zelle, shown BESIDE the card button rather than in a card of
   *  their own further down. Drew, 22 Sept: the maker was reading two separate
   *  offers and had to work out they were alternatives. They are one question
   *  with three answers, so they belong in one row. */
  manual?: ManualOption[]
  codes?: Record<string, string | null>
  /** Only the pasted-link door can take "I have sent it" without a sign-in. */
  manualToken?: string
  saidVia?: string | null
  saidAt?: string | null
  /** Rendered inside the admin preview. Everything looks the same; the button
   *  is inert, because pressing a real Pay button from a preview would start a
   *  checkout against whatever booking the presser happens to own. */
  preview?: boolean
  /** Unique per instance. The admin preview renders four of these on one page
   *  and four elements sharing an id is invalid HTML that quietly breaks
   *  in-page anchors and confuses a screen reader's landmark list. */
  id?: string
  /** Which door this invoice was opened through. The portal leaves this unset
   *  and pays as the signed-in maker; /pay/<token> passes payByToken, because
   *  under manual acceptance there is no email from us to sign in through and
   *  the link has to work for whoever staff sent it to. */
  action?: (fd: FormData) => Promise<void>
  token?: string
}) {
  const paid = status === 'confirmed'
  const lost = status === 'forfeited' || status === 'cancelled'
  /* Bank transfer authorised, money still moving. Stripe puts ACH settlement
     at about four business days, which is longer than the payment window, so
     this state exists to tell a maker the truth: you have done your part and
     the space is yours while the transfer clears. */
  const inFlight = status === 'payment_processing'
  /* A fee of nothing, which is a real case: Hillary carries credits from a
     cancelled show, and one maker's covers the whole booth. Stripe will not
     take a $0 payment (its minimum is fifty cents), so a Pay button here is a
     button that can only fail. The maker is told there is nothing owed and
     staff confirm the space from the roster. */
  const nothingDue = invoice.totalCents === 0

  /* A card on the account's own ground, not one of the theme's full-bleed
     marketing sections. The page is a dashboard; its sections are objects on
     a surface, and the reveal-on-scroll the theme applies to a rich-text row
     left half this page parked at opacity zero in anything but a human
     scrolling it. */
  return (
    <section className="mk-card mk-grid__wide" id={id}>
      <h2 className="mk-card__title">
            {paid
              ? 'Your space is confirmed'
              : inFlight
                ? 'Your transfer is on its way'
                : lost
                  ? 'This space was released'
                  : nothingDue
                    ? 'Nothing to pay'
                    : 'Your booth fee'}
          </h2>

          <dl className="mk-dl">
            {invoice.lines.map((l) => (
              <div className="mk-dl__row" key={l.label}>
                <dt>{l.label}</dt>
                <dd>{usd(l.amountCents)}</dd>
              </div>
            ))}
            <div className="mk-dl__row">
              <dt><strong>Total</strong></dt>
              <dd><strong>{usd(invoice.totalCents)}</strong></dd>
            </div>
            <div className="mk-dl__row">
              <dt>Your Mermade ID</dt>
              <dd>{vendorCode}</dd>
            </div>
            {paid ? (
              <div className="mk-dl__row">
                <dt>Paid</dt>
                <dd>{paidAt ? fmtDateTime(paidAt) : 'Yes'}</dd>
              </div>
            ) : inFlight ? (
              <div className="mk-dl__row">
                <dt>Status</dt>
                <dd>Bank transfer sent, clearing now</dd>
              </div>
            ) : lost ? (
              /* No deadline row on a released space. The admin preview caught
                 this: a forfeited booking was still showing a live-looking
                 "Start by" date in the future, under a heading that said "Your
                 booth fee", on a space that is gone. */
              <div className="mk-dl__row">
                <dt>Status</dt>
                <dd>Returned to the pool on {fmtDateTime(dueAt)}</dd>
              </div>
            ) : (
              <div className="mk-dl__row">
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

              {/* Both on the table. This has to say two true things at once:
                  either method confirms the space, and only one of them is
                  instant. Without the second sentence a maker who picks the
                  bank reads "Due <date>" above, knows a transfer takes days,
                  and either panics or reaches for a card we are paying 2.9%
                  on. Saying it plainly is worth real money as well as being
                  the honest version. */}
              {/* Nothing owed. Said plainly, and with no control at all: a
                  disabled button invites somebody to keep pressing it, and a
                  live one would hand them a Stripe error. */}
              {nothingDue && (
                <p className="rte">
                  Your fee is covered in full, so there is nothing to pay. We will
                  confirm your space from our side and you will hear from us next
                  about load-in. If that looks wrong to you, tell us before the show.
                </p>
              )}

              {!nothingDue && offersCard(methods) && offersBank(methods) && (
                <p className="rte">
                  Pay to confirm. Card or bank transfer, whichever suits you. Bank transfer
                  costs us less, so it is the kinder one on a larger fee, and both confirm
                  the same way. A transfer takes about four business days to arrive, and
                  that is fine: start yours by {fmtDateTime(dueAt)} and your space is held
                  from the moment you do, not from the day it lands.
                </p>
              )}
              {!nothingDue && !offersCard(methods) && (
                <p className="rte">
                  Pay by bank transfer to confirm. You will link your bank on the next
                  screen. Transfers take about four business days to arrive, so start yours
                  by {fmtDateTime(dueAt)} and your space is held from the moment you do. You
                  do not have to wait for it to land.
                </p>
              )}
              {!nothingDue && !offersBank(methods) && (
                <p className="rte">Pay by card to confirm. It takes a minute.</p>
              )}

              {/* One question, three answers, in one row. The card button
                  used to sit here and Venmo and Zelle in a separate card
                  further down the page, which made a maker read two offers and
                  work out for herself that they were alternatives. */}
              {!nothingDue && (
                <ul className="mk-ways">
                  <li className="mk-pay mk-pay--now">
                    <p className="mk-pay__who">
                      <strong>{offersCard(methods) ? 'Card or bank transfer' : 'Bank transfer'}</strong>
                    </p>
                    {payable && preview ? (
                      <button className="btn btn--primary" type="button" disabled>
                        Pay {usd(invoice.totalCents)}
                      </button>
                    ) : payable ? (
                      <form action={action ?? payBoothFee}>
                        {token && <input type="hidden" name="token" value={token} />}
                        <button className="btn btn--primary" type="submit">
                          Pay {usd(invoice.totalCents)}
                        </button>
                      </form>
                    ) : (
                      <p className="mk-pay__how">
                        Not live yet. It will be before your deadline, and we will
                        write to you the moment it is.
                      </p>
                    )}
                    <p className="mk-pay__note">Confirms your space straight away.</p>
                  </li>
                  <ManualPay options={manual} vendorCode={vendorCode} codes={codes}
                    token={manualToken} saidVia={saidVia} saidAt={saidAt} />
                </ul>
              )}

              {!nothingDue && manual.length > 0 && (
                <p className="mk-card__note">
                  Venmo and Zelle are checked by a person rather than confirmed
                  automatically, so your page may still say unpaid for a day after
                  you send it. That is fine and your space is held. We only ever
                  show these here, on your own link: if you get an email asking you
                  to Venmo somebody, it is not us.
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
    </section>
  )
}
