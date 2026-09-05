import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import { Banner } from '@/components/theme/Sections'
import { ContactFormSection } from '@/components/theme/ContactFormSection'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Contact' }

/** /pages/contact — their banner and their contact form. */
export default async function Contact() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <AnnouncementBar show={show} />
      <PageHeader />
      <main id="content" role="main">
        <div className="container cf">
          <Banner
            id="section-contact-banner"
            image="IMG_2793.jpg"
            subheading="We're here for you"
            title="REACH OUT"
            priority
          >
            <p>
              Didn&rsquo;t find what you need on our <Link href="/faq">FAQ page?</Link>{' '}
              Reach out below.
            </p>
          </Banner>

          <div className="shopify-section page-section-spacing">
            <div className="container">
              <div className="spaced-row slim-column-left-layout">
                <ContactFormSection topic="contact" />
              </div>
            </div>
          </div>
        </div>
      </main>
      <PageFooter show={show} />
    </>
  )
}
