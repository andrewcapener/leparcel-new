import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { Card, Facts, CardNote } from './Shell'
import { permitState, permitProfileLine } from '@/server/modules/compliance/permit'

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
  permitStatus: string | null
  sellerPermit: string
  occasionalSeller: boolean
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

/** Everything they wrote, given back to them. A wide card: these are long
 *  sentences and a narrow column turns each into a five-line stack. */
export function WhatYouTold({
  app, spacesAsked,
}: {
  app: SubmittedApplication
  spacesAsked: string[]
}) {
  const others = list(app.secondaryCategories)
  const photoCount = list(app.photos).length

  return (
    <Card title="What you told us" id="your-application" wide>
      <Facts
        rows={[
          { label: 'Sent', value: fmtDateTime(app.submittedAt) },
          { label: 'Where you want to be', value: TRACK[app.track] ?? app.track },
          ...(spacesAsked.length > 0
            ? [{ label: 'Spaces you asked for', value: spacesAsked.join(' \u00b7 ') }]
            : []),
          { label: 'Category', value: app.category },
          ...(others.length > 0 ? [{ label: 'Also', value: others.join(' \u00b7 ') }] : []),
          { label: 'What you make', value: app.description },
          { label: 'Your prices', value: `${usd(app.priceLowCents)} to ${usd(app.priceHighCents)}` },
          { label: 'Made by you', value: MADE_BY[app.madeByYou] ?? app.madeByYou },
          ...(app.usesAiArtwork ? [{ label: 'Uses AI artwork', value: 'Yes' }] : []),
          ...(app.isMlm ? [{ label: 'MLM or direct sales', value: 'Yes' }] : []),
          {
            label: 'Photographs',
            value: photoCount === 0 ? 'None attached' : `${photoCount} attached`,
          },
          {
            label: 'Signed',
            value: app.signedName
              ? `${app.signedName}, maker agreement ${app.termsVersion}`
              : `Maker agreement ${app.termsVersion}`,
          },
        ]}
      />
      <CardNote>
        Something here wrong? Write to us and we will fix it. We do not let this page edit an
        application once it is in, because the jury reads what you wrote and a form that
        changes underneath them is worse than an email.
      </CardNote>
    </Card>
  )
}

/** Who they are and how to reach them. Short rows, so it sits in a column
 *  beside another short card rather than running the width of the page. */
export function YourDetails({
  app, vendor,
}: {
  app: SubmittedApplication
  vendor: SubmittedVendor
}) {
  const where = [vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(', ')

  /* The permit answer is a fact about them, like their address, not a task.
     Everybody selling outside answers it on the application, so it reads back
     here; the checklist only carries it when something is still theirs to do. */
  const permit = permitProfileLine(
    permitState({
      track: app.track,
      permitStatus: app.permitStatus,
      sellerPermit: app.sellerPermit,
      occasionalSeller: app.occasionalSeller,
    }),
    app.sellerPermit,
  )

  return (
    <Card title="Your details">
      <Facts
        rows={[
          { label: 'Shop', value: vendor.shopName },
          ...(vendor.legalName ? [{ label: 'Legal name', value: vendor.legalName }] : []),
          { label: 'You', value: vendor.contactName },
          { label: 'Email', value: vendor.email },
          { label: 'Phone', value: vendor.phone || 'Not given' },
          { label: 'Instagram', value: vendor.instagram || 'Not given' },
          ...(vendor.website ? [{ label: 'Website', value: vendor.website }] : []),
          { label: 'Where you are', value: where || 'Not given' },
          ...(permit ? [{ label: "Seller's permit", value: permit }] : []),
        ]}
      />
    </Card>
  )
}
