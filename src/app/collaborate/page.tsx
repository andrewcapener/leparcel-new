import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { Banner, RichText, MultiColumn, ScrollingBanner, StatRow } from '@/components/theme/Sections'
import { ContactFormSection } from '@/components/theme/ContactFormSection'
import * as C from '@/lib/content'

/* Cached and re-rendered at most once a minute. Read-only, nothing
 * per-request, and the Show record it reads changes a few times a season.
 * Being dynamic meant a cold database on the visitor's critical path for no
 * benefit; saving in the admin clears the tag, so staff still see edits at
 * once. See src/app/page.tsx for the incident this came from. */
export const revalidate = 60

export const metadata = {
  title: 'Collaborate',
  description:
    'Work with Mermade Market: brand partnerships, live music, food makers and community collaborations at our Dana Point shop small festival.',
  alternates: { canonical: '/collaborate' },
}

/**
 * /pages/collaborate, section for section: the intro, the sponsor logo
 * marquee, MERSTATS, the two stat rows, the four tiers, the other
 * collaborations, the mark, and the Let's Collab form.
 *
 * The audience numbers and the tier contents are the business's own published
 * figures and the prose is theirs, unedited. No rate card is published
 * anywhere, so none is invented here.
 */
export default async function Collaborate() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const sponsors = [
    { file: 'Screen_Shot_2024-02-26_at_3.47.39_PM.png', width: 100 },
    { file: 'download_3.png', width: 100 },
    { file: 'download_5c129451-6301-469e-8448-aa035e240fe8.png', width: 140 },
    { file: 'Screenshot_2024-09-23_at_9.36.22_AM.png', width: 165 },
    { file: 'los_molino_beer_logo.svg', width: 100 },
    { file: 'download.jpg', width: 155 },
    { file: 'download_4.png', width: 100 },
    { file: 'download_1.jpg', width: 100 },
    { file: 'download_1.png', width: 100 },
  ]

  const tierLines = (lines: string[]) => <>{lines.map((l) => <p key={l}>{l} </p>)}</>

  return (
    <SiteShell show={show} template="page template-suffix-collaborate">
          <RichText primary title="Collaborate">
            <p>{C.mission}</p>
            <p />
            <p>Collaborating with us gives you the locals only advantage. </p>
            <p />
            <p>Previous / Current Sponsors Include:</p>
          </RichText>

          <ScrollingBanner
            id="section-sponsors"
            images={sponsors}
            duration="30s"
            space="90px"
            textSize="50px"
            padding={20}
            headingFont={false}
          />

          <RichText title="MERSTATS">
            <p>
              Our customer base is loyal, sensible and affluent. They are decision
              makers who wear the pants and hold the wallet. They&#39;re keen on
              intention and balance. They&#39;re not easily sold, but faithful to
              a fault. They are lifers.
            </p>
            <p />
            <p>
              Through the years we&#39;ve been meticulous about who and what we
              put in front of our people. This has given us a unique advantage in
              our local community, and gives you the opportunity to build trust.
            </p>
          </RichText>

          {/* Every figure here is the founders' own, given by Elise and Drew on
              23 Sept 2026, and each replaces a older number carried over from
              the Shopify site. docs/09-CONTENT-AUDIT.md section 5: publish only
              what you can source, because one soft number inverts the whole
              effect of the rest.

              Two carry a caveat worth keeping next to them. The Instagram
              count is "I think we have 19k" and wants ten seconds in the app
              to confirm. The attendance figure is Elise's "4-5k" with no label
              attached; it is rendered as attendance per show because that is
              what a range of that size describes, and the old label said
              "repeat attendees", which is a different and larger claim. */}
          <StatRow
            id="section-merstats-1"
            stats={[
              { value: '4,000-5,000', label: 'Attendance per show' },
              { value: '19k', label: 'Followers on Instagram' },
              { value: '13', label: 'Years deep' },
            ]}
          />
          <StatRow
            id="section-merstats-2"
            stats={[
              { value: '100+', label: 'Makers per show' },
              { value: '23', label: 'Past shows' },
              { value: '12,000', label: 'Email subscribers' },
            ]}
          />

          <RichText title="Sponsorship Opportunities">
            <p />
          </RichText>

          <MultiColumn
            id="section-tiers"
            scheme
            titles={['Title Sponsor', 'Official Sponsor', 'Supporting Sponsor', 'Sponsor']}
            columns={[
              tierLines([
                'Flyers in every bag', 'Dedicated Blog Post', 'Social Post', 'Email Blast',
                'Premium Outdoor Booth', 'Logo on all event assets', 'Mermade Market sponsored by You',
              ]),
              tierLines([
                'Flyers in every bag', 'Dedicated Blog Post', 'Social Post', 'Email Blast',
                'Premium Outdoor Booth', 'Logo on all event assets',
              ]),
              tierLines([
                'Flyers in every bag', 'Dedicated Blog Post', 'Social Post', 'Email Blast',
                'Outdoor Booth',
              ]),
              tierLines([
                'Flyers in every bag', 'Dedicated Blog Post', 'Social Post', 'Email Blast',
              ]),
            ]}
          />

          <RichText scheme>
            <p><strong>Other Creative Collaborations </strong></p>
            <p>Sponsor Merstage </p>
            <p>Sponsor Beer Garden </p>
            <p>Sponsor E-Bike Parking</p>
            <p>Feed our makers (setup night) </p>
            <p>Feed our makers (during event) </p>
            <p>Fuel our hydration stations</p>
            <p />
            <p>
              In support of shopping small and thinking big - we&#39;re also
              open to hear your ideas on how we can collaborate.
            </p>
          </RichText>

          <RichText mark="Screen_Shot_2024-01-24_at_4.04.24_PM.png" markWidth={260}>
            <></>
          </RichText>

          <ContactFormSection heading="Let's Collab" topic="collaborate" />

          <ScrollingBanner
            id="section-collab-banner"
            text="LETS COLLABORATE AND CHANGE THE WORLD. AND BY WORLD WE MEAN OUR COMMUNITY."
          />

          {/* Their closing full-bleed photograph, a one-slide slideshow. */}
          <Banner
            id="section-collab-close"
            image="/photos/backdrop.jpg"
            title=""
            heightMobile={460}
            heightDesktop={600}
            shadow={false}
          />
        </SiteShell>
  )
}
