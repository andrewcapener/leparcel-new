import Link from 'next/link'

/**
 * The apply block: the ask, and the two ways to take it.
 *
 * It exists for two reasons that turned out to be one reason.
 *
 * The homepage had no way to apply below the hero. Applications close on a
 * date, the gold bar at the top says so, and then the page did nothing about
 * it: everything under the fold offered Directions and a newsletter signup.
 * Somebody who scrolled, which is most people, was never asked.
 *
 * And the page had two photograph bands touching. Removing the text ticker
 * put the map's pictures directly against the filmstrip, so the whole lower
 * half read as one continuous collage. Drew: "we've got two back to back
 * image sections, just not totally ideal."
 *
 * One block on paper, between them, fixes both: it separates the two picture
 * bands by being made of type, and it is the ask the page was missing.
 *
 * Every number here comes in as a prop off the Show record. CLAUDE.md rule 6:
 * no price, rate or date is written down in this file, because the day
 * somebody edits /admin/show is the day a hardcoded one starts lying.
 */
export function ApplyBand({
  id, deadline, commission, indoorFrom, outdoorFrom, daysLeft,
}: {
  id: string
  /** "September 21, 11:59pm PT", already formatted Pacific. */
  deadline: string
  /** "20%" */
  commission: string
  /** "$60" */
  indoorFrom: string
  /** "$400" */
  outdoorFrom: string
  /** Pacific calendar days to the close. 0 means today is the last day. */
  daysLeft?: number
}) {
  return (
    <div className="shopify-section section-apply-band">
      <div className="ab" id={id}>
        <div className="ab__in">
          <div className="ab__lead">
            <p className="ab__k">Applications are open</p>
            <h2 className="ab__h">Sell at the market.</h2>
            <p className="ab__p">
              One form covers both tracks, there is no fee to apply, and we read every
              application and answer either way.
            </p>
            <div className="ab__acts">
              <Link className="ab__btn" href="/apply">Start your application</Link>
              <Link className="ab__lk" href="/apply#details">
                Prices, dates and rules <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="ab__deadline">
              {/* Zero is the closing day, and "0 days left" reads as closed to
                  somebody who still has until midnight. */}
              {daysLeft === 0 && <span className="ab__days">Last day. </span>}
              {typeof daysLeft === 'number' && daysLeft > 0 && (
                <span className="ab__days">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left. </span>
              )}
              Closes {deadline}.
            </p>
          </div>

          {/* The two tracks, which the homepage never explained. A maker
              deciding whether to apply is deciding between these, and until
              now that choice only existed on the page you reach by deciding. */}
          <div className="ab__ways">
            <div className="ab__way">
              <p className="ab__way-k">Inside</p>
              <p className="ab__way-h">We sell it for you</p>
              <p className="ab__way-p">
                Consignment. Your work is on the floor all three days and you do not
                have to be. We merchandise it, sell it at one register, take {commission},
                and pay out after the show.
              </p>
              <p className="ab__way-n">Spaces from {indoorFrom}</p>
            </div>
            <div className="ab__way">
              <p className="ab__way-k">Outside</p>
              <p className="ab__way-h">You sell it yourself</p>
              <p className="ab__way-p">
                A tent we set up for you, for the day. Your own register, your own
                hours, and nothing owed on what you sell.
              </p>
              <p className="ab__way-n">From {outdoorFrom} a day, 0% commission</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
