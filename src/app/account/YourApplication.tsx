import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { FactTable } from '@/components/theme/Sections'

/**
 * Everything the maker told us, given back to them.
 *
 * An application is the longest form this business asks anybody to fill in,
 * and until now it vanished the moment it was sent: the maker could see a
 * status word and nothing else. Showing it back does three jobs at once. It
 * proves we have what they wrote. It lets them check a phone number or a
 * price range before we act on it. And it is the record they will want in
 * front of them when they write to ask us to change something.
 *
 * Read only, on purpose. Editing an application after a jury has scored it
 * changes the thing that was judged, so corrections go through a person. The
 * page says so rather than leaving a maker hunting for a save button.
 */

const MADE_BY: Record<string, string> = {
  all: 'Everything is made by me',
  mostly_sourced_components: 'Mostly, with sourced components',
  curate_resell: 'I curate and resell',
}

const TRACK: Record<string, string> = {
  indoor: 'Inside, consignment',
  outdoor: 'Outside, my own tent day',
  both: 'Either, whichever we can fit',
}

export type SubmittedApplication = {
  track: string
  category: string
  secondaryCategories: string
  description: string
  priceLowCents: number
  priceHighCents: number
  madeByYou: string
  isMlm: boolean
  usesAiArtwork: boolean
  submittedAt: string
  signedName: string
  termsVersion: string
  photos: string
}

export type SubmittedVendor = {
  shopName: string
  legalName: string | null
  contactName: string
  email: string
  phone: string
  instagram: string
  website: string | null
  city: string
  state: string
  postalCode: string
}

const list = (json: string): string[] => {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function YourApplication({
  app, vendor, spacesAsked,
}: {
  app: SubmittedApplication
  vendor: SubmittedVendor
  spacesAsked: string[]
}) {
  const others = list(app.secondaryCategories)
  const photoCount = list(app.photos).length
  const where = [vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(', ')

  return (
    <div id="your-application">
      <FactTable
        title="What you told us"
        rows={[
          { label: 'Sent', value: fmtDateTime(app.submittedAt) },
          { label: 'Where you want to be', value: TRACK[app.track] ?? app.track },
          ...(spacesAsked.length > 0
            ? [{ label: 'Spaces you asked for', value: spacesAsked.join(' · ') }]
            : []),
          { label: 'Category', value: app.category },
          ...(others.length > 0 ? [{ label: 'Also', value: others.join(' · ') }] : []),
          { label: 'What you make', value: app.description },
          { label: 'Your prices', value: `${usd(app.priceLowCents)} to ${usd(app.priceHighCents)}` },
          { label: 'Made by you', value: MADE_BY[app.madeByYou] ?? app.madeByYou },
          ...(app.usesAiArtwork ? [{ label: 'Uses AI artwork', value: 'Yes' }] : []),
          ...(app.isMlm ? [{ label: 'MLM or direct sales', value: 'Yes' }] : []),
          {
            label: 'Photographs',
            value: photoCount === 0
              ? 'None attached'
              : `${photoCount} attached`,
          },
          {
            label: 'Signed',
            value: app.signedName
              ? `${app.signedName}, maker agreement ${app.termsVersion}`
              : `Maker agreement ${app.termsVersion}`,
          },
        ]}
      />

      <FactTable
        title="Your details"
        rows={[
          { label: 'Shop', value: vendor.shopName },
          ...(vendor.legalName ? [{ label: 'Legal name', value: vendor.legalName }] : []),
          { label: 'You', value: vendor.contactName },
          { label: 'Email', value: vendor.email },
          { label: 'Phone', value: vendor.phone || 'Not given' },
          { label: 'Instagram', value: vendor.instagram || 'Not given' },
          ...(vendor.website ? [{ label: 'Website', value: vendor.website }] : []),
          { label: 'Where you are', value: where || 'Not given' },
        ]}
      />

      <div className="shopify-section section-rich-text">
        <div className="container container--reading-width">
          <p className="rte mk-note">
            Something here wrong? Write to us and we will fix it. We do not let this page edit an
            application once it is in, because the jury reads what you wrote and a form that
            changes underneath them is worse than an email.
          </p>
        </div>
      </div>
    </div>
  )
}
