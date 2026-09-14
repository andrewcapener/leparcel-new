import { fmtDateTime, fmtDate } from '@/lib/dates'
import type { ChecklistItem } from '@/server/modules/compliance/checklist'

/**
 * What we need from you, and where each thing stands.
 *
 * The first thing on a maker's dashboard, because it answers the question
 * they actually arrived with. Before this, /account showed what they owed and
 * nothing about what else was coming, so every other requirement turned up
 * later as an email about a deadline they had half missed.
 *
 * Now a task list rather than a paragraph list: a marker, the state as a
 * word, the date, and a button that does the thing. Drew, 14 September, asked
 * for "a checklist of stuff they need to do, kind of a task list", and the
 * version before this described each task without ever offering a way to do
 * it, which for insurance and the seller's permit meant composing an email
 * from scratch.
 *
 * Deliberately not a progress bar and deliberately not percentages. Three of
 * five ticks is not "sixty percent ready": you are either clear to load in or
 * something is stopping you, and a bar invites somebody to feel finished with
 * a blocker outstanding.
 *
 * State is carried by a word AND by the marker's shape, not by colour alone,
 * so it survives being read by somebody who cannot tell the marks apart
 * (WCAG 2.2 AA, 1.4.1).
 */

const LABEL: Record<ChecklistItem['state'], string> = {
  done: 'Done',
  todo: 'Your turn',
  overdue: 'Overdue',
  waiting: 'Not yet',
}

/* The glyph inside the marker. Empty for the two unfilled states, whose ring
   (solid for todo, dashed for not yet) is the difference. */
const MARK: Record<ChecklistItem['state'], string> = {
  done: '✓',
  overdue: '!',
  todo: '',
  waiting: '',
}

export function Checklist({
  items, clear, feeDeadlineIsStart = false,
}: {
  items: ChecklistItem[]
  clear: boolean
  /** Bank transfer only: the booth fee date is a date to START by, and the
   *  invoice below already says so. Two labels for one date on one page is
   *  exactly the kind of thing a maker writes in about. */
  feeDeadlineIsStart?: boolean
}) {
  const outstanding = items.filter((i) => i.state === 'todo' || i.state === 'overdue')

  return (
    <>
      {outstanding.length === 0 ? (
        clear ? (
          <p className="mk-clear">
            You are clear to load in. We will write when there is something to do.
          </p>
        ) : (
          <p className="mk-card__lede">Nothing needs you right now. We will write when the next thing opens.</p>
        )
      ) : (
        <p className="mk-card__lede">
          {outstanding.length === 1 ? 'One thing needs you.' : `${outstanding.length} things need you.`}
        </p>
      )}

      <ul className="mk-tasks">
        {items.map((i) => (
          <li key={i.key} className="mk-task" data-state={i.state}>
            {/* The marker is decoration: the state is already a word in the
                chip, so announcing the glyph too would read it twice. */}
            <span className="mk-task__mark" aria-hidden="true">{MARK[i.state]}</span>
            <div className="mk-task__head">
              <span className="mk-task__title">{i.title}</span>
              <span className="mk-task__chip">{LABEL[i.state]}</span>
            </div>
            <div className="mk-task__body">
              <p className="mk-task__detail">{i.detail}</p>
              {i.dueAt && i.state !== 'done' && i.state !== 'waiting' && (
                <p className="mk-task__due">
                  {/* A booth fee is due at an hour; load-in is a day. Showing
                      a time on a date nobody set would invent precision. */}
                  {i.key === 'fee'
                    ? feeDeadlineIsStart
                      ? <>Start by {fmtDateTime(i.dueAt)}</>
                      : <>By {fmtDateTime(i.dueAt)}</>
                    : <>Before load-in, {fmtDate(i.dueAt)}</>}
                </p>
              )}
              {i.action && (
                <p className="mk-task__do">
                  <a className="btn btn--primary" href={i.action.href}>{i.action.label}</a>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
