import Link from 'next/link'
import { notFound } from 'next/navigation'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
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
  const at = journal.findIndex((p) => p.slug === slug)
  if (at === -1) notFound()
  const post = journal[at]!
  // The list is newest first, so the next entry is the older article.
  const older = journal[at + 1]
  const newer = journal[at - 1]
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="article">
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

                {/* Their article meta: the date, the tags, and the walk
                    through the archive. Tag pages are theirs, not ours, so a
                    tag reads as a label rather than a link to a route we do
                    not have. */}
                <div className="meta">
                  <span className="iconmeta time">
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString('en-US', {
                        timeZone: 'America/Los_Angeles',
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </time>
                  </span>
                  {post.tags.length > 0 && (
                    <div className="iconmeta tags">
                      <span className="label">Tagged:</span>
                      {post.tags.map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}
                </div>

                <div className="pagination-row pagination-row-tabular">
                  <span className="prev">
                    {older && (
                      <Link href={`/journal/${older.slug}`}>
                        <span className="icon--small icon-natcol has-ltr-icon"><Chevron dir="left" /></span>{' '}
                        <span>Older articles</span>
                      </Link>
                    )}
                  </span>
                  <span className="back"><Link href="/journal">Back to Journal</Link></span>
                  <span className="next">
                    {newer && (
                      <Link href={`/journal/${newer.slug}`}>
                        <span>Newer articles</span>{' '}
                        <span className="icon--small icon-natcol has-ltr-icon"><Chevron dir="right" /></span>
                      </Link>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </SiteShell>
  )
}

/** Their feather chevron, as the article pagination uses it. */
function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={`icon feather feather-chevron-${dir}`} aria-hidden="true" focusable="false" role="presentation">
      <path d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}
