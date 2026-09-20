import { Card } from './Shell'
import { chooseOnboardingSlot } from '@/app/actions'

/**
 * Pick a time for the onboarding call, or say you do not need one.
 *
 * Radios rather than a select, because there are three options and all three
 * matter: a maker deciding between two evenings should see both at once, not
 * one at a time behind a tap. It is also the shape that works without
 * JavaScript, which a magic-link portal opened in a mail client's browser
 * genuinely needs.
 *
 * "Not needed" is an option, not an escape from the row. Somebody who does
 * not want a call has answered the question, and the checklist marks it done.
 */
export function CallTimes({
  options, chosen,
}: {
  options: string[]
  chosen: string | null
}) {
  return (
    <Card title="Your onboarding call" id="call" wide>
      <p className="mk-card__lede">
        A short call about how the day runs. Pick whichever suits you, or tell us
        you do not need one.
      </p>
      <form action={chooseOnboardingSlot}>
        <ul className="mk-slots">
          {options.map((o) => (
            <li key={o}>
              <label className="mk-slot">
                <input type="radio" name="slot" value={o} defaultChecked={chosen === o} required />
                <span>{o}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mk-task__do">
          <button className="btn btn--primary" type="submit">
            {chosen ? 'Change my answer' : 'Save my time'}
          </button>
        </p>
      </form>
    </Card>
  )
}
