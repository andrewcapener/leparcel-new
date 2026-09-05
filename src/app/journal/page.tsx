import { activeShow } from '@/db/queries'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import { PageTitle, ArticleRow } from '@/components/theme/Sections'
import { journal, excerpt } from '@/lib/journal'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mermade Journal' }

/** /blogs/journal — their page title and their article list. */
export default async function Journal() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const articles = journal.map((p) => ({
    href: `/journal/${p.slug}`,
    title: p.title,
    excerpt: excerpt(p),
    image: p.image,
  }))

  return (
    <>
      <AnnouncementBar show={show} />
      <PageHeader />
      <main id="content" role="main">
        <div className="container cf">
          <PageTitle title="Mermade Journal" />
          <ArticleRow heading="" articles={articles} />
        </div>
      </main>
      <PageFooter show={show} />
    </>
  )
}
