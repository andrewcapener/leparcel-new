import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, PageSection } from '@/components/theme/Sections'
import { LegalBody, LegalContents } from '@/lib/legal-render'
import { TERMS, legalVars, fillSection, LEGAL_VERSION } from '@/lib/site-terms'
import { CONTACT_EMAIL } from '@/lib/agreement'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terms of use',
  description: 'The terms for this website: who runs it, what is on it, and what we ask of you.',
}

/**
 * /terms — the site, not the vendor relationship.
 *
 * The vendor relationship is /agreement, and this page says so in the first
 * screen so that a maker looking for the wrong one leaves quickly. Privacy is
 * its own page for the same reason: it is the one people arrive looking for.
 */
export default async function Terms() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const vars = legalVars(show)
  const sections = TERMS.map((s) => fillSection(s, vars))

  return (
    <SiteShell show={show} template="page template-suffix-terms">
      <PageTitle title="Terms of use">
        <p>
          These cover this website. Selling with us is covered by the{' '}
          <Link href="/agreement">vendor agreement</Link>, and what we do with
          your information is on the <Link href="/privacy">privacy page</Link>.
        </p>
        <p>Version {LEGAL_VERSION}. Questions to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </PageTitle>

      <PageSection reading className="lg-legal">
        <LegalContents sections={sections} label="On this page" />
        <LegalBody sections={sections} />
      </PageSection>
    </SiteShell>
  )
}
