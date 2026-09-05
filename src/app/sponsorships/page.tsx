import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, ScrollingBanner } from '@/components/theme/Sections'
import * as C from '@/lib/content'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Sponsorships' }

/**
 * /pages/sponsorships — a short page on the live site: the title, the intro,
 * and the sponsor logo marquee. The detail is on /collaborate, so this links
 * there rather than repeating it.
 */
export default async function Sponsorships() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const sponsors = [
    { file: 'Screen_Shot_2024-02-26_at_3.47.39_PM.png', width: 100 },
    { file: 'download_3.png', width: 100 },
    { file: 'download_5c129451-6301-469e-8448-aa035e240fe8.png', width: 140 },
    { file: 'los_molino_beer_logo.svg', width: 100 },
    { file: 'download.jpg', width: 155 },
    { file: 'download_4.png', width: 100 },
    { file: 'download_1.jpg', width: 100 },
    { file: 'download_1.png', width: 100 },
  ]

  return (
    <SiteShell show={show} template="page template-suffix-sponsorships">
          <PageTitle title="Sponsorships" />

          <RichText cta={{ href: '/collaborate', label: 'See what a partner gets' }}>
            <p>{C.mission}</p>
            <p />
            <p>Collaborating with us gives you the locals only advantage. </p>
            <p />
            <p>Previous / Current Sponsors Include:</p>
          </RichText>

          <ScrollingBanner
            id="section-sponsor-logos"
            images={sponsors}
            duration="30s"
            space="90px"
            textSize="50px"
            padding={20}
            headingFont={false}
          />
        </SiteShell>
  )
}
