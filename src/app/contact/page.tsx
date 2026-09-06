import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { Banner } from '@/components/theme/Sections'
import { ContactFormSection } from '@/components/theme/ContactFormSection'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Contact',
  description:
    'Get in touch with Mermade Market in Dana Point, California. Questions about applying, sponsoring, collaborating or visiting the show.',
  alternates: { canonical: '/contact' },
}

/** /pages/contact — their banner and their contact form. */
export default async function Contact() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="page template-suffix-contact">
          <Banner
            id="section-contact-banner"
            image="/photos/vases.jpg"
            subheading="We're here for you"
            title="REACH OUT"
            priority
          >
            <p>
              Didn&#39;t find what you need on our <Link href="/faq">FAQ page?</Link>{' '}
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
        </SiteShell>
  )
}
