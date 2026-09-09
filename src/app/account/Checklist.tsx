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
 * Deliberately not a progress bar and deliberately not percentages. Three of
 * five ticks is not "sixty percent ready": you are either clear to load in or
 * something is stopping you, and a bar invites somebody to feel finished with
 * a blocker outstanding.
 *
 * State is carried by a word, not by colour alone, so it survives being read
 * by somebody who cannot tell the marks apart (WCAG 2.2 AA, 1.4.1).
 */

const LABEL: Record<ChecklistItem['state'], string> = {
  done: 'Done',
  todo: 'Your turn',
  overdue: 'Overdue',
  waiting: 'Not yet',
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
    <div className="shopify-section section-rich-text" id="checklist">
      <div className="fully-spaced-row--medium" data-cc-animate="">
        <div className="container container--reading-width">
          <div className="subheading subheading--over lightish-spaced-row-above">
            What we need from you
          </div>

          <p className="rte mk-lede">
            {outstanding.length === 0
              ? clear
                ? 'Nothing right now. You are clear to load in, and we will write when there is something to do.'
                : 'Nothing right now. We will write when the next thing opens.'
              : outstanding.length === 1
                ? 'One thing needs you.'
                : `${outstanding.length} things need you.`}
          </p>

          <ul className="mk-check">
            {items.map((i) => (
              <li key={i.key} className="mk-check__row" data-state={i.state}>
                <div className="mk-check__head">
                  <span className="mk-check__title">
                    {i.href && (i.state === 'todo' || i.state === 'overdue')
                      ? <a href={i.href}>{i.title}</a>
                      : i.title}
                  </span>
                  {/* The word, not just the mark. */}
                  <span className="mk-check__state">{LABEL[i.state]}</span>
                </div>
                <p className="mk-check__detail">{i.detail}</p>
                {i.dueAt && i.state !== 'done' && i.state !== 'waiting' && (
                  <p className="mk-check__due">
                    {/* A booth fee is due at an hour; load-in is a day. Showing
                        a time on a date nobody set would be inventing precision. */}
                    {i.key === 'fee'
                      ? feeDeadlineIsStart
                        ? <>Start by {fmtDateTime(i.dueAt)}</>
                        : <>By {fmtDateTime(i.dueAt)}</>
                      : <>Before load-in, {fmtDate(i.dueAt)}</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
