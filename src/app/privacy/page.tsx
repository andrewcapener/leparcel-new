import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, PageSection } from '@/components/theme/Sections'
import { LegalBody, LegalContents } from '@/lib/legal-render'
import { PRIVACY, legalVars, fillSection, LEGAL_VERSION } from '@/lib/site-terms'
import { CONTACT_EMAIL } from '@/lib/agreement'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Privacy',
  description:
    'What this site collects, why, where it goes, and the one thing to know about application photographs.',
}

/**
 * /privacy — its own page rather than a section of /terms.
 *
 * It is the page people come looking for by name, it is the one a maker wants
 * before uploading a photograph, and the application links to it directly.
 * Burying it inside the terms would cost a click at exactly the wrong moment.
 *
 * Every claim on it is checked against the code that makes the claim true.
 * The list of which file backs which sentence is at the top of
 * src/lib/site-terms.ts, and it is part of the deal: change one of those
 * files and this page changes with it.
 */
export default async function Privacy() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const vars = legalVars(show)
  const sections = PRIVACY.map((s) => fillSection(s, vars))

  return (
    <SiteShell show={show} template="page template-suffix-privacy">
      <PageTitle title="Privacy">
        <p>
          What we collect, why we have it, and who else touches it. Version{' '}
          {LEGAL_VERSION}. Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with anything
          this page does not answer.
        </p>
        <p>
          The <Link href="/terms">terms of use</Link> cover the site itself, and
          the <Link href="/agreement">maker agreement</Link> covers selling
          with us.
        </p>
      </PageTitle>

      <PageSection reading className="lg-legal">
        <LegalContents sections={sections} label="On this page" />
        <LegalBody sections={sections} />
      </PageSection>
    </SiteShell>
  )
}
