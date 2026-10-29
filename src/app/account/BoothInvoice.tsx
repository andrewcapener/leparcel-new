import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { payBoothFee } from '@/app/actions'
import type { Invoice } from '@/server/modules/payments/invoice'
import { deadlineMeans, offersCard, offersBank, type PaymentMethods } from '@/server/modules/payments/methods'
import type { ManualOption } from '@/server/modules/payments/manual'
import { vendorCodeWords, vendorCodeLine } from '@/server/modules/payments/vendor-code'
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
/** The invoice table, folded away once there is nothing left to pay. */
function Detail({ paid, children }: { paid: boolean; children: React.ReactNode }) {
  if (!paid) return <>{children}</>
  return (
    <details className="mk-receipt">
      <summary>What you paid for</summary>
      {children}
    </details>
  )
}

export function BoothInvoice({
  invoice, status, dueAt, paidAt, vendorCode, track,
  payable, testMode, notice, methods, preview = false, id = 'booth-fee',
  action, token, manual = [], codes, manualToken, signedIn = false, saidVia, saidAt,
}: {
  invoice: Invoice
  status: string
  dueAt: string
  paidAt: string | null
  vendorCode: string
  /** The BOOKED space's track, not the application's. It decides what the MM
   *  code is called: an indoor maker's Mermade ID is an outdoor maker's
   *  payment reference, and calling it an ID outdoors reads as a booth
   *  number. See payments/vendor-code.ts. */
  track?: string
  /** False when Stripe has no key on this deployment. */
  payable: boolean
  testMode: boolean
  notice?: 'paid' | 'unavailable' | 'missing' | 'failed' | 'released'
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
  /** True on the maker's own signed-in account page, where the session is the
   *  authority instead of a token. */
  signedIn?: boolean
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
  /* What is still outstanding, which is not the same question as the status.
     A booking that was paid and then grew a second day is confirmed AND owes
     $350, and both have to be true on this page at once. Reading "confirmed"
     as "has paid" is what left a maker looking at a line on her invoice with
     no way to settle it. */
  const owes = invoice.amountDueCents > 0
  const paid = status === 'confirmed' && !owes
  /* Paid once, and something has been added since. She keeps her space and
     the page still has to ask her for the difference. */
  const owesMore = status === 'confirmed' && owes
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
  const nothingDue = invoice.amountDueCents === 0 && invoice.totalCents === 0

  /* The maker pressed "I have sent it" on a Venmo or a Zelle.
     
     Drew, 29 October: "in my dashboard I told the team that I paid via venmo
     and the prompt to pay my booth fee is still there." It was. The claim
     reached the roster, and isForfeitable has honoured it since the day it
     shipped, so the one place it changed nothing was the page of the person
     who made it. She told us, and we carried on asking.
     
     Deliberately NOT folded into `paid`. Nobody has checked Venmo yet, and a
     page that says "confirmed" on a claim we have not matched is this app
     telling a maker something it does not know. The state worth having sits
     between the two: stop asking, say what happens next, and leave the other
     ways one tap away in case they meant to pay by card. */
  const said = Boolean(saidAt) && !paid && !owesMore && !lost && !inFlight && !nothingDue

  /* What to call the code, and the one line under it. Indoor keeps "Your
     Mermade ID"; outdoor is told it is a payment reference and not a booth
     number, because outdoor booths are numbered by a separate hand and an
     "ID" of MM91 reads as space 91. */
  const code = vendorCodeWords(track)
  const codeLine = vendorCodeLine(code, !paid && !said && !lost && !inFlight && !nothingDue)

  /* A card on the account's own ground, not one of the theme's full-bleed
     marketing sections. The page is a dashboard; its sections are objects on
     a surface, and the reveal-on-scroll the theme applies to a rich-text row
     left half this page parked at opacity zero in anything but a human
     scrolling it. */
  /* The payment options, named once so they can be rendered in two places:
     out in the open on an unpaid invoice, and behind a disclosure once the
     maker has told us a Venmo is on its way. */
  const ways = (
    <>
                {!nothingDue && (
                  <ul className="mk-ways">
                    <li className="mk-pay mk-pay--now">
                      <p className="mk-pay__who">
                        <strong>{offersCard(methods) ? 'Card or bank transfer' : 'Bank transfer'}</strong>
                      </p>
                      {payable && preview ? (
                        <button className="btn btn--primary" type="button" disabled>
                          Pay {usd(invoice.amountDueCents)}
                        </button>
                      ) : payable ? (
                        <form action={action ?? payBoothFee}>
                          {token && <input type="hidden" name="token" value={token} />}
                          <button className="btn btn--primary" type="submit">
                            Pay {usd(invoice.amountDueCents)}
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
                    <ManualPay options={manual} codes={codes}
                      token={manualToken} signedIn={signedIn}
                      saidVia={saidVia} saidAt={saidAt} />
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
    </>
  )

  return (
    <section className="mk-card mk-grid__wide" id={id}>
      <h2 className="mk-card__title">
            {paid
              ? 'Your space is confirmed'
              : owesMore
                ? 'There is more to pay'
              : inFlight
                ? 'Your transfer is on its way'
                : lost
                  ? 'This space was released'
                  : nothingDue
                    ? 'Nothing to pay'
                    : said
                      ? 'We are matching your payment'
                      : 'Your booth fee'}
          </h2>

          {/* Once it is paid this is a receipt, not an invoice, and it is
              sitting above the two things that still need the maker. So it
              folds down to one line and the detail stays one tap away.
              Drew, 28 October: "if a person has paid their booth fee lets
              remove the payment info there". */}
          {paid && (
            <p className="rte">
              <strong>{usd(invoice.totalCents)} paid{paidAt ? ` on ${fmtDateTime(paidAt)}` : ''}.</strong>
              {' '}{code.label} {vendorCode}.
            </p>
          )}

          <Detail paid={paid || said}>
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
            {/* Only once they differ. On an ordinary unpaid invoice the total
                IS what is owed, and saying it twice reads as two charges. */}
            {invoice.paidCents > 0 && invoice.paidCents !== invoice.totalCents && (
              <>
                <div className="mk-dl__row">
                  <dt>Already paid</dt>
                  <dd>{usd(invoice.paidCents)}</dd>
                </div>
                <div className="mk-dl__row">
                  <dt><strong>Left to pay</strong></dt>
                  <dd><strong>{usd(invoice.amountDueCents)}</strong></dd>
                </div>
              </>
            )}
            <div className="mk-dl__row">
              <dt>{code.label}</dt>
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
          </Detail>

          {/* The one line under the code. Outdoor makers are given a booth
              number by a different person and on a different list, so this is
              where they are told this is not it. */}
          {codeLine && <p className="mk-card__note">{codeLine}</p>}

          {/* One sentence per state, and never more than one. A maker reading
              this is often reading it on a phone with a deadline running. */}
          {paid && (
            <p className="rte">
              That is everything. Your space is held and you will hear from us next about
              load-in. Nothing else is due before the show.
            </p>
          )}

          {owesMore && (
            <p className="rte">
              Your space is held and what you have already paid is on this invoice. Since
              then {invoice.lines.length > 1 ? 'something has been added' : 'the amount has changed'},
              so there is {usd(invoice.amountDueCents)} left. You are only being asked for
              the difference, never the whole fee again.
            </p>
          )}

          {inFlight && (
            <p className="rte">
              We have your bank transfer and your space is held. Transfers take about four
              business days to arrive, so there is nothing more for you to do and the
              deadline does not apply to you any more. We will email you when it lands.
            </p>
          )}

          {/* What they told us, back in their own terms, with the one fact
              they care about: the deadline is off them. A person checks the
              account against the note and presses Mark paid, usually the same
              day, and this page will say confirmed when they do. */}
          {said && (
            <p className="rte">
              Thank you. You told us you sent {saidVia === 'zelle' ? 'a Zelle' : 'a Venmo'}
              {saidAt ? ` on ${fmtDateTime(saidAt)}` : ''}, for {usd(invoice.amountDueCents)},
              with <strong>{vendorCode}</strong> in the note. One of us checks it against
              that note and confirms your space, usually the same day. Your space is held
              meanwhile and the deadline is not held against you, so there is nothing more
              for you to do. If you have not sent it yet, you can still pay below.
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

              {/* The link outlives the booking: it sits in an inbox forever,
                  and a space can be released after it was sent. Say so plainly
                  rather than showing a payment failure, which would read as
                  their card being declined. */}
              {notice === 'released' && (
                <p className="rte"><strong>
                  This space is no longer held, so there is nothing to pay. If that is a
                  surprise, write to us and we will explain what happened.
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

              {!nothingDue && !said && offersCard(methods) && offersBank(methods) && (
                <p className="rte">
                  Pay to confirm. Card or bank transfer, whichever suits you. Bank transfer
                  costs us less, so it is the kinder one on a larger fee, and both confirm
                  the same way. A transfer takes about four business days to arrive, and
                  that is fine: start yours by {fmtDateTime(dueAt)} and your space is held
                  from the moment you do, not from the day it lands.
                </p>
              )}
              {!nothingDue && !said && !offersCard(methods) && (
                <p className="rte">
                  Pay by bank transfer to confirm. You will link your bank on the next
                  screen. Transfers take about four business days to arrive, so start yours
                  by {fmtDateTime(dueAt)} and your space is held from the moment you do. You
                  do not have to wait for it to land.
                </p>
              )}
              {!nothingDue && !said && !offersBank(methods) && (
                <p className="rte">Pay by card to confirm. It takes a minute.</p>
              )}

              {/* One question, three answers, in one row. The card button
                  used to sit here and Venmo and Zelle in a separate card
                  further down the page, which made a maker read two offers and
                  work out for herself that they were alternatives. */}
              {/* Still reachable after "I have sent it", because that is a
                  claim and occasionally a mistaken one: somebody taps Venmo,
                  thinks better of it and reaches for a card. Collapsed rather
                  than removed, so the page stops asking without taking the
                  answer away. */}
              {!nothingDue && (said ? (
                <details className="mk-receipt">
                  <summary>Pay a different way</summary>
                  {ways}
                </details>
              ) : ways)}

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
