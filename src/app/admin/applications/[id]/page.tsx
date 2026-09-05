import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  applications, vendors, spaceTypes, addOns, bookings, auditLog,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { decide, saveScores } from '@/app/actions'
import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'

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
      {n !== undefined && <td className="n num">{n}</td>}
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

  /* ── the queue, so a juror never goes back to the grid between decisions ──
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
    <div style={{ padding: '26px 26px 80px', maxWidth: 1240 }}>
      <nav className="jr-nav" aria-label="Queue">
        <Link href={backHref} className="jr-step">
          <span aria-hidden="true">←</span> {LABEL[from]} queue
        </Link>
        {prev && (
          <Link href={stepHref(prev)} className="jr-step">
            <span aria-hidden="true">←</span> Previous
            <span className="who">{prev.shopName}</span>
          </Link>
        )}
        {next && (
          <Link href={stepHref(next)} className="jr-step">
            Next <span aria-hidden="true">→</span>
            <span className="who">{next.shopName}</span>
          </Link>
        )}
        <span className="jr-pos">
          {at >= 0
            ? `${at + 1} of ${queue.length} in ${LABEL[from]}`
            : `${queue.length} left in ${LABEL[from]}`}
        </span>
      </nav>

      <header className="jr-h" style={{ margin: '14px 0 4px' }}>
        <h1>{vendor.shopName}</h1>
        <span className="chip" data-s={app.status}>{LABEL[app.status as ApplicationStatus]}</span>
        {booking?.vendorCode && <span className="chip">{booking.vendorCode}</span>}
        {vendor.showsAttended > 0 && <span className="chip">Repeat · {vendor.showsAttended} shows</span>}
        {flags.map((f) => (
          <span key={f} className="chip" data-warn="1"
            title={f === 'Flagged vendor' ? vendor.flagReason ?? undefined : undefined}>{f}</span>
        ))}
      </header>
      <p style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)', marginBottom: 26 }}>
        Submitted {fmtDateTime(app.submittedAt)} · signed “{app.signedName}” · terms v{app.termsVersion}
      </p>

      {/* Two columns: what the maker sent on the left, the decision on the
          right. The rail is sticky, so the notes and the decision stay
          reachable however far down the photographs run. */}
      <div className="jr-grid">
        <div>
          {photos.length > 0 && (
            <>
              <h2 className="jr-h2">The work · {photos.length} photos</h2>
              <div className="jr-ph" style={{ marginTop: 16 }}>
                {photos.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                  </a>
                ))}
              </div>
            </>
          )}

          <h2 className="jr-h2">In their words</h2>
          <p className="jr-quote">{app.description}</p>

          <h2 className="jr-h2">The maker</h2>
          <table className="jr-facts" style={{ marginBottom: 4 }}>
            <tbody>
              <Row k="Category">
                {app.category}
                {secondary.length > 0 && (
                  <span style={{ marginLeft: 8 }}>
                    {secondary.map((c) => (
                      <span key={c} className="chip" style={{ marginRight: 5 }}>{c}</span>
                    ))}
                  </span>
                )}
              </Row>
              <Row k="Made by them">{MADE_BY[app.madeByYou] ?? app.madeByYou}</Row>
              <Row k="Price range">
                <span className="num">{usd(app.priceLowCents)}-{usd(app.priceHighCents)}</span>
              </Row>
              <Row k="Track"><span style={{ textTransform: 'capitalize' }}>{app.track}</span></Row>
              <Row k="Based in">{vendor.city}, {vendor.state}</Row>
              <Row k="Shows attended">
                {vendor.showsAttended === 0 ? 'First time applying' : `${vendor.showsAttended} with Mermade`}
              </Row>
              <Row k="Instagram">
                <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--deep)' }}>
                  {vendor.instagram} ↗
                </a>
                {vendor.website && (
                  <> · <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--deep)' }}>{vendor.website} ↗</a></>
                )}
              </Row>
              <Row k="Contact">
                {vendor.contactName} · <a href={`mailto:${vendor.email}`} style={{ color: 'var(--deep)' }}>{vendor.email}</a> · {vendor.phone}
              </Row>
            </tbody>
          </table>

          <h2 className="jr-h2">What they asked for</h2>
          <table className="jr-facts">
            <tbody>
              {requested.length === 0 ? (
                <Row k="Spaces" n="—">No space chosen yet.</Row>
              ) : requested.map((s) => (
                <Row
                  key={s.id}
                  k={s.id === app.spaceTypeId ? 'Space · primary' : 'Space'}
                  n={usd(s.priceCents)}
                >
                  {s.label}
                  {s.id === app.spaceTypeId && (
                    <div style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)' }}>
                      Books on acceptance.
                    </div>
                  )}
                </Row>
              ))}
              {extras.map((a) => (
                <Row key={a.id} k="Add-on asked for" n={usd(a.priceCents)}>
                  {a.name}
                  {a.isLimited && <span className="chip" style={{ marginLeft: 8 }}>limited</span>}
                </Row>
              ))}
            </tbody>
          </table>
          {extras.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 'var(--t-lbl)', color: 'var(--ink-3)' }}>
              Requests, not sales. Confirm what you can give them before the invoice goes out.
            </p>
          )}

          {/* Below the decision, not beside it. Paperwork is a load-in duty,
              not a curation input, and the jury should never weigh it. */}
          <h2 className="jr-h2">After acceptance</h2>
          <table className="jr-facts">
            <tbody>
              <Row k="Paperwork" n="">
                {app.sellerPermit
                  ? `Seller's permit on file: ${app.sellerPermit}`
                  : app.occasionalSeller
                    ? 'No permit; says they qualify as an occasional seller (CDTFA 410-D)'
                    : 'Nothing yet. Required before load-in, not before.'}
                {app.hasCoi && <div>Carries their own liability insurance.</div>}
              </Row>
              {booking && (
                <Row k="Booking" n={usd(booking.priceCents)}>
                  {booking.vendorCode} · {booking.commissionBps / 100}% commission ·{' '}
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
              <h2 className="jr-h2">History</h2>
              <table className="tbl">
                <tbody>
                  {trail.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 'var(--t-lbl)' }}>{fmtDateTime(t.at)}</td>
                      <td>{t.action.replace('_', ' ')}</td>
                      <td style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-2)' }}>
                        {t.after ? JSON.parse(t.after).status ?? '' : ''}
                        {t.reason && ` · ${t.reason}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* ── jury: notes, then the decision ── */}
        <aside className="jr-rail" aria-label="Jury decision">
          {/* Notes, then the decision. Scoring is gone: the team judges the
              work and says so, and a rubric out of 20 was answering a
              question nobody asked. The four score columns stay in the
              schema, unread by this screen; saveScores is unchanged, so
              saving notes clears whatever was in them. */}
          <h2 className="jr-h2" style={{ marginTop: 0 }}>Jury</h2>
          <form action={saveScores} style={{ marginTop: 16 }}>
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="field" style={{ marginBottom: 14 }}>
              <span className="lb">Jury notes (never shown to the maker)</span>
              <textarea className="inp" name="juryNotes" defaultValue={app.juryNotes}
                style={{ minHeight: 188 }} />
            </label>
            <button className="btn-o" type="submit">Save notes</button>
          </form>

          <h2 className="jr-h2">Move to</h2>
          <div className="jr-moves">
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
          <p style={{ marginTop: 12, fontSize: 'var(--t-lbl)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Accepting books the primary space and sends the invoice. Declining sends the reason
            above it.
          </p>

          {/* The hand is here after a decision, so the way on is here too. */}
          {next && (
            <div className="jr-onward">
              <Link href={stepHref(next)} className="jr-step">
                Next in {LABEL[from]} <span aria-hidden="true">→</span>
                <span className="who">{next.shopName}</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
