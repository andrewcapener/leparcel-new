import Link from 'next/link'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { PageHead, Tabs, Tab } from '../ui'
import { thumbnailFor, parsePhotos } from '@/server/modules/roster/thumbnail'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { setThumbnail, clearThumbnail } from './actions'
import { ThumbUpload } from './ThumbUpload'

/**
 * Every maker's square, on one screen.
 *
 * Elise asked to be able to change thumbnails, and the obvious shape was a
 * control on each maker's own row. Ninety two makers on an admin that takes
 * half a minute to wake makes that ninety two page loads, so it is one grid
 * instead: every maker at once, the picture that will be used, and the two
 * things she actually does, which are replace it and put it back.
 *
 * Nothing here overwrites a maker's own photographs. Choosing a square sets
 * an override column; clearing it hands their first upload back. That is why
 * "Use theirs" can always be offered and why nothing a maker sent us can be
 * lost from this screen.
 */

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'missing', label: 'No picture' },
  { key: 'theirs', label: "Maker's own" },
  { key: 'chosen', label: 'Replaced' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

/**
 * Everyone, by default.
 *
 * This opened on the makers with no picture, on the reasoning that they are
 * the worklist. It reads as the page being broken: the first thing anybody
 * sees is a screen of empty boxes, and the photographs the makers actually
 * uploaded are one tab away where nobody looks. Open on the populated state,
 * let the counts say how much is left, and let her click the worklist.
 */
function asFilter(v: string | undefined): FilterKey {
  return FILTERS.some((f) => f.key === v) ? (v as FilterKey) : 'all'
}

export default async function Thumbnails({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; thumb?: string }>
}) {
  const sp = await searchParams
  const filter = asFilter(sp.show)
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  /* Booked makers only. An applicant who was never accepted has no place on
     a page about what the public will see. */
  const rows = await db
    .select({
      applicationId: applications.id,
      thumbnailUrl: applications.thumbnailUrl,
      photos: applications.photos,
      shopName: vendors.shopName,
      category: applications.category,
      vendorCode: bookings.vendorCode,
      track: spaceTypes.track,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(and(eq(bookings.showId, show.id), eq(applications.status, 'accepted')))
    .orderBy(asc(vendors.shopName))

  const withThumb = rows.map((r) => ({ ...r, thumb: thumbnailFor(r) }))
  const counts = {
    missing: withThumb.filter((r) => r.thumb.source === 'none').length,
    theirs: withThumb.filter((r) => r.thumb.source === 'uploaded').length,
    chosen: withThumb.filter((r) => r.thumb.source === 'chosen').length,
    all: withThumb.length,
  }
  const shown = filter === 'all'
    ? withThumb
    : withThumb.filter((r) => (
      filter === 'missing' ? r.thumb.source === 'none'
        : filter === 'theirs' ? r.thumb.source === 'uploaded'
          : r.thumb.source === 'chosen'))

  return (
    <>
      <PageHead
        title="Maker pictures"
        sub={counts.all === 0
          ? 'No booked makers on this show yet.'
          : `${counts.theirs + counts.chosen} of ${counts.all} makers have a square. `
            + `${counts.theirs} came from what the maker uploaded`
            + `${counts.chosen > 0 ? `, ${counts.chosen} replaced by hand` : ''}`
            + `${counts.missing > 0 ? `, and ${counts.missing} still have none.` : '.'}`}
      >
        <Link className="adm-btn" href="/admin/roster">Back to the roster</Link>
      </PageHead>

      {sp.thumb && (
        <p className="adm-note" role="status">
          {sp.thumb === 'set' ? 'Picture updated. It is live on the maker’s tile, and what they uploaded themselves is untouched.'
            : sp.thumb === 'cleared' ? 'Back to the maker’s own photograph. Nothing of theirs was ever changed.'
              : sp.thumb === 'foreign' ? 'That picture has to be one we hold. Upload the file itself rather than linking to somebody else’s site.'
                : 'No such maker. Nothing was changed.'}
        </p>
      )}

      {/* When not one maker has a photograph, the screen looks broken and the
          reason is invisible. Name it: either storage was never configured,
          in which case no upload could ever have been kept, or it was and
          nobody sent one. Those need different people to do different things. */}
      {counts.all > 0 && counts.theirs === 0 && counts.chosen === 0 && (
        <p className="adm-note" role="status">
          {photoUploadsEnabled()
            ? 'Not one of these makers has a photograph on their application. Uploads are switched on, so this is makers not having sent one rather than anything being broken. Add them here.'
            : 'Photo uploads are not configured on this deployment, so nothing a maker sent could have been kept. Set the Supabase service role key before chasing anybody for pictures.'}
        </p>
      )}

      <Tabs label="Which makers">
        {FILTERS.map((f) => (
          <Tab
            key={f.key}
            href={`/admin/thumbnails?show=${f.key}`}
            label={f.label}
            count={counts[f.key]}
            on={filter === f.key}
          />
        ))}
      </Tabs>

      {shown.length === 0 ? (
        <p className="adm-empty">
          {filter === 'missing'
            ? 'Every maker has a picture. That is the whole list done.'
            : 'Nobody in this list yet.'}
        </p>
      ) : (
        <ul className="thumb-grid">
          {shown.map((r) => {
            const theirs = parsePhotos(r.photos)
            return (
              <li className="thumb-cell" key={r.applicationId}>
                <div className="thumb-art" data-empty={r.thumb.url ? undefined : '1'}>
                  {r.thumb.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r.thumb.url} alt="" loading="lazy" width={200} height={200} />
                  ) : (
                    <span className="thumb-none">No picture</span>
                  )}
                  {r.thumb.source === 'chosen' && <span className="thumb-tag">Replaced</span>}
                </div>

                <p className="thumb-name">{r.shopName}</p>
                <p className="thumb-meta">
                  {r.vendorCode} &middot; {r.category} &middot; {r.track}
                </p>

                <div className="thumb-acts">
                  <ThumbUpload
                    applicationId={r.applicationId}
                    shopName={r.shopName}
                    action={setThumbnail}
                  />
                  {r.thumb.source === 'chosen' && (
                    <form action={clearThumbnail}>
                      <input type="hidden" name="applicationId" value={r.applicationId} />
                      <input type="hidden" name="back" value={`/admin/thumbnails?show=${filter}`} />
                      <button className="adm-btn-q" type="submit">
                        {theirs.length > 0 ? 'Use theirs' : 'Remove'}
                        <span className="adm-sr"> for {r.shopName}</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* Everything they sent, so a bad leading photo is one click to
                    fix rather than a re-upload of a file nobody has. */}
                {theirs.length > 1 && (
                  <div className="thumb-theirs">
                    <span className="adm-sr">Other photographs {r.shopName} uploaded</span>
                    {theirs.map((url) => (
                      <form action={setThumbnail} key={url}>
                        <input type="hidden" name="applicationId" value={r.applicationId} />
                        <input type="hidden" name="url" value={url} />
                        <input type="hidden" name="back" value={`/admin/thumbnails?show=${filter}`} />
                        <button
                          type="submit"
                          className="thumb-pick"
                          aria-current={url === r.thumb.url ? 'true' : undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" loading="lazy" width={44} height={44} />
                          <span className="adm-sr">Use this one</span>
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
