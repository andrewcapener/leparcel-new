import { notFound } from 'next/navigation'
import { activeShow } from '@/db/queries'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import { journal } from '@/lib/journal'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = journal.find((p) => p.slug === slug)
  return { title: post?.title ?? 'Journal' }
}

/**
 * /blogs/journal/:handle — their article template: a full-bleed hero, the
 * title in a `page-header`, and the body in a reading-width rich text.
 */
export default async function JournalPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = journal.find((p) => p.slug === slug)
  if (!post) notFound()
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <>
      <AnnouncementBar show={show} />
      <PageHeader />
      <main id="content" role="main">
        <div className="container cf">
          <div className="shopify-section page-section-spacing">
            {post.image && (
              <div className="article-image article-image--large align-center">
                <div className="page-header page-header--with-background img-fill page-header--padded-huge">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt={post.title}
                    loading="eager"
                    sizes="100vw"
                    className="theme-img"
                  />
                  <div className="text-overlay text-overlay--inline" />
                </div>
              </div>
            )}
            <div className="container">
              <div className="page-header cf">
                <h1 className="majortitle">{post.title}</h1>
              </div>
            </div>
            <div className="article article--main">
              <div className="container container--reading-width">
                {/* Their article body, as they wrote it. See src/lib/journal.ts. */}
                <div
                  className="rte cf spaced-row"
                  dangerouslySetInnerHTML={{ __html: post.body }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <PageFooter show={show} />
    </>
  )
}
