import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { AccountHeader, Card, Facts } from '@/app/account/Shell'
import { BoothInvoice } from '@/app/account/BoothInvoice'
import { Checklist } from '@/app/account/Checklist'
import { WhatYouTold, YourDetails, type SubmittedApplication, type SubmittedVendor } from '@/app/account/YourApplication'
import { invoiceFor } from '@/server/modules/payments/invoice'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { settlesInsideWindow, offersCard } from '@/server/modules/payments/methods'
import { checklistFor, clearForLoadIn } from '@/server/modules/compliance/checklist'
import { permitState, permitCleared } from '@/server/modules/compliance/permit'
import { CONTACT_EMAIL, POLICY } from '@/lib/agreement'
import { bpsLabel } from '@/lib/money'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Preview: the maker account', robots: { index: false, follow: false } }

/**
 * What an accepted maker sees, without having to be one.
 *
 * There was no way to look at this. The dashboard only exists for somebody
 * with an accepted application and a booking, so reviewing it meant applying,
 * accepting yourself, and signing in from the email, which is a lot of
 * ceremony to answer "does this read right". Same reasoning as /admin/emails:
 * a screen that only appears under one narrow condition is a screen nobody
 * looks at until a maker is looking at it.
 *
 * This renders the WHOLE page, in order, not just the invoice. An earlier
 * version showed the booth fee alone, which was the one piece that already
 * read well and left the four sections around it unreviewed.
 *
 * The maker is invented and says so. Everything that decides WORDING is real
 * and read from the active Show: the payment window, the payment methods, the
 * commission, the dates, and therefore whether the deadline says "Due" or
 * "Start by". So this page changes when Elise changes a setting, which is the
 * only way it stays honest. A real maker is never rendered here: this page is
 * behind the staff password, but a preview that reached into the roster would
 * put somebody's phone number and permit on a screen meant for checking type.
 *
 * The Pay buttons are inert (`preview`), because a live one would start a
 * checkout against whatever booking the person pressing it happens to own.
 */

const SPACE_CENTS = 26_000
const ENDCAP_CENTS = 4_000

const INVOICE = invoiceFor({
  spaceLabel: '3x4 indoor shelf',
  spacePriceCents: SPACE_CENTS,
  addons: [{ name: 'Corner or endcap, inside', priceCents: ENDCAP_CENTS }],
})

/* An invented maker, shaped like a real submission. Outdoor-capable and an
   occasional seller, because that is the branch with the most to get wrong:
   it is the one track that owes a permit, and the one answer where the next
   move is ours rather than theirs. */
const APP: SubmittedApplication = {
  track: 'both',
  permitStatus: 'occasional',
  sellerPermit: '',
  occasionalSeller: false,
  category: 'Apparel',
  secondaryCategories: '["Home"]',
  description:
    'Naturally dyed linen in indigo, madder and onion skin, cut and sewn into everyday pieces meant to be worn until they go soft.',
  priceLowCents: 4_600,
  priceHighCents: 29_000,
  madeByYou: 'all',
  isMlm: false,
  usesAiArtwork: false,
  submittedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  signedName: 'A. Maker',
  termsVersion: '2026.1',
  photos: '["a.jpg","b.jpg","c.jpg"]',
}

const VENDOR: SubmittedVendor = {
  shopName: 'Example Maker (preview)',
  legalName: null,
  contactName: 'A. Maker',
  email: 'not-a-real-address@example.com',
  phone: '(949) 555-0100',
  instagram: '@examplemaker',
  website: 'https://example.com',
  city: 'Dana Point',
  state: 'CA',
  postalCode: '92629',
}

export default async function PreviewAccount() {
  const show = await activeShow()
  if (!show) {
    return <p className="adm-empty">No active show, so there are no settings to preview against.</p>
  }

  /* A deadline far enough out that the countdown reads normally rather than
     as an emergency, and a paid date in the recent past. */
  const dueAt = new Date(Date.now() + show.paymentWindowHours * 3600_000).toISOString()
  const paidAt = new Date(Date.now() - 3 * 3600_000).toISOString()
  const startOnly = !settlesInsideWindow(show.paymentMethods)

  const common = {
    invoice: INVOICE,
    dueAt,
    vendorCode: 'MM00',
    payable: paymentsConfigured(),
    testMode: isTestMode(),
    methods: show.paymentMethods,
    preview: true as const,
  }

  const checklist = checklistFor({
    applicationStatus: 'accepted',
    track: APP.track,
    booking: { status: 'awaiting_payment', paymentDueAt: dueAt },
    sellerPermit: APP.sellerPermit,
    occasionalSeller: APP.occasionalSeller,
    permitStatus: APP.permitStatus,
    hasCoi: false,
    loadInAt: show.startsOn,
    nowIso: new Date().toISOString(),
    contactEmail: CONTACT_EMAIL,
    startOnly,
  })

  const permitOutstanding = !permitCleared(
    permitState({
      track: APP.track,
      permitStatus: APP.permitStatus,
      sellerPermit: APP.sellerPermit,
      occasionalSeller: APP.occasionalSeller,
    }),
  )

  /* The three states the first pass does not show. Awaiting payment is the
     one rendered in place above, inside the whole page. */
  const otherStates: { key: string; caption: string; status: string; paidAt: string | null }[] = [
    {
      key: 'processing',
      status: 'payment_processing',
      paidAt: null,
      caption:
        'A bank transfer has been authorised and the money is in transit. Their space is held, they are never chased, and they cannot be released for missing the deadline. Card payments never sit here.',
    },
    {
      key: 'confirmed',
      status: 'confirmed',
      paidAt,
      caption:
        'Paid. The only thing that puts a booking here is a verified Stripe webhook, never the maker returning from the payment page.',
    },
    {
      key: 'forfeited',
      status: 'forfeited',
      paidAt: null,
      caption:
        'Released, after you pressed Release on the roster. Deliberately not a dead end: it invites them to write back the same day.',
    },
  ]

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <div className="mk-acct">
        <div className="container">
          <AccountHeader
            shopName={VENDOR.shopName}
            vendorCode={common.vendorCode}
            status="Accepted"
            showName={show.name}
            signOut={false}
          />

          <div className="mk-grid">
            <Card title="About this preview" wide>
              <p className="mk-card__lede">
                The whole maker dashboard, in order, as an accepted maker who has not paid yet
                would see it. The shop, the prices and the answers are invented. The payment
                window, the payment methods, the commission and the dates are read from{' '}
                {show.name}, so this page changes when you change a setting on{' '}
                <Link href="/admin/show">show settings</Link>.
              </p>
              <p className="mk-card__lede">
                {common.payable
                  ? common.testMode
                    ? 'Stripe is connected in test mode, so a real maker would see a working Pay button and a test-mode note.'
                    : 'Stripe is connected in live mode. A real maker would see a working Pay button that takes real money.'
                  : 'Stripe is not connected on this deployment, so a real maker is told the payment page is not live yet rather than being shown a button that fails.'}{' '}
                The buttons here are switched off, because this is a preview.
              </p>
              <p style={{ margin: 0 }}><Link href="/admin">Back to the admin</Link></p>
            </Card>

            <Card title="What we need from you" id="checklist" wide>
              <Checklist
                items={checklist}
                clear={clearForLoadIn(checklist, permitOutstanding)}
                feeDeadlineIsStart={startOnly}
              />
            </Card>

            <BoothInvoice {...common} id="booth-fee" status="awaiting_payment" paidAt={null} />

            <Card title={`Your ${show.name}`}>
              <Facts
                rows={[
                  {
                    label: 'Where it stands',
                    value: <strong>Accepted. Your booth fee is below, and your space is held until you pay it.</strong>,
                  },
                  { label: 'Roster announced', value: fmtDate(show.rosterAnnouncedOn) },
                  { label: 'The show', value: `${fmtDate(show.startsOn)} to ${fmtDate(show.endsOn)}` },
                  { label: 'Where', value: show.venueName },
                  { label: 'Your Mermade ID', value: common.vendorCode },
                ]}
              />
            </Card>

            <YourDetails app={APP} vendor={VENDOR} />

            <Card title="Getting paid" wide>
              <Facts
                rows={[
                  {
                    label: 'Your booth fee',
                    value: offersCard(show.paymentMethods)
                      ? <>Above, on this page. Card or bank transfer, whichever suits you, due within {show.paymentWindowHours} hours of being accepted.</>
                      : <>Above, on this page, by bank transfer. Start it within {show.paymentWindowHours} hours of being accepted and your space is held while it clears.</>,
                  },
                  {
                    label: 'What you sell inside',
                    value: <>We sell at the register, keep {bpsLabel(show.commissionBps)}, and pay you the rest {POLICY.payoutDaysMin} to {POLICY.payoutDays} days after the show closes.</>,
                  },
                  {
                    label: 'Where it lands',
                    value: 'Your own bank account, through Stripe. Setting that up asks who you are and where the money goes, takes about ten minutes, and you only do it once.',
                  },
                  {
                    label: 'When you do it',
                    value: 'Now is a good time. We will email you the link, and your money waits for you if it is not ready by statement day.',
                  },
                  {
                    label: 'What we never do',
                    value: 'Ask you to send money by Zelle, Venmo, a wire, or any link that did not come from us. If someone does, it is not us.',
                  },
                ]}
              />
            </Card>

            <WhatYouTold app={APP} spacesAsked={['3x4 indoor shelf']} />

            <Card title="The booth fee in its other states" wide>
              <p style={{ margin: 0 }}>
                The three the page above does not show. Each one is the same card a maker sees.
              </p>
            </Card>

            {otherStates.map((s) => (
              <div key={s.key} className="mk-grid__wide">
                <Card>
                  <p style={{ margin: 0 }}><strong>{s.status}</strong> &middot; {s.caption}</p>
                </Card>
                <BoothInvoice {...common} id={`booth-fee-${s.key}`} status={s.status} paidAt={s.paidAt} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
