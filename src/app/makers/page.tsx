import Link from 'next/link'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { MakerGrid, type MakerCard } from './MakerGrid'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, LogoGrid, RichText, Banner } from '@/components/theme/Sections'
import { fmtDate } from '@/lib/dates'
import { unlisted } from '@/lib/pages'

/* Cached and re-rendered at most once a minute. Read-only, nothing
 * per-request, and the Show record it reads changes a few times a season.
 * Being dynamic meant a cold database on the visitor's critical path for no
 * benefit; saving in the admin clears the tag, so staff still see edits at
 * once. See src/app/page.tsx for the incident this came from. */
export const revalidate = 60

export const metadata = {
  /* Unlisted while the lineup is still settling: reachable by the link Drew
     is sending round, kept out of the sitemap and the nav, and noindex so it
     does not turn up in a search for Mermade before it is ready. One word in
     src/lib/pages.ts puts it back. */
  ...unlisted,
  title: 'Makers',
  description:
    'The makers selling at the next Mermade Market, inside and outside, by category and by day.',
  alternates: { canonical: '/makers' },
}

/**
 * /pages/spring-2026-merchants — their page title, their intro subheading,
 * then a logo grid per group: the inside makers who are there all three days,
 * then the outside tents day by day.
 *
 * Theirs is typed in by hand every season. This one is GENERATED from
 * confirmed bookings, so it fills in as makers pay and cannot go stale, and
 * before the roster is announced it says so rather than showing last
 * season's lineup.
 */
export default async function Makers() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const roster = await db
    .select({
      id: bookings.id,
      shopName: vendors.shopName,
      instagram: vendors.instagram,
      website: vendors.website,
      track: spaceTypes.track,
      space: spaceTypes.label,
      category: applications.category,
      photos: applications.photos,
      thumbnailUrl: applications.thumbnailUrl,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    /* Everyone who holds a space, not only those who have paid.
    
       This listed confirmed bookings on the reasoning that it "fills in as
       makers pay and cannot go stale". What that meant on the day the roster
       went out was seventeen outdoor makers missing from their own show,
       nine of them on Friday, because a fee had not landed yet. Hillary, who
       runs outdoor: "my makers aren't all correct."
    
       A maker who has been accepted and holds a space is in the show. The fee
       is between them and us and is not the public's business. holdsSpace is
       the same test the roster and the capacity counts use, so a released or
       forfeited maker still drops off this page the moment staff take the
       space back. */
    .where(and(
      eq(bookings.showId, show.id),
      inArray(bookings.status, ['confirmed', 'payment_processing', 'awaiting_payment']),
    ))
    .orderBy(asc(spaceTypes.sortOrder), asc(vendors.shopName))

  type Row = (typeof roster)[number]
  const linkFor = (m: Row) => {
    const w = m.website?.trim()
    if (w) return w.startsWith('http') ? w : `https://${w}`
    const ig = m.instagram?.trim()
    return ig ? `https://instagram.com/${ig.replace(/^@/, '')}` : null
  }

  /* The five lists the old Shopify page kept, which are the five a shopper
     plans around: the makers inside, the children who have a table of their
     own, and then each day outside, because the tents change daily. */
  const groupOf = (m: Row) => {
    if (m.track === 'indoor') return m.space === 'JR Space' ? 'junior' : 'indoor'
    const d = /(friday|saturday|sunday)/i.exec(m.space)
    return d ? d[1]!.toLowerCase() : 'indoor'
  }

  /* Muted, and all pulled toward the brand's stone and gold, so a grid of
     makers without photographs still reads as one family rather than a
     category rainbow. */
  const TINT: Record<string, string> = {
    Jewelry: '#BC9658', Ceramics: '#A98A72', Home: '#8E9B92', Apparel: '#7E8CA0',
    Kids: '#C2A08C', Treats: '#C4A76B', 'Bath & Body': '#9FB0A8', Candles: '#B49C77',
    'Paper/Art': '#8C93A8', Vintage: '#A9998C', Other: '#9A9A94',
  }
  const initialsOf = (name: string) => {
    const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
    const keep = words.filter((w) => !['the', 'and', 'co', 'of', 'by', 'a'].includes(w.toLowerCase()))
    const use = keep.length > 0 ? keep : words
    if (use.length >= 2) return (use[0]![0]! + use[1]![0]!).toUpperCase()
    return (use[0]?.slice(0, 2) ?? '??').toUpperCase()
  }

  const cards: MakerCard[] = roster.map((m) => ({
    id: m.id,
    name: m.shopName,
    category: m.category || 'Other',
    group: groupOf(m),
    /* The staff's chosen square ONLY, never the maker's own application
       upload.
    
       Elise, the night the page went round: "he must have grabbed from
       website application... BAD BAD BAD. The ones in the drive are what we
       wanted." She is right, and this was the mistake. A photograph sent in
       with an application was sent to a jury, not to the public: it is
       whatever the maker had to hand to show their work, and on this page it
       turned into a wedding photo and two makers who did not want to be seen
       at all.
    
       So the fallback is gone. A maker appears with the square Hillary shot
       or a staff member chose, and otherwise with their initials. Nothing a
       maker uploaded privately is ever published by default, and there is no
       longer any way for it to become public by accident. /admin/thumbnails
       still shows their upload to staff, which is what it is for. */
    photo: m.thumbnailUrl?.trim() || null,
    href: linkFor(m),
    initials: initialsOf(m.shopName),
    tint: TINT[m.category || 'Other'] ?? '#9A9A94',
  }))

  return (
    <SiteShell show={show} template="page template-suffix-makers">
          <PageTitle title={`${show.name} Makers`}>
            {roster.length > 0 && (
              /* One line, under the title, instead of a rich-text section of
                 its own. The old copy explained where to scroll, which the
                 filter above the grid now answers, and it cost a whole
                 section's padding to say it. */
              <p className="mk-dir__lede">
                Inside, the same makers all three days. Outside, a different row of
                tents each day.
              </p>
            )}
          </PageTitle>

          {roster.length === 0 ? (
            <RichText
              title={`Announced ${fmtDate(show.rosterAnnouncedOn, { year: undefined })}`}
              cta={{ href: '/apply', label: 'Apply now' }}
            >
              <p>
                The {show.name} lineup goes up here the day the roster is set.
                Join the list and we&#39;ll write the morning it does.
              </p>
            </RichText>
          ) : (
            <>
              <MakerGrid makers={cards} />
            </>
          )}

          {/* A page of names closes on the thing the names add up to: one
              register at the front, and one bag at the end. */}
          <Banner
            id="section-merchants-plate"
            image="/photos/tote.jpg"
            title=""
            heightMobile={420}
            heightDesktop={560}
            shadow={false}
          />
        </SiteShell>
  )
}
