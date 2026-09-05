import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { journal } from '@/lib/journal'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function JournalPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = journal.find((p) => p.slug === slug)
  if (!post) notFound()
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />
      <article className="sec" style={{ maxWidth: 860, margin: '0 auto' }}>
        <Link href="/journal" className="more" style={{ marginLeft: 0 }}>← The journal</Link>
        <h1 style={{
          fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const,
          fontSize: 'clamp(34px,5vw,58px)', lineHeight: 0.94, margin: '22px 0 10px',
        }}>{post.title}</h1>
        <div className="k" style={{ marginBottom: 26 }}>{fmtDate(post.date)}</div>
        {post.image && (
          <div style={{ marginBottom: 30 }}>
            <Photo src={post.image} alt="" tone="soft" className="jhero" sizes="(max-width:900px) 100vw, 860px" />
          </div>
        )}
        {post.paras.map((p, i) => (
          <p key={i} style={{
            fontFamily: 'var(--font-g)', fontSize: 19, lineHeight: 1.65,
            color: 'var(--ink-2)', maxWidth: '62ch', marginBottom: 16,
          }}>{p}</p>
        ))}
      </article>
      <Footer show={show} />
    </>
  )
}
