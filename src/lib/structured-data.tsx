/**
 * JSON-LD, so Google can render the show as an event rather than a page.
 *
 * The Shopify site carried Shopify's own Organization and WebSite blocks and
 * nothing else. That is a floor, not an opportunity: an Event with a date, a
 * place and an offer is what earns a date and a venue in the search result
 * itself, and this is a market whose whole search intent is "when and where".
 *
 * Everything comes off the Show record (CLAUDE.md rule 6). Nothing here is a
 * literal date, price or capacity, so moving the show at /admin/show moves the
 * structured data with it.
 */
import type { Show } from '@/db/schema'
import { siteUrl } from './site-url'
import { img } from './theme-img'

const ADDRESS = (show: Show) => ({
  '@type': 'PostalAddress',
  streetAddress: show.venueAddress.split(',')[0]?.trim() ?? show.venueAddress,
  addressLocality: 'Dana Point',
  addressRegion: 'CA',
  addressCountry: 'US',
})

export function organizationLd() {
  const origin = siteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Mermade Market',
    url: origin,
    logo: `${origin}${img('Mermade-Market-Icon.png')}`,
    sameAs: [
      'https://instagram.com/mermademarket',
      'https://www.facebook.com/mermademarketoc',
    ],
  }
}

/**
 * The show itself.
 *
 * `endDate` is the last day, and Google wants a time on both ends or it treats
 * the event as all-day, which for a three day market is the honest reading, so
 * the dates are sent as plain dates.
 *
 * eventAttendanceMode and eventStatus are required for the richer result.
 * Admission is free, which is the single most useful thing a shopper learns
 * from a search result, so it is stated as an Offer at zero rather than left
 * out.
 */
export function eventLd(show: Show) {
  const origin = siteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Mermade Market ${show.name}`,
    description:
      'A hand-curated shop small makers market in Dana Point, California. '
      + 'Around a hundred independent makers, indoors and outdoors, free to attend.',
    startDate: show.startsOn.slice(0, 10),
    endDate: show.endsOn.slice(0, 10),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [`${origin}${img('/photos/og.jpg')}`],
    url: `${origin}/schedule`,
    location: {
      '@type': 'Place',
      name: show.venueName,
      address: ADDRESS(show),
    },
    organizer: { '@type': 'Organization', name: 'Mermade Market', url: origin },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${origin}/schedule`,
      validFrom: show.applicationsOpenAt.slice(0, 10),
    },
  }
}

/** One <script>, escaped so a stray `</script>` in the data cannot close it. */
export function LdJson({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
