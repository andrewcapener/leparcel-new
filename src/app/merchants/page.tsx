import Link from 'next/link'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { thumbnailFor } from '@/server/modules/roster/thumbnail'
import { MakerGrid, type MakerCard } from './MakerGrid'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, LogoGrid, RichText, Banner } from '@/components/theme/Sections'
import { fmtDate } from '@/lib/dates'

/* Cached and re-rendered at most once a minute. Read-only, nothing
 * per-request, and the Show record it reads changes a few times a season.
 * Being dynamic meant a cold database on the visitor's critical path for no
 * benefit; saving in the admin clears the tag, so staff still see edits at
 * once. See src/app/page.tsx for the incident this came from. */
export const revalidate = 60

export const metadata = {
  title: 'Makers',
  description:
    'The makers selling at the next Mermade Market, inside and outside, by category and by day.',
  alternates: { canonical: '/merchants' },
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
export default async function Merchants() {
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
    .where(and(eq(bookings.showId, show.id), eq(bookings.status, 'confirmed')))
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
    photo: thumbnailFor(m).url,
    href: linkFor(m),
    initials: initialsOf(m.shopName),
    tint: TINT[m.category || 'Other'] ?? '#9A9A94',
  }))

  return (
    <SiteShell show={show} template="page template-suffix-merchants">
          <PageTitle title={`${show.name} Makers`} />

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
              {/* Their page sets this as a tracked uppercase eyebrow: 267
                  characters of body copy in a label setting, seven lines on a
                  phone. Tracked uppercase is for labels.

                  It is also shorter than theirs. Half of what it said was
                  directions to the groups below it ("just below", "keep
                  scrolling"), and the groups now label themselves. What is
                  left is the part a shopper cannot see from the labels: that
                  coming twice gets you a different market. */}
              <RichText large={false}>
                <p>
                  The makers inside are there all three days and we restock for
                  them. The tents outside change daily, so Saturday is a
                  different market from Friday.
                </p>
              </RichText>

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
