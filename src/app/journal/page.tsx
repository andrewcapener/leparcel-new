import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { journal } from '@/lib/journal'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function Journal() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show.')

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">The journal</div>
        <p className="lede" style={{ maxWidth: '20ch' }}>Meet <em>the makers.</em></p>
      </section>

      <section className="sec">
        <div className="jgrid">
          {journal.map((p) => (
            <Link href={`/journal/${p.slug}`} key={p.slug} className="jcard">
              {p.image && (
                <Photo src={p.image} alt="" arch tone="soft" sizes="(max-width:900px) 50vw, 30vw" />
              )}
              <div className="nm">{p.title}</div>
              <div className="dt num">{fmtDate(p.date)}</div>
            </Link>
          ))}
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
