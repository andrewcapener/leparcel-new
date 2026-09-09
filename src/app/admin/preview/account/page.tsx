import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle } from '@/components/theme/Sections'
import { BoothInvoice } from '@/app/account/BoothInvoice'
import { invoiceFor } from '@/server/modules/payments/invoice'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { deadlineMeans } from '@/server/modules/payments/methods'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Preview: the maker account', robots: { index: false, follow: false } }

/**
 * What an accepted maker sees, all four states on one page.
 *
 * There was no way to look at this without being one. The booth fee screen
 * only exists for somebody with an accepted application and a booking, so
 * reviewing it meant applying, accepting yourself, and signing in from the
 * email, which is a lot of ceremony to answer "does the invoice read right".
 * Same reasoning as /admin/emails: a screen that only appears under one narrow
 * condition is a screen nobody looks at until a maker is looking at it.
 *
 * The numbers are made up and say so. Everything that decides WORDING is real
 * and read from the active Show: the payment window, the payment methods, and
 * therefore whether the deadline says "Due" or "Start by". So this page
 * changes when Elise changes a setting, which is the only way it stays honest.
 *
 * The Pay button is inert here (`preview`), because a live one would start a
 * checkout against whatever booking the person pressing it happens to own.
 */

const SPACE_CENTS = 26_000
const ENDCAP_CENTS = 4_000

const INVOICE = invoiceFor({
  spaceLabel: '3x4 indoor shelf',
  spacePriceCents: SPACE_CENTS,
  addons: [{ name: 'Corner or endcap, inside', priceCents: ENDCAP_CENTS }],
})

export default async function PreviewAccount() {
  const show = await activeShow()
  if (!show) {
    return <p className="adm-empty">No active show, so there are no settings to preview against.</p>
  }

  /* A deadline far enough out that the countdown reads normally rather than
     as an emergency, and a paid date in the recent past. */
  const dueAt = new Date(Date.now() + show.paymentWindowHours * 3600_000).toISOString()
  const paidAt = new Date(Date.now() - 3 * 3600_000).toISOString()

  const common = {
    invoice: INVOICE,
    dueAt,
    vendorCode: 'MM00',
    payable: paymentsConfigured(),
    testMode: isTestMode(),
    methods: show.paymentMethods,
    preview: true as const,
  }

  const states: { key: string; caption: string; status: string; paidAt: string | null }[] = [
    {
      key: 'awaiting',
      status: 'awaiting_payment',
      paidAt: null,
      caption: `Accepted, nothing paid yet. This is what lands when you accept somebody. The deadline row says "${deadlineMeans(show.paymentMethods) === 'be paid by' ? 'Due' : 'Start by'}" because of the payment method setting.`,
    },
    {
      key: 'processing',
      status: 'payment_processing',
      paidAt: null,
      caption: 'A bank transfer has been authorised and the money is in transit. Their space is held, they are never chased, and they cannot be released for missing the deadline. Card payments never sit here.',
    },
    {
      key: 'confirmed',
      status: 'confirmed',
      paidAt,
      caption: 'Paid. The only thing that puts a booking here is a verified Stripe webhook, never the maker returning from the payment page.',
    },
    {
      key: 'forfeited',
      status: 'forfeited',
      paidAt: null,
      caption: 'Released, after you pressed Release on the roster. Deliberately not a dead end: it invites them to write back the same day.',
    },
  ]

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <PageTitle title="Preview: the maker account" />

      <div className="shopify-section section-rich-text">
        <div className="fully-spaced-row--medium">
          <div className="container container--reading-width">
            <p className="rte">
              Every state of the booth fee screen, on one page. The shop, the prices and the
              Mermade ID are invented. The payment window, the payment methods and the wording
              that follows from them are read from {show.name}, so this page changes when you
              change a setting on{' '}
              <Link href="/admin/show">show settings</Link>.
            </p>
            <p className="rte">
              {common.payable
                ? common.testMode
                  ? 'Stripe is connected in test mode, so a real maker would see a working Pay button and a test-mode note.'
                  : 'Stripe is connected in live mode. A real maker would see a working Pay button that takes real money.'
                : 'Stripe is not connected on this deployment, so a real maker is told the payment page is not live yet rather than being shown a button that fails.'}
              {' '}The buttons below are switched off, because this is a preview.
            </p>
          </div>
        </div>
      </div>

      {states.map((s) => (
        <div key={s.key}>
          <div className="shopify-section section-rich-text">
            <div className="container container--reading-width">
              <p className="rte" style={{ borderTop: '1px solid currentColor', paddingTop: '1.2em', opacity: 0.9 }}>
                <strong>{s.status}</strong> · {s.caption}
              </p>
            </div>
          </div>
          <BoothInvoice {...common} id={`booth-fee-${s.key}`} status={s.status} paidAt={s.paidAt} />
        </div>
      ))}
    </SiteShell>
  )
}
