import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import {
  shows, applications, vendors, spaceTypes, bookings,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { decide } from '@/app/actions'
import { usd } from '@/lib/money'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

/** Counts come back from postgres as bigint, which the driver hands over as a
 *  string. Anything we subtract from a capacity has to go through this. */
const num = (v: number | string | null | undefined) => Number(v ?? 0)

export default async function Jury({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const active = (APPLICATION_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as ApplicationStatus)
    : 'new'

  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const counts = await db
    .select({ status: applications.status, n: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.showId, show.id))
    .groupBy(applications.status)
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0

  const rows = await db
    .select({
      app: applications,
      vendor: vendors,
      space: spaceTypes,
    })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .leftJoin(spaceTypes, eq(applications.spaceTypeId, spaceTypes.id))
    .where(and(eq(applications.showId, show.id), eq(applications.status, active)))
    .orderBy(desc(applications.submittedAt))

  /* Category balance — encodes the actual curation rule ("one to three makers
     per category") into the tool instead of leaving it to memory.
     docs/01-PRODUCT-SPEC.md §3.2 */
  const balance = await db
    .select({ category: applications.category, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.category)
    .orderBy(desc(sql`count(*)`))

  const [{ sold }] = await db
    .select({ sold: sql<number>`count(*)` })
    .from(bookings)
    .where(eq(bookings.showId, show.id))

  /* Spaces remaining, per track, because they fill at different speeds and one
     combined number hides the track that is already full. A `both` acceptance
     holds a space on each side. Capacities live on the Show record. */
  const acceptedByTrack = await db
    .select({ track: applications.track, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.track)
  const held = (track: 'indoor' | 'outdoor') =>
    acceptedByTrack
      .filter((r) => r.track === track || r.track === 'both')
      .reduce((a, r) => a + num(r.n), 0)
  const indoorLeft = show.indoorCapacity - held('indoor')
  const outdoorLeft = show.outdoorCapacity - held('outdoor')

  const undecided = num(countOf('new')) + num(countOf('under_review')) + num(countOf('shortlist'))

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header className="jr-h">
        <h1>Jury · {show.name}</h1>
        <span className="meta">
          Applications close {fmtDate(show.applicationsCloseAt)} ·{' '}
          {show.commissionBps / 100}% commission · {show.paymentWindowHours}h payment window
        </span>
      </header>

      {/* The counting questions, answered before the reviewer scrolls: how many
          sit in each state, and which one to open next. Every tile is the
          filter for its own column, so the counts and the navigation are one
          control rather than a tab strip repeating the numbers. */}
      <nav className="jr-stats" aria-label="Filter the queue by state">
        {APPLICATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/jury?status=${s}`}
            className="jr-stat"
            aria-current={s === active ? 'page' : undefined}
          >
            <span className="k">{LABEL[s]}</span>
            <div className="v">{countOf(s)}</div>
          </Link>
        ))}
        <div className="jr-stat" data-warn={indoorLeft < 0 ? '1' : undefined}>
          <span className="k">Indoor left</span>
          <div className="v">{indoorLeft}<small> of {show.indoorCapacity}</small></div>
        </div>
        <div className="jr-stat" data-warn={outdoorLeft < 0 ? '1' : undefined}>
          <span className="k">Outdoor left</span>
          <div className="v">{outdoorLeft}<small> of {show.outdoorCapacity}</small></div>
        </div>
        <div className="jr-stat">
          <span className="k">Booked spaces</span>
          <div className="v">{sold}</div>
        </div>
      </nav>

      <div className="jr-strip">
        <span className="g">
          <span className="k">Still to decide</span>
          <span className="num">{undecided}</span>
        </span>
        <span className="g">
          <span className="k">Accepted by category</span>
          {balance.length === 0
            ? <span style={{ color: 'var(--ink-3)', fontSize: 'var(--t-lbl)' }}>nothing accepted yet</span>
            : balance.map((b) => (
                <span
                  key={b.category}
                  className="chip"
                  data-warn={num(b.n) > 3 ? '1' : undefined}
                  title={num(b.n) > 3 ? 'Over the one-to-three-per-category rule' : undefined}
                >
                  {b.category} {b.n}
                </span>
              ))}
        </span>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-s)' }}>Nothing in {LABEL[active]}.</p>
      ) : (
        <table className="tbl jr-q">
          <caption className="k" style={{ textAlign: 'left', paddingBottom: 10 }}>
            {LABEL[active]} · {rows.length} {rows.length === 1 ? 'application' : 'applications'}, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Work</th>
              <th scope="col">Shop</th>
              <th scope="col">Category</th>
              <th scope="col" className="r">Prices</th>
              <th scope="col">Flags</th>
              <th scope="col" className="r">Score</th>
              <th scope="col" style={{ width: 210 }}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ app, vendor, space }) => {
              const total =
                (app.scoreQuality ?? 0) + (app.scoreOriginality ?? 0)
                + (app.scoreBrand ?? 0) + (app.scoreFit ?? 0)
              /* Curation flags only. Missing paperwork is deliberately NOT
                 shown here: it has no bearing on whether the work is good, and
                 putting it in front of the jury invites it to weigh against an
                 applicant it shouldn't. Compliance is enforced on the roster,
                 after acceptance, where the CDTFA duty actually attaches. */
              const flags: Array<[string, boolean]> = [
                ['MLM', app.isMlm],
                ['AI artwork', app.usesAiArtwork],
                ['Resells', app.madeByYou === 'curate_resell'],
                ['Flagged vendor', vendor.isFlagged],
              ]
              let photos: string[] = []
              try { photos = JSON.parse(app.photos) } catch {}
              let extraSpaces = 0
              try { extraSpaces = Math.max(0, JSON.parse(app.requestedSpaceIds).length - 1) } catch {}
              return (
                <tr key={app.id}>
                  <td>
                    <div className="jr-th">
                      {photos.length === 0
                        ? <div className="none" aria-hidden="true" />
                        : photos.slice(0, 3).map((src) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={src} src={src} alt="" width={52} height={52} />
                          ))}
                    </div>
                    {photos.length > 3 && (
                      <div className="jr-sub">+{photos.length - 3} more</div>
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/applications/${app.id}`} className="nm">
                      {vendor.shopName}
                    </Link>
                    {vendor.showsAttended > 0 && (
                      <span className="chip" style={{ marginLeft: 8 }}>
                        Repeat · {vendor.showsAttended}
                      </span>
                    )}
                    <div className="jr-sub">
                      {vendor.contactName} · {vendor.city}, {vendor.state} ·{' '}
                      <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
                        target="_blank" rel="noreferrer" style={{ color: 'var(--accent-tx-tint)' }}>
                        {vendor.instagram}
                      </a>
                    </div>
                    <p className="jr-desc">{app.description}</p>
                  </td>
                  <td>
                    {app.category}
                    <div className="jr-sub" style={{ textTransform: 'capitalize' }}>{app.track}</div>
                    <div className="jr-sub">
                      {space?.label ?? '—'}{extraSpaces > 0 ? ` +${extraSpaces} more` : ''}
                    </div>
                  </td>
                  <td className="r num">
                    {usd(app.priceLowCents)}-{usd(app.priceHighCents)}
                    <div className="jr-sub">{space ? `${usd(space.priceCents)} fee` : 'no fee yet'}</div>
                  </td>
                  <td>
                    <div className="jr-chips">
                      {flags.filter(([, on]) => on).map(([l]) => (
                        <span key={l} className="chip" data-warn="1">{l}</span>
                      ))}
                      {flags.every(([, on]) => !on) && (
                        <span style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)' }}>clear</span>
                      )}
                    </div>
                  </td>
                  <td className="r">
                    {total ? (
                      <>
                        <div className="jr-tot">{total}<small>/20</small></div>
                        <div className="jr-sub">
                          Q{app.scoreQuality} O{app.scoreOriginality} B{app.scoreBrand} F{app.scoreFit}
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)' }}>unscored</span>
                    )}
                    {app.decidedAt && <div className="jr-sub">{fmtDateTime(app.decidedAt)}</div>}
                  </td>
                  <td>
                    <div className="jr-acts">
                      {(['shortlist', 'accepted', 'waitlist', 'declined', 'under_review', 'new'] as const)
                        .filter((s) => s !== app.status)
                        .filter((s) => s !== 'new' || app.status === 'declined')
                        .map((s) => (
                          <form action={decide} key={s}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <input type="hidden" name="status" value={s} />
                            {s === 'declined' && (
                              <input type="hidden" name="reason"
                                value="Category was full this season. We take one to three makers per category." />
                            )}
                            <button className="btn-o" type="submit">{LABEL[s]}</button>
                          </form>
                        ))}
                    </div>
                    {app.declineReason && (
                      <p className="jr-sub" style={{ maxWidth: 210 }}>
                        Sent: “{app.declineReason}”
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
