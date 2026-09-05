import { activeShow } from '@/db/queries'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import { RichText, ImageWithText } from '@/components/theme/Sections'
import { indoorShots } from '@/lib/lookbook'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Indoor Lookbook' }

/**
 * /pages/indoor-lookbook — their rich-text intro then one
 * `section-image-with-text` per space, alternating sides as theirs does.
 */
export default async function IndoorLookbook() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <AnnouncementBar show={show} />
      <PageHeader />
      <main id="content" role="main">
        <div className="container cf">
          <RichText title="Indoor Merchant Lookbook">
            <p>
              It is proven time &amp; time again that when our merchants&rsquo;
              spaces look their best, they sell more product. Indoor @ Mermade
              are much smaller spaces than any outdoor tent. But it doesn&rsquo;t
              mean they can&rsquo;t look good!! See below of some past examples
              and see how big they actually are.
            </p>
            <p><strong>Remember, vertical space is everything!</strong></p>
          </RichText>

          {indoorShots.map((s, i) => (
            <ImageWithText
              key={s.file}
              image={s.file}
              title={s.title}
              flip={i % 2 === 0}
            >
              <p>{s.body}</p>
            </ImageWithText>
          ))}
        </div>
      </main>
      <PageFooter show={show} />
    </>
  )
}
