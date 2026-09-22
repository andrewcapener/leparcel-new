import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { emailOutbox } from '@/db/schema'
import { applicationWindow, fmtDate, fmtDateTime } from '@/lib/dates'
import { dripConfig } from '@/server/modules/drip/client'
import { mailPaths, anythingBroadcasts } from '@/server/modules/email/can-send'
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

  /* What could go out, as opposed to what has. The record below is history;
     this is the question somebody actually asks before a roster goes live,
     and it was previously answerable only by reading actions.ts. */
  const show = await activeShow()
  const paths = mailPaths({
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    decisionEmails: show?.decisionEmails ?? 'off',
    paymentEmail: show?.paymentEmail ?? 'off',
    applicationsOpen: show
      ? applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt) === 'open'
      : false,
    dripConfigured: Boolean(dripConfig()),
  })
  const broadcasts = anythingBroadcasts(paths)

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

      {/* The answer to "can this thing email anybody right now", built from
          the same values the sending code reads, so it cannot drift from the
          truth the way a written assurance does. */}
      <div className="adm-sec" id="can-send">
        <h2>What can send an email right now</h2>
        <span className="c">{broadcasts.length} can reach a maker unasked</span>
      </div>

      <p className="adm-note" role="status">
        {broadcasts.length === 0
          ? <>Nothing reaches a maker unless they ask for it themselves. Accepting, declining,
            releasing a space and the whole roster import all send nothing, so every word a maker
            reads tomorrow is one somebody wrote and sent by hand. The one exception is deliberate
            and has to stay: a maker who asks for a sign-in link gets one, because that is the
            door they walk through to pay.</>
          : <><strong>{broadcasts.length} {broadcasts.length === 1 ? 'path' : 'paths'} can mail a
            maker</strong> without anybody choosing it for them. Turn the matching switch off on
            Show settings if that is not what you want.</>}
      </p>

      <table className="adm-tbl">
        <caption className="adm-sr">
          Every message this system can send, who receives it, what sets it off, and whether it
          can go out right now.
        </caption>
        <thead>
          <tr>
            <th scope="col">Message</th>
            <th scope="col">Goes to</th>
            <th scope="col">What sets it off</th>
            <th scope="col">Right now</th>
          </tr>
        </thead>
        <tbody>
          {paths.map((p) => (
            <tr key={p.what}>
              <td><span className="adm-nm">{p.what}</span></td>
              <td>{p.to}</td>
              <td>
                {p.trigger}
                <span className="adm-sub2">
                  {p.sets === 'on its own' ? 'Sends on its own'
                    : p.sets === 'staff press a button' ? 'Only when staff press a button'
                      : 'Only when the person asks for it'}
                </span>
              </td>
              <td>
                {/* In words, never by colour alone (WCAG 2.2 AA). */}
                <span className="adm-st" data-warn={p.armed && p.to === 'the maker' && p.sets !== 'they ask for it' ? '1' : undefined}>
                  {p.armed ? 'Can send' : 'Cannot send'}
                </span>
                <span className="adm-sub2">{p.because}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dripConfig() && (
        <p className="adm-note">
          <strong>One thing outside this list.</strong> A Drip account is connected, so joining the
          waiting list pushes that address to Drip. Whether Drip then writes to them is set in Drip,
          not here, and nothing on this page can see it.
        </p>
      )}

      <div className="adm-sec"><h2>What has been sent</h2></div>

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
