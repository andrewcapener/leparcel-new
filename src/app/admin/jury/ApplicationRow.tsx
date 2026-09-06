import Link from 'next/link'
import { decide } from '@/app/actions'
import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { Icon } from '../Icon'
import type { Application, ApplicationStatus, Vendor } from '@/db/schema'

/** The JSON columns hold arrays of strings. A row written by hand, or by a
 *  deploy that is one migration ahead, must never take the queue down. */
function list(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

const MADE_BY: Record<string, string> = {
  all: 'Makes everything',
  mostly_sourced_components: 'Mostly, with sourced components',
  curate_resell: 'Curates and resells',
}

/** Every column the row can draw, so the header and the two rows agree. */
export const JURY_COLS = 9

/**
 * One application, as two rows of a real table.
 *
 * A queue that ran to a hundred cards ran to several screens of scrolling,
 * and the season it is being built for expects hundreds. So the queue is a
 * table: a 48px thumbnail for identification, the shop name over its email
 * in mono, and the four facts a juror sorts on.
 *
 * The obvious objection is that nobody judges craft at 48px. The answer is
 * the chevron: expanding a row in place drops the rest of the photo roll and
 * the maker's own words underneath it, so the work can be looked at without
 * leaving the queue or losing your place in it. It is a checkbox and a CSS
 * `:has()` rule, so it works with JavaScript off, and a browser without
 * `:has()` simply renders every row expanded rather than trapping anything.
 *
 * Deciding still happens on the review screen, where the photographs are
 * full size. The one control here is the shortlist toggle, which is triage,
 * not a decision, and only appears while the decision is still open.
 */
export function ApplicationRow({
  app, vendor, from,
}: {
  app: Application
  vendor: Vendor
  /** The queue this row was opened from, so the review screen can page
   *  through the same list without sending the juror back here. */
  from: string
}) {
  const photos = list(app.photos)
  const secondary = list(app.secondaryCategories)
  const shortlisted = app.status === 'shortlist'

  /* Triage belongs to the undecided states. An accepted maker has a booking,
     a maker code and an invoice in their inbox, and none of that should be
     one stray click from being undone on a list. */
  const triage = app.status === 'new' || app.status === 'under_review' || shortlisted

  /* Curation flags only. Missing paperwork is deliberately NOT shown to the
     jury: it has no bearing on whether the work is good. Compliance is
     enforced on the roster, after acceptance. */
  const flags = [
    app.isMlm && 'MLM',
    app.usesAiArtwork && 'AI artwork',
    app.madeByYou === 'curate_resell' && 'Resells',
    vendor.isFlagged && 'Flagged',
  ].filter((f): f is string => Boolean(f))

  const where = [vendor.city, vendor.state].filter(Boolean).join(', ')

  return (
    <tbody>
      <tr>
        <td>
          {photos[0] === undefined ? (
            <span className="adm-thumb-none" aria-hidden="true">no</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="adm-thumb" src={photos[0]} alt="" loading="lazy" decoding="async" />
          )}
        </td>

        <td>
          <Link className="adm-nm" href={`/admin/applications/${app.id}?from=${from}`}>
            {vendor.shopName}
          </Link>
          <span className="adm-sub2">
            {vendor.email}
            {where && <><br />{where}{vendor.instagram && ` · ${vendor.instagram}`}</>}
          </span>
        </td>

        <td className="c-1">
          {app.category}
          {secondary.length > 0 && (
            <span className="adm-sub2">plus {secondary.join(', ').toLowerCase()}</span>
          )}
        </td>

        <td className="c-2"><span className="adm-tag">{app.track}</span></td>

        <td className="r c-2">
          <span className="mono">{usd(app.priceLowCents)}&ndash;{usd(app.priceHighCents)}</span>
        </td>

        <td className="c-3">
          {flags.length === 0 && vendor.showsAttended === 0 ? (
            <span className="mono" aria-hidden="true">&ndash;</span>
          ) : (
            <span className="adm-tags">
              {vendor.showsAttended > 0 && (
                <span className="adm-tag">Repeat {vendor.showsAttended}</span>
              )}
              {flags.map((f) => <span key={f} className="adm-tag" data-warn="1">{f}</span>)}
            </span>
          )}
        </td>

        <td className="c-1">
          <span className="adm-st">{LABEL[app.status as ApplicationStatus] ?? app.status}</span>
          {app.decidedAt && <span className="adm-sub2">{fmtDateTime(app.decidedAt)}</span>}
        </td>

        <td className="r">
          {triage && (
            <form action={decide}>
              <input type="hidden" name="applicationId" value={app.id} />
              <input type="hidden" name="status" value={shortlisted ? 'under_review' : 'shortlist'} />
              <button className="adm-btn-q" type="submit" data-on={shortlisted ? '1' : undefined}>
                {shortlisted ? 'Shortlisted' : 'Shortlist'}
                <span className="adm-sr">
                  {shortlisted ? `, take ${vendor.shopName} off the shortlist` : ` ${vendor.shopName}`}
                </span>
              </button>
            </form>
          )}
        </td>

        <td className="r">
          <label className="adm-exp">
            <input type="checkbox" />
            <Icon name="chevron" size={16} />
            <span className="adm-sr">
              Show the work and the description from {vendor.shopName}
            </span>
          </label>
        </td>
      </tr>

      <tr className="adm-more">
        <td colSpan={JURY_COLS}>
          <div className="adm-more-in">
            <div>
              <p className="k">In their words</p>
              <p className="adm-quote" style={{ marginTop: 10 }}>{app.description}</p>
              <table className="adm-fx" style={{ marginTop: 18 }}>
                <tbody>
                  <tr>
                    <th scope="row">Made by them</th>
                    <td>{MADE_BY[app.madeByYou] ?? app.madeByYou}</td>
                  </tr>
                  <tr>
                    <th scope="row">Price range</th>
                    <td className="n">{usd(app.priceLowCents)}&ndash;{usd(app.priceHighCents)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Shows attended</th>
                    <td>
                      {vendor.showsAttended === 0
                        ? 'First time applying'
                        : `${vendor.showsAttended} with Mermade`}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Submitted</th>
                    <td className="n">{fmtDateTime(app.submittedAt)}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ marginTop: 16 }}>
                <Link className="adm-lk" href={`/admin/applications/${app.id}?from=${from}`}>
                  Open the review
                  <span className="who">{vendor.shopName}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </p>
            </div>

            <div>
              <p className="k">
                The work
                <span className="adm-sr">, {photos.length} {photos.length === 1 ? 'photograph' : 'photographs'}</span>
              </p>
              {photos.length === 0 ? (
                <p className="adm-note" style={{ marginTop: 10 }}>
                  No photographs came with this application.
                </p>
              ) : (
                <div className="adm-roll" style={{ marginTop: 10 }}>
                  {photos.slice(0, 8).map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" loading="lazy" decoding="async" />
                      <span className="adm-sr">Open a photograph from {vendor.shopName} full size</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  )
}
