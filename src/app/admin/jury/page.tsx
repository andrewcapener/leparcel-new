import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  shows, applications, vendors, spaceTypes, bookings,
  APPLICATION_STATUSES, type ApplicationStatus,
} from '@/db/schema'
import { decide } from '@/app/actions'
import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const LABEL: Record<ApplicationStatus, string> = {
  new: 'New', under_review: 'Under review', shortlist: 'Shortlist',
  accepted: 'Accepted', waitlist: 'Waitlist', declined: 'Declined',
}

export default async function Jury({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const active = (APPLICATION_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as ApplicationStatus)
    : 'new'

  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
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

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34 }}>Jury — {show.name}</h1>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {sold} of {show.indoorCapacity + show.outdoorCapacity} spaces committed ·{' '}
          {show.commissionBps / 100}% commission · {show.paymentWindowHours}h payment window
        </span>
      </header>

      {/* pipeline tabs, doubling as the board view's column counts */}
      <nav style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--ink)', marginBottom: 26,
        flexWrap: 'wrap',
      }}>
        {APPLICATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/jury?status=${s}`}
            style={{
              padding: '10px 16px', fontSize: 11, letterSpacing: '.11em',
              textTransform: 'uppercase', fontWeight: 600,
              color: s === active ? 'var(--paper)' : 'var(--ink-3)',
              background: s === active ? 'var(--ink)' : 'transparent',
            }}
          >
            {LABEL[s]} <span style={{ opacity: 0.6 }}>{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      {balance.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26,
          paddingBottom: 20, borderBottom: '1px solid var(--line)',
        }}>
          <span className="chip" style={{ border: 0, paddingLeft: 0 }}>Accepted by category</span>
          {balance.map((b) => (
            <span
              key={b.category}
              className="chip"
              data-warn={b.n > 3 ? '1' : undefined}
              title={b.n > 3 ? 'Over the one-to-three-per-category rule' : undefined}
            >
              {b.category} {b.n}
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>Nothing in {LABEL[active]}.</p>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Shop</th>
              <th>Category</th>
              <th>Track / space</th>
              <th className="r">Prices</th>
              <th className="r">Fee</th>
              <th>Flags</th>
              <th>Scores</th>
              <th style={{ width: 320 }}>Decision</th>
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
              return (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontFamily: 'var(--font-g)', fontSize: 17 }}>{vendor.shopName}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                      {vendor.contactName} · {vendor.city}, {vendor.state}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>
                      <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
                        target="_blank" rel="noreferrer" style={{ color: 'var(--clay)' }}>
                        {vendor.instagram}
                      </a>
                      {vendor.showsAttended > 0 && (
                        <span className="chip" style={{ marginLeft: 8 }}>
                          Repeat · {vendor.showsAttended}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, maxWidth: 380,
                      lineHeight: 1.5,
                    }}>
                      {app.description}
                    </p>
                  </td>
                  <td>{app.category}</td>
                  <td>
                    <div style={{ textTransform: 'capitalize' }}>{app.track}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{space?.label ?? '—'}</div>
                  </td>
                  <td className="r">
                    {usd(app.priceLowCents)} – {usd(app.priceHighCents)}
                  </td>
                  <td className="r">{space ? usd(space.priceCents) : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 150 }}>
                      {flags.filter(([, on]) => on).map(([l]) => (
                        <span key={l} className="chip" data-warn="1">{l}</span>
                      ))}
                      {flags.every(([, on]) => !on) && (
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>clear</span>
                      )}
                    </div>
                  </td>
                  <td className="r">
                    {total ? (
                      <>
                        <div style={{ fontFamily: 'var(--font-g)', fontSize: 19 }}>{total}<span style={{ color: 'var(--ink-3)', fontSize: 13 }}>/20</span></div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          Q{app.scoreQuality} O{app.scoreOriginality} B{app.scoreBrand} F{app.scoreFit}
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>unscored</span>
                    )}
                    {app.decidedAt && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                        {fmtDateTime(app.decidedAt)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['shortlist', 'accepted', 'waitlist', 'declined', 'under_review'] as const)
                        .filter((s) => s !== app.status)
                        .map((s) => (
                          <form action={decide} key={s}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <input type="hidden" name="status" value={s} />
                            {s === 'declined' && (
                              <input type="hidden" name="reason"
                                value="Category was full this season — we take one to three makers per category." />
                            )}
                            <button className="btn-o" type="submit">{LABEL[s]}</button>
                          </form>
                        ))}
                    </div>
                    {app.declineReason && (
                      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, maxWidth: 300 }}>
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
