import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  applications, vendors, spaceTypes, addOns, bookings, auditLog,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { decide, saveScores } from '@/app/actions'
import { usd, bpsLabel } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { PageHead } from '../../ui'

export const dynamic = 'force-dynamic'

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

const MADE_BY: Record<string, string> = {
  all: 'Makes everything',
  mostly_sourced_components: 'Mostly, with sourced components',
  curate_resell: 'Curates and resells',
}

/** One labelled fact. `n` is the figure column: prices sit there, right
 *  aligned and tabular, so a column of money reads as a column. */
function Row({ k, children, n }: { k: string; children: React.ReactNode; n?: React.ReactNode }) {
  return (
    <tr>
      <th scope="row">{k}</th>
      <td>{children}</td>
      {n !== undefined && <td className="n">{n}</td>}
    </tr>
  )
}

export default async function ApplicationDetail({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  /** Which queue the juror came from, so this screen can page through the
   *  same list. Optional: the application's own status is the fallback, so
   *  the URL still works pasted into a browser on its own. */
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from: fromParam } = await searchParams
  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) notFound()
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, app.vendorId) })
  if (!vendor) notFound()

  /* ── the queue, so a juror never goes back to the list between decisions ──
     Same filter and same order as /admin/jury: this show, one status, newest
     first. Deciding moves the application out of that queue, so the position
     is found by id first and by submission time second. That way "next" still
     points at the right maker on the render right after a decision. */
  const from = (APPLICATION_STATUSES as readonly string[]).includes(fromParam ?? '')
    ? (fromParam as ApplicationStatus)
    : (app.status as ApplicationStatus)
  const queue = await db
    .select({
      id: applications.id,
      submittedAt: applications.submittedAt,
      shopName: vendors.shopName,
    })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .where(and(eq(applications.showId, app.showId), eq(applications.status, from)))
    .orderBy(desc(applications.submittedAt))

  const ms = (iso: string) => new Date(iso).getTime()
  const at = queue.findIndex((r) => r.id === app.id)
  /* Where this application sits in that list, whether or not it is still in
     it. Once it has been decided it is gone from the queue, and the slot it
     would have held is the first row submitted before it. */
  const older = queue.findIndex((r) => ms(r.submittedAt) < ms(app.submittedAt))
  const slot = at >= 0 ? at : older === -1 ? queue.length : older
  const prev = queue[slot - 1]
  const next = at >= 0 ? queue[slot + 1] : queue[slot]
  const backHref = `/admin/jury?status=${from}`
  const stepHref = (row: { id: string }) => `/admin/applications/${row.id}?from=${from}`

  let requestedIds: string[] = []
  try { requestedIds = JSON.parse(app.requestedSpaceIds) } catch {}
  if (requestedIds.length === 0 && app.spaceTypeId) requestedIds = [app.spaceTypeId]
  const requested = requestedIds.length
    ? await db.query.spaceTypes.findMany({
        where: inArray(spaceTypes.id, requestedIds),
        orderBy: [asc(spaceTypes.sortOrder)],
      })
    : []

  let requestedAddonCodes: string[] = []
  try { requestedAddonCodes = JSON.parse(app.requestedAddons) } catch {}
  const extras = requestedAddonCodes.length
    ? (await db.query.addOns.findMany({ where: eq(addOns.showId, app.showId) }))
        .filter((a) => requestedAddonCodes.includes(a.code))
    : []

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.applicationId, app.id)),
  })
  const trail = await db.query.auditLog.findMany({
    where: and(eq(auditLog.entity, 'application'), eq(auditLog.entityId, app.id)),
    orderBy: [desc(auditLog.at)],
    limit: 20,
  })

  const flags = [
    app.isMlm && 'MLM / direct sales',
    app.usesAiArtwork && 'AI artwork',
    app.madeByYou === 'curate_resell' && 'Resells',
    vendor.isFlagged && 'Flagged vendor',
  ].filter(Boolean) as string[]

  let photos: string[] = []
  try { photos = JSON.parse(app.photos) } catch {}
  let secondary: string[] = []
  try { secondary = JSON.parse(app.secondaryCategories) } catch {}

  return (
    <>
      <nav className="adm-queue" aria-label="Queue">
        <Link href={backHref} className="adm-lk">
          <span aria-hidden="true">←</span> {LABEL[from]} queue
        </Link>
        {prev && (
          <Link href={stepHref(prev)} className="adm-lk">
            <span aria-hidden="true">←</span> Previous
            <span className="who">{prev.shopName}</span>
          </Link>
        )}
        {next && (
          <Link href={stepHref(next)} className="adm-lk">
            Next <span aria-hidden="true">→</span>
            <span className="who">{next.shopName}</span>
          </Link>
        )}
        <span className="pos">
          {at >= 0
            ? `${at + 1} of ${queue.length} in ${LABEL[from]}`
            : `${queue.length} left in ${LABEL[from]}`}
        </span>
      </nav>

      <PageHead
        title={vendor.shopName}
        sub={`${vendor.email} · submitted ${fmtDateTime(app.submittedAt)} · signed “${app.signedName}” · terms v${app.termsVersion}`}
      >
        <span className="adm-tags">
          <span className="adm-tag">{LABEL[app.status as ApplicationStatus]}</span>
          {booking?.vendorCode && <span className="adm-tag">{booking.vendorCode}</span>}
          {vendor.showsAttended > 0 && <span className="adm-tag">Repeat {vendor.showsAttended}</span>}
          {flags.map((f) => (
            <span key={f} className="adm-tag" data-warn="1"
              title={f === 'Flagged vendor' ? vendor.flagReason ?? undefined : undefined}>{f}</span>
          ))}
        </span>
      </PageHead>

      {/* Two columns: what the maker sent on the left, the decision on the
          right. The rail is sticky, so the notes and the decision stay
          reachable however far down the photographs run. */}
      <div className="adm-review">
        <div>
          {photos.length > 0 && (
            <>
              <div className="adm-sec" style={{ marginTop: 0 }}>
                <h2>The work</h2>
                <span className="c">{photos.length} {photos.length === 1 ? 'photograph' : 'photographs'}</span>
              </div>
              <div className="adm-ph">
                {photos.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <span className="adm-sr">Open a photograph from {vendor.shopName} full size</span>
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="adm-sec"><h2>In their words</h2></div>
          <p className="adm-quote">{app.description}</p>

          <div className="adm-sec"><h2>The maker</h2></div>
          <table className="adm-fx">
            <tbody>
              <Row k="Category">
                {app.category}
                {secondary.length > 0 && (
                  <span className="adm-tags" style={{ marginTop: 6 }}>
                    {secondary.map((c) => <span key={c} className="adm-tag">{c}</span>)}
                  </span>
                )}
              </Row>
              <Row k="Made by them">{MADE_BY[app.madeByYou] ?? app.madeByYou}</Row>
              <Row k="Price range" n={`${usd(app.priceLowCents)} to ${usd(app.priceHighCents)}`}>
                <span className="adm-sr">What the work sells for.</span>
              </Row>
              <Row k="Track"><span style={{ textTransform: 'capitalize' }}>{app.track}</span></Row>
              <Row k="Based in">{vendor.city}, {vendor.state}</Row>
              <Row k="Shows attended">
                {vendor.showsAttended === 0 ? 'First time applying' : `${vendor.showsAttended} with Mermade`}
              </Row>
              <Row k="Instagram">
                <a className="adm-a mono" href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
                  target="_blank" rel="noreferrer">
                  {vendor.instagram} <span aria-hidden="true">↗</span>
                </a>
                {vendor.website && (
                  <>
                    {' '}
                    <a className="adm-a mono"
                      href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                      target="_blank" rel="noreferrer">
                      {vendor.website} <span aria-hidden="true">↗</span>
                    </a>
                  </>
                )}
              </Row>
              <Row k="Contact">
                {vendor.contactName}
                <span className="adm-sub2">
                  <a className="adm-a" href={`mailto:${vendor.email}`}>{vendor.email}</a> · {vendor.phone}
                </span>
              </Row>
            </tbody>
          </table>

          <div className="adm-sec"><h2>What they asked for</h2></div>
          <table className="adm-fx">
            <tbody>
              {requested.length === 0 ? (
                <Row k="Spaces" n="None">No space chosen yet.</Row>
              ) : requested.map((s) => (
                <Row
                  key={s.id}
                  k={s.id === app.spaceTypeId ? 'Space · primary' : 'Space'}
                  n={usd(s.priceCents)}
                >
                  {s.label}
                  {s.id === app.spaceTypeId && (
                    <span className="adm-sub2">Books on acceptance.</span>
                  )}
                </Row>
              ))}
              {extras.map((a) => (
                <Row key={a.id} k="Add-on asked for" n={usd(a.priceCents)}>
                  {a.name}
                  {a.isLimited && <span className="adm-tag" style={{ marginLeft: 8 }}>limited</span>}
                </Row>
              ))}
            </tbody>
          </table>
          {extras.length > 0 && (
            <p className="adm-note" style={{ marginTop: 12 }}>
              Requests, not sales. Confirm what you can give them before the invoice goes out.
            </p>
          )}

          {/* Below the decision, not beside it. Paperwork is a load-in duty,
              not a curation input, and the jury should never weigh it. */}
          <div className="adm-sec"><h2>After acceptance</h2></div>
          <table className="adm-fx">
            <tbody>
              <Row k="Paperwork" n="">
                {app.sellerPermit
                  ? `Seller's permit on file: ${app.sellerPermit}`
                  : app.occasionalSeller
                    ? 'No permit; says they qualify as an occasional seller (CDTFA 410-D)'
                    : 'Nothing yet. Required before load-in, not before.'}
                {app.hasCoi && <span className="adm-sub2">Carries their own liability insurance.</span>}
              </Row>
              {booking && (
                <Row k="Booking" n={usd(booking.priceCents)}>
                  {booking.vendorCode} · {bpsLabel(booking.commissionBps)} commission ·{' '}
                  {booking.status.replace('_', ' ')}
                </Row>
              )}
              {app.declineReason && (
                <Row k="Decline reason sent" n="">“{app.declineReason}”</Row>
              )}
            </tbody>
          </table>

          {trail.length > 0 && (
            <>
              <div className="adm-sec">
                <h2>History</h2>
                <span className="c">{trail.length} {trail.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <table className="adm-tbl">
                <caption className="adm-sr">
                  Every recorded change to this application, newest first.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {trail.map((t) => (
                    <tr key={t.id}>
                      <td><span className="mono">{fmtDateTime(t.at)}</span></td>
                      <td>{t.action.replace('_', ' ')}</td>
                      <td>
                        {t.after ? JSON.parse(t.after).status ?? '' : ''}
                        {t.reason && <span className="adm-sub2">{t.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* ── jury: notes, then the decision ── */}
        <aside className="adm-rail" aria-label="Jury decision">
          {/* Notes, then the decision. Scoring is gone: the team judges the
              work and says so, and a rubric out of 20 was answering a
              question nobody asked. The four score columns stay in the
              schema, unread by this screen; saveScores is unchanged, so
              saving notes clears whatever was in them. */}
          <span className="k">Jury notes</span>
          <form action={saveScores} style={{ marginTop: 12 }}>
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="adm-field" htmlFor="juryNotes">
              <span className="lb adm-sr">Jury notes, never shown to the maker</span>
              <textarea className="inp" id="juryNotes" name="juryNotes" defaultValue={app.juryNotes}
                style={{ minHeight: 170 }} />
              <span className="hint">Never shown to the maker.</span>
            </label>
            <button className="adm-btn-q" type="submit">Save notes</button>
          </form>

          <div className="adm-sec" style={{ margin: '24px 0 0', border: 0, paddingBottom: 0 }}>
            <h2>Move to</h2>
          </div>
          <div className="adm-moves">
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
                  <button className="adm-btn-q" type="submit">
                    {LABEL[s]}
                    <span className="adm-sr"> {vendor.shopName}</span>
                  </button>
                </form>
              ))}
          </div>
          <p className="adm-note" style={{ marginTop: 14 }}>
            Accepting books the primary space and sends the invoice. Declining sends the reason
            above it.
          </p>

          {/* The hand is here after a decision, so the way on is here too. */}
          {next && (
            <div className="adm-onward">
              <Link href={stepHref(next)} className="adm-lk">
                Next in {LABEL[from]} <span aria-hidden="true">→</span>
                <span className="who">{next.shopName}</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
