import type { ManualOption } from '@/server/modules/payments/manual'
import { sayManualSent } from '@/app/actions'

/**
 * Venmo and Zelle, on the booking's own page.
 *
 * Never in an email, and never on a page that is not this maker's own link.
 * A handle pasted into a message is indistinguishable from a handle pasted
 * into a message by somebody pretending to be Mermade, and that is the whole
 * reason this component exists here rather than in the email templates.
 *
 * Two things it has to get across without nagging.
 *
 * These payments are NOT instant from our side. Card and bank transfer confirm
 * themselves; this one waits for a person to see it and tick it off. A maker
 * who pays this way and then watches their page say "unpaid" for a day will
 * write in, so the page says so first.
 *
 * And the note matters. It is prefilled on the Venmo link and spelled out for
 * Zelle, because a payment that arrives with no code is a payment somebody has
 * to go hunting for.
 */
export function ManualPay({
  options, codes, token, saidVia, saidAt,
}: {
  options: ManualOption[]
  /** Present only on the pasted-link door, which is the one that can
   *  authorise "I have sent it" without a sign-in. */
  token?: string
  /** What they already told us, so the tile stops asking. */
  saidVia?: string | null
  saidAt?: string | null
  /** A scannable code per method, for somebody reading this on a laptop.
   *  Hidden on a phone, where you cannot scan your own screen. */
  codes?: Record<string, string | null>
}) {
  if (options.length === 0) return null

  return (
    <>
        {options.map((o) => (
        <li className="mk-pay" key={o.kind}>
            {o.kind === 'venmo' ? (
              <>
                <p className="mk-pay__who">Venmo <strong>{o.handle}</strong></p>
                {/* The link fills in the amount and the note. The handle is
                    written out above it on purpose: deep-link parameters are
                    not a promise Venmo makes, so if a future app build ignores
                    them the maker can still see exactly who to pay. */}
                <a className="btn btn--secondary" href={o.url} rel="noopener noreferrer">
                  Open Venmo
                </a>

              </>
            ) : (
              <>
                <p className="mk-pay__who">Zelle to <strong>{o.contact}</strong></p>
                {/* No button, and not an oversight: Zelle lives inside each
                    bank's own app and has no web handoff to tap through to.
                    The code below is the shortcut, and only on a screen the
                    maker is not holding. */}
                <p className="mk-pay__how">
                  Send it from your own bank app, to the number above. Type in
                  the total yourself: a Zelle code carries who to pay and
                  nothing else.
                </p>
              </>
            )}
            {codes?.[o.kind] && (
              <span className="mk-pay__qr">
                {/* Generated, never the market's own profile or bank code.
                    Venmo's carries the amount and the MM note, which a profile
                    code does not; Zelle's is byte for byte what their bank
                    produces, because that format holds only the recipient. */}
                {/* The alt text says what the code DOES, not who it belongs
                    to. It used to read "Venmo code for MM91", which is the
                    one reading an outdoor maker must not be given: their
                    booth number comes from somewhere else entirely. The code
                    itself is still written out below, in the note. */}
                <img src={codes[o.kind]!} width={132} height={132}
                  alt={o.kind === 'venmo'
                    ? `Venmo code for your booth fee. Scan it to open Venmo with the amount and the note ${o.note} filled in.`
                    : `Zelle code for Mermade Market. Scan it in your banking app, then type the total.`} />
                <small>{o.kind === 'venmo' ? 'Or scan with your phone' : 'Or scan in your banking app'}</small>
              </span>
            )}
            <p className="mk-pay__note">Note: <code>{o.note}</code></p>
            {/* The one fact only the maker has, at the only moment she will
                give it. Without it a maker who paid on Tuesday and a maker who
                has not paid look identical on the roster, and the girls either
                chase her or release her space. It confirms nothing on its own:
                a person still checks Venmo and presses Mark paid. */}
            {token && (saidVia === o.kind ? (
              <p className="mk-pay__said">
                Thank you. You told us you sent this
                {saidAt ? ` on ${new Date(saidAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric' })}` : ''}.
                We will match it and your space is held meanwhile.
              </p>
            ) : (
              <form action={sayManualSent}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="via" value={o.kind} />
                <button className="mk-pay__sent" type="submit">
                  I have sent it
                </button>
              </form>
            ))}
          </li>
        ))}
    </>
  )
}
