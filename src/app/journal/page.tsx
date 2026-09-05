import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { journal } from '@/lib/journal'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function Journal() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const [lead, ...rest] = journal

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">The journal</div>
        <h1 className="lede" style={{ maxWidth: '20ch' }}>Meet <em>the makers.</em></h1>
        <p>
          Eleven years of shops, studios and kitchens, written up as we met them. The
          oldest ones read like a time capsule.
        </p>
      </section>

      {lead && (
        <section className="sec" style={{ paddingBottom: 0 }}>
          <Link href={`/journal/${lead.slug}`} className="jlead">
            {lead.image
              ? <Photo src={lead.image} alt="" arch tone="soft" sizes="(max-width:900px) 100vw, 46vw" />
              : <div className="jnone" aria-hidden="true" />}
            <div className="tx">
              <div className="k">Latest</div>
              <h2>{lead.title}</h2>
              <div className="dt num">{fmtDate(lead.date)}</div>
              {lead.paras[0] && <p>{lead.paras[0]}</p>}
              <span className="more">Read it →</span>
            </div>
          </Link>
        </section>
      )}

      <section className="sec">
        <div className="shead">
          <span className="k">More</span>
          <h2>From the archive</h2>
        </div>
        <div className="jgrid">
          {rest.map((p) => (
            <Link href={`/journal/${p.slug}`} key={p.slug} className="jcard">
              {p.image
                ? <Photo src={p.image} alt="" arch tone="soft" sizes="(max-width:900px) 50vw, 30vw" />
                : <div className="jnone" aria-hidden="true" />}
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
