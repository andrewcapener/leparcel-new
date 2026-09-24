import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, ArticleRow } from '@/components/theme/Sections'
import { journal, excerpt } from '@/lib/journal'

/* Served from Vercel's cache, re-rendered at most once a minute.
 *
 * This page reads the Show record and nothing per-request: no cookies, no
 * headers, no search params. It was force-dynamic, which meant every visitor
 * woke a serverless function that opened a cold connection to Postgres before
 * rendering a word, and on 24 Sept the first visit after a quiet spell hung
 * for ninety seconds and looked exactly like an outage.
 *
 * Sixty seconds of staleness costs nothing here, since these values change a
 * few times a season, and staff never wait even that long: saving on
 * /admin/show clears the tag (src/db/queries.ts). */
export const revalidate = 60

export const metadata = {
  title: 'Mermade Journal',
  description:
    'Meet the makers behind Mermade Market: interviews, shop stories and what goes on behind a hand-curated market in Dana Point.',
  alternates: { canonical: '/journal' },
}

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
    <SiteShell show={show} template="blog">
          <PageTitle title="Mermade Journal" />
          <ArticleRow heading="" articles={articles} />
        </SiteShell>
  )
}
