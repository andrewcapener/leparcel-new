import Link from 'next/link'
import { decide } from '@/app/actions'
import { usd } from '@/lib/money'
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

/**
 * One application on the contact sheet.
 *
 * The work is the largest thing on the card, because that is what the jury is
 * judging. Everything else is one scan line: category and track, the price
 * band, and only the flags that are actually raised.
 *
 * Two interactions, no more. The whole card is a link into the review screen
 * (a stretched pseudo-element on the shop name, so the accessible name is the
 * shop and the target is the card), and one shortlist toggle sits above it.
 * The five decision pills that used to repeat on every row live on the review
 * screen's sticky rail, where deciding actually happens.
 */
export function ApplicationCard({
  app, vendor, from,
}: {
  app: Application
  vendor: Vendor
  /** The queue this card was opened from, so the review screen can page
   *  through the same list without sending the juror back here. */
  from: ApplicationStatus
}) {
  const photos = list(app.photos)
  const lead = photos[0]
  const strip = photos.slice(1, 4)
  const overflow = photos.length - 1 - strip.length

  const shortlisted = app.status === 'shortlist'
  const total =
    (app.scoreQuality ?? 0) + (app.scoreOriginality ?? 0)
    + (app.scoreBrand ?? 0) + (app.scoreFit ?? 0)

  /* Curation flags only. Missing paperwork is deliberately NOT shown to the
     jury: it has no bearing on whether the work is good. Compliance is
     enforced on the roster, after acceptance. */
  const flags = [
    app.isMlm && 'MLM',
    app.usesAiArtwork && 'AI artwork',
    app.madeByYou === 'curate_resell' && 'Resells',
    vendor.isFlagged && 'Flagged vendor',
  ].filter((f): f is string => Boolean(f))

  return (
    <li className="jr-card">
      <div className="jr-card-w">
        {lead === undefined ? (
          /* No photographs is a real state, not a broken one. The maker's own
             words take the plate and the card keeps its shape in the grid. */
          <div className="jr-card-none">
            <span className="k">No photos</span>
            <p>{app.description}</p>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="jr-card-lead" src={lead} alt="" loading="lazy" decoding="async" />
            {strip.length > 0 && (
              <div className="jr-card-strip">
                {strip.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" loading="lazy" decoding="async" />
                ))}
                {overflow > 0 && <span className="jr-card-more num">+{overflow}</span>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="jr-card-b">
        <h3 className="jr-card-nm">
          <Link className="jr-card-lk" href={`/admin/applications/${app.id}?from=${from}`}>
            {vendor.shopName}
            <span className="jr-vh">
              , {photos.length === 1 ? '1 photo' : `${photos.length} photos`}, open the review
            </span>
          </Link>
        </h3>
        <p className="jr-card-meta">
          {app.category} <span aria-hidden="true">·</span>{' '}
          <span className="jr-cap">{app.track}</span>
        </p>
        <p className="jr-card-price num">{usd(app.priceLowCents)}-{usd(app.priceHighCents)}</p>
        {(flags.length > 0 || vendor.showsAttended > 0) && (
          <div className="jr-card-chips">
            {vendor.showsAttended > 0 && (
              <span className="chip">Repeat · {vendor.showsAttended}</span>
            )}
            {flags.map((f) => (
              <span key={f} className="chip" data-warn="1">{f}</span>
            ))}
          </div>
        )}
      </div>

      <div className="jr-card-f">
        {total > 0 ? (
          <span className="jr-card-sc">
            Score <b className="num">{total}/20</b>
          </span>
        ) : (
          <span className="jr-card-sc">Unscored</span>
        )}
        {/* The one triage move that belongs on a contact sheet: mark it to
            come back to. Everything else is a decision, and decisions are
            made on the review screen with the work at full size. */}
        <form action={decide}>
          <input type="hidden" name="applicationId" value={app.id} />
          <input type="hidden" name="status" value={shortlisted ? 'under_review' : 'shortlist'} />
          <button className="btn-o jr-tri" type="submit" data-on={shortlisted ? '1' : undefined}>
            {shortlisted ? 'Shortlisted' : 'Shortlist'}
            <span className="jr-vh">
              {shortlisted ? `, take ${vendor.shopName} off the shortlist` : ` ${vendor.shopName}`}
            </span>
          </button>
        </form>
      </div>
    </li>
  )
}
