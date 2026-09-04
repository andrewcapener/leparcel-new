import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  applications, vendors, spaceTypes, bookings, auditLog,
  type ApplicationStatus,
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

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <tr>
      <th style={{ width: 190, borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>{k}</th>
      <td>{children}</td>
    </tr>
  )
}

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) notFound()
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, app.vendorId) })
  if (!vendor) notFound()

  let requestedIds: string[] = []
  try { requestedIds = JSON.parse(app.requestedSpaceIds) } catch {}
  if (requestedIds.length === 0 && app.spaceTypeId) requestedIds = [app.spaceTypeId]
  const requested = requestedIds.length
    ? await db.query.spaceTypes.findMany({
        where: inArray(spaceTypes.id, requestedIds),
        orderBy: [asc(spaceTypes.sortOrder)],
      })
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
  ].filter(Boolean) as string[]

  return (
    <div style={{ padding: '26px 26px 80px', maxWidth: 880 }}>
      <Link href="/admin/jury" style={{ fontFamily: 'var(--font-c)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.07em', fontSize: 13, color: 'var(--deep)' }}>
        ← Jury queue
      </Link>

      <header style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', margin: '14px 0 4px' }}>
        <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34 }}>
          {vendor.shopName}
        </h1>
        <span className="chip" data-s={app.status}>{LABEL[app.status as ApplicationStatus]}</span>
        {booking?.vendorCode && <span className="chip">{booking.vendorCode}</span>}
        {flags.map((f) => <span key={f} className="chip" data-warn="1">{f}</span>)}
      </header>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 24 }}>
        Submitted {fmtDateTime(app.submittedAt)} · signed “{app.signedName}” · terms v{app.termsVersion}
      </p>

      <table className="tbl" style={{ marginBottom: 30 }}>
        <tbody>
          <Row k="Contact">
            {vendor.contactName} · <a href={`mailto:${vendor.email}`} style={{ color: 'var(--deep)' }}>{vendor.email}</a> · {vendor.phone}
          </Row>
          <Row k="Instagram">
            <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--deep)' }}>
              {vendor.instagram} ↗
            </a>
            {vendor.website && (
              <> · <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--deep)' }}>{vendor.website} ↗</a></>
            )}
          </Row>
          <Row k="From">{vendor.city}, {vendor.state}</Row>
          <Row k="Category">{app.category}</Row>
          <Row k="The work">
            <div style={{ fontFamily: 'var(--font-g)', fontSize: 16.5, lineHeight: 1.6, maxWidth: '58ch' }}>{app.description}</div>
          </Row>
          <Row k="Price range">
            <span className="num">{usd(app.priceLowCents)}-{usd(app.priceHighCents)}</span>
          </Row>
          <Row k="Made by them">{MADE_BY[app.madeByYou] ?? app.madeByYou}</Row>
          <Row k="Track">
            <span style={{ textTransform: 'capitalize' }}>{app.track}</span>
          </Row>
          <Row k={`Spaces requested (${requested.length})`}>
            {requested.length === 0 ? '—' : (
              <div style={{ display: 'grid', gap: 4 }}>
                {requested.map((s) => (
                  <div key={s.id}>
                    {s.label} · <span className="num">{usd(s.priceCents)}</span>
                    {s.id === app.spaceTypeId && (
                      <span className="chip" style={{ marginLeft: 8 }}>primary · books on acceptance</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Row>
          <Row k="Paperwork">
            {app.sellerPermit
              ? `Seller's permit on file: ${app.sellerPermit}`
              : app.occasionalSeller
                ? 'No permit; says they qualify as an occasional seller (CDTFA 410-D)'
                : 'Nothing yet. Required before load-in, not before.'}
            {app.hasCoi && <div>Can provide a certificate of insurance.</div>}
          </Row>
          {booking && (
            <Row k="Booking">
              {booking.vendorCode} · {usd(booking.priceCents)} · {booking.commissionBps / 100}% commission ·{' '}
              {booking.status.replace('_', ' ')}
            </Row>
          )}
          {app.declineReason && <Row k="Decline reason sent">“{app.declineReason}”</Row>}
        </tbody>
      </table>

      {/* ── jury: scores, notes, decision ── */}
      <h2 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, fontSize: 22, marginBottom: 14 }}>Jury</h2>
      <form action={saveScores} style={{ marginBottom: 20 }}>
        <input type="hidden" name="applicationId" value={app.id} />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {([['scoreQuality', 'Quality', app.scoreQuality], ['scoreOriginality', 'Originality', app.scoreOriginality],
             ['scoreBrand', 'Brand', app.scoreBrand], ['scoreFit', 'Fit', app.scoreFit]] as const).map(([name, label, val]) => (
            <label key={name} className="field" style={{ margin: 0, width: 110 }}>
              <span className="lb">{label} /5</span>
              <input className="inp" name={name} type="number" min={1} max={5} defaultValue={val ?? ''} />
            </label>
          ))}
        </div>
        <label className="field" style={{ marginTop: 16 }}>
          <span className="lb">Jury notes (never shown to the maker)</span>
          <textarea className="inp" name="juryNotes" defaultValue={app.juryNotes} style={{ minHeight: 80 }} />
        </label>
        <button className="btn-o" type="submit">Save scores &amp; notes</button>
      </form>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['shortlist', 'accepted', 'waitlist', 'declined', 'under_review'] as const)
          .filter((s) => s !== app.status)
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

      {/* ── audit trail ── */}
      {trail.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, fontSize: 22, margin: '36px 0 12px' }}>History</h2>
          <table className="tbl">
            <tbody>
              {trail.map((t) => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 12.5 }}>{fmtDateTime(t.at)}</td>
                  <td>{t.action.replace('_', ' ')}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
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
  )
}
