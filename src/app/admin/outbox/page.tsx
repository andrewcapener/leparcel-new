import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { PageHead, Stats, Stat } from '../ui'
import { Icon } from '../Icon'

export const dynamic = 'force-dynamic'

const LIMIT = 50
const COLS = 6

/** `application_received` reads as "Application received" to a person. */
const kindOf = (t: string) => {
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * "Sep 5, 10:04 AM" → "10:04 AM". The day is the heading over the run, so
 * the row only carries the time. Derived from fmtDateTime rather than a new
 * formatter so the Pacific conversion stays in one place (CLAUDE.md rule 8).
 */
const timeOf = (iso: string) => {
  const parts = fmtDateTime(iso).split(', ')
  return parts.length > 1 ? parts.slice(1).join(', ') : parts[0]
}

/**
 * The record of every message the system has sent. Grouped by the day it went
 * out and scannable across time, kind, recipient and subject, with the body
 * opening in place so checking what a maker actually received never costs a
 * page load. Same expanding row as the review queue: a checkbox and a CSS
 * `:has()` rule, so it works with JavaScript off.
 */
export default async function Outbox() {
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.sentAt)).limit(LIMIT)

  const count = (s: string) => mails.filter((m) => m.deliveryStatus === s).length
  const failed = count('failed')

  const kinds = [...new Set(mails.map((m) => m.template))]
    .map((t) => ({ t, n: mails.filter((m) => m.template === t).length }))
    .sort((a, b) => b.n - a.n)

  const days = new Set(mails.map((m) => fmtDate(m.sentAt)))
  let openDay = ''

  return (
    <>
      <PageHead
        title="Outbox"
        sub={`${mails.length} ${mails.length === 1 ? 'message' : 'messages'} · the last ${LIMIT}, newest first · times are Pacific`}
      />

      <p className="adm-note">
        Every message the system sends, exactly as the maker receives it. Delivery runs through
        Resend when RESEND_API_KEY is set. &ldquo;Logged&rdquo; means the message was recorded but
        sending is not configured. Open a row to read the body.
      </p>

      {mails.length === 0 ? (
        <p className="adm-empty">
          Nothing sent yet. Accept or decline someone in the review queue and the message lands
          here.
        </p>
      ) : (
        <>
          <Stats>
            <Stat
              label="Messages" icon="mail" value={mails.length}
              note={`Across ${days.size} ${days.size === 1 ? 'day' : 'days'}.`}
            />
            <Stat label="Delivered" icon="external" value={count('sent')} note="Accepted by Resend." />
            <Stat
              label="Logged only" icon="roster" value={count('logged')}
              note="Recorded here, not sent. No API key set."
            />
            <Stat
              label="Failed" icon="shield" value={failed} warn={failed > 0}
              note="Open the row for what came back."
            />
          </Stats>

          <div className="adm-strip">
            <span className="g">
              <span className="k">By kind</span>
              {kinds.map((k) => (
                <span key={k.t} className="adm-tag">{kindOf(k.t)} {k.n}</span>
              ))}
            </span>
          </div>

          <div className="adm-sec">
            <h2>Messages</h2>
            <span className="c">{mails.length} of the last {LIMIT}</span>
          </div>

          <table className="adm-tbl">
            <caption className="adm-sr">
              Every message sent, newest first, grouped by the day it went out. Each row expands
              to the body of the message.
            </caption>
            <thead>
              <tr>
                <th scope="col">Sent</th>
                <th scope="col" className="c-1">Kind</th>
                <th scope="col">To</th>
                <th scope="col" className="c-2">Subject</th>
                <th scope="col" className="c-1">Delivery</th>
                <th scope="col" className="r"><span className="adm-sr">Expand</span></th>
              </tr>
            </thead>

            {mails.map((m) => {
              const day = fmtDate(m.sentAt)
              const starts = day !== openDay
              if (starts) openDay = day
              return (
                <tbody key={m.id}>
                  {starts && (
                    <tr className="grp">
                      <th scope="colgroup" colSpan={COLS}>
                        {day}
                        <span className="c">
                          {mails.filter((x) => fmtDate(x.sentAt) === day).length} sent
                        </span>
                      </th>
                    </tr>
                  )}
                  <tr>
                    <td><span className="mono">{timeOf(m.sentAt)}</span></td>
                    <td className="c-1"><span className="adm-tag">{kindOf(m.template)}</span></td>
                    <td><span className="mono">{m.toEmail}</span></td>
                    <td className="c-2"><span className="adm-nm">{m.subject}</span></td>
                    <td className="c-1">
                      <span className="adm-st" data-warn={m.deliveryStatus === 'failed' ? '1' : undefined}>
                        {m.deliveryStatus === 'logged' ? 'Logged' : m.deliveryStatus}
                      </span>
                    </td>
                    <td className="r">
                      <label className="adm-exp">
                        <input type="checkbox" />
                        <Icon name="chevron" size={16} />
                        <span className="adm-sr">
                          Read the message sent to {m.toEmail}, {m.subject}
                        </span>
                      </label>
                    </td>
                  </tr>
                  <tr className="adm-more">
                    <td colSpan={COLS}>
                      <p className="adm-nm">{m.subject}</p>
                      <p className="adm-sub2">
                        {m.toEmail} · {fmtDateTime(m.sentAt)} · {kindOf(m.template)}
                      </p>
                      {m.deliveryDetail && (
                        <p className="adm-note" style={{ color: 'var(--ad-warn)', margin: '12px 0 0' }}>
                          {m.deliveryDetail}
                        </p>
                      )}
                      <pre className="adm-pre">{m.body}</pre>
                    </td>
                  </tr>
                </tbody>
              )
            })}
          </table>

          <div className="adm-foot">
            <p className="adm-note">
              The row is written whether or not sending is configured, so this is the audit trail
              even on a machine with no key. Nothing here is editable and nothing is deleted.
            </p>
            <p className="adm-note">
              Times are Pacific. The list holds the last {LIMIT} messages, newest first.
            </p>
          </div>
        </>
      )}
    </>
  )
}
