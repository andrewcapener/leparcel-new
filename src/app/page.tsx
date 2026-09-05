import Link from 'next/link'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { shows, bookings, vendors, applications } from '@/db/schema'
import { Photo } from '@/components/Photo'
import { FilmBlock } from '@/components/FilmBlock'
import { Masthead, Footer } from '@/components/site'
import { SubscribeForm } from '@/components/SubscribeForm'
import { fmtRange, fmtDate, applicationWindow } from '@/lib/dates'
import { usd } from '@/lib/money'
import * as C from '@/lib/content'
import { journal } from '@/lib/journal'

export const dynamic = 'force-dynamic'

/** Fact tiles derive from the Show record (CLAUDE.md rule 6), never a literal. */

function showDays(show: { startsOn: string; endsOn: string }) {
  const ms = new Date(show.endsOn).getTime() - new Date(show.startsOn).getTime()
  return Math.round(ms / 86_400_000) + 1
}

const FEATURED = [
  { photo: '/photos/mk1.jpg', line: 'Wheel-thrown stoneware' },
  { photo: '/photos/mk2.jpg', line: 'Letterpress & risograph' },
  { photo: '/photos/mk3.jpg', line: 'Naturally dyed linen' },
  { photo: '/photos/mk4.jpg', line: 'Small-batch skin & scent' },
]

export default async function Home() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  // The roster is GENERATED from confirmed bookings — never a hand-kept list.
  const roster = await db
    .select({
      shopName: vendors.shopName,
      vendorCode: bookings.vendorCode,
      category: applications.category,
      priceLowCents: applications.priceLowCents,
      priceHighCents: applications.priceHighCents,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .where(and(eq(bookings.showId, show.id), eq(bookings.status, 'confirmed')))
    .orderBy(asc(vendors.shopName))

  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)

  return (
    <>
      <Masthead show={show} />

      {/* ── 1 · HERO ────────────────────────────────────────────────
          Dates, "free", and one action above the fold. The single
          biggest miss the content audit found. */}
      <Photo src="/photos/hero.jpg" alt="" priority className="hero">
          <img className="stamp" src="/mermade-ribbon.png" alt="" />
          <div className="in">
            <div className="eyebrow">Shop Small Festival</div>
            <h1>
              A hundred makers,
              <br />
              chosen <em>one at a time.</em>
            </h1>
            <div className="bar">
              <span className="when num">{fmtRange(show.startsOn, show.endsOn)}</span>
              <span className="free">Free admission</span>
              <span className="when" style={{ fontSize: 16, opacity: 0.75 }}>
                {show.venueName} · Dana Point
              </span>
              <a href={`/api/calendar/${show.slug}`} className="cal">
                Add to calendar ↓
              </a>
            </div>
          </div>
      </Photo>

      {/* ── 3 · FACTS + PRESS ───────────────────────────────────── */}
      <div className="facts">
        <div>
          <div className="k">Admission</div>
          <div className="v num">Free</div>
        </div>
        <div>
          <div className="k">Days</div>
          <div className="v num">{showDays(show)}</div>
        </div>
        <div>
          <div className="k">Makers</div>
          <div className="v num">{roster.length >= 24 ? roster.length : '100+'}</div>
        </div>
        <div>
          <div className="k">Since</div>
          <div className="v num">2015</div>
        </div>
      </div>
      {C.press.verified && (
        <div className="pressline">
          <span className="q">“{C.press.quote}”</span>
          {C.press.outlets.map((o) => (
            <span className="cn" key={o}>
              {o}
            </span>
          ))}
        </div>
      )}

      {/* ── 4 · FOUNDER LETTER ──────────────────────────────────── */}
      <section className="letter">
        <figure className="fig">
          <Photo
            src={C.founderLetter.photo}
            alt=""
            arch
            tone="soft"
            sizes="(max-width:900px) 100vw, 34vw"
          />
          {!C.founderLetter.photoIsPlaceholder && (
            <figcaption className="cap">{C.founderLetter.photoCaption}</figcaption>
          )}
        </figure>
        <div>
          <div className="k" style={{ marginBottom: 20 }}>
            {C.founderLetter.eyebrow}
          </div>
          <h2>{C.founderLetter.heading}</h2>
          {C.founderLetter.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="sig">{C.founderLetter.signature}</div>
          <div className="role">{C.founderLetter.role}</div>
        </div>
      </section>

      {/* ── 5 · PLATE ───────────────────────────────────────────── */}
      <div className="plate">
        <Photo src="/photos/floor.jpg" alt="" />
        <div className="cp">
          <span>Mermade Market</span>
          <span>Dana Point, California</span>
        </div>
      </div>

      {/* ── 6 · WHAT YOU'LL FIND — her real question ────────────── */}
      <section className="sec" id="merchants">
        <div className="shead">
          <span className="k">01</span>
          <h2>What you’ll find</h2>
          {roster.length > 0 && (
            <Link href="/#directory" className="more">
              All merchants →
            </Link>
          )}
        </div>
        <div className="cats">
          {C.categoryRanges.map((c) => (
            <div className="row" key={c.label}>
              <span className="l">{c.label}</span>
              <span className="rt num">{c.range}</span>
            </div>
          ))}
        </div>
        {roster.length >= 4 && (
        <div className="grid4">
          {roster.slice(0, 4).map((m, i) => (
            <div key={m.vendorCode}>
              <Photo
                src={FEATURED[i]!.photo}
                alt=""
                arch
                tone="soft"
                sizes="(max-width:900px) 50vw, 23vw"
              />
              <div className="nm">{m.shopName}</div>
              <div className="mm">
                {m.vendorCode} · {m.category}
              </div>
              <div className="pr">
                {FEATURED[i]!.line} · {usd(m.priceLowCents)}-{usd(m.priceHighCents)}
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      {/* ── 7 · VISITING — promoted; converts "maybe" into "going" ── */}
      <section className="sec" id="visiting">
        <div className="shead">
          <span className="k">02</span>
          <h2>Visiting</h2>
        </div>
        <div className="prows air">
          <div className="row">
            <span className="q">When</span>
            <span className="a num">{show.hoursNote}</span>
          </div>
          {C.visiting.map((v) => (
            <div className="row" key={v.q}>
              <span className="q">{v.q}</span>
              <span className="a">{v.a}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8 · FILM — real archive footage, played on click ────── */}
      <FilmBlock />

      {/* ── 8b · THE JOURNAL — real shop names, real faces ──────── */}
      <section className="sec">
        <div className="shead">
          <span className="k">03</span>
          <h2>Meet the makers</h2>
          <Link href="/journal" className="more">The journal →</Link>
        </div>
        <div className="jgrid">
          {journal.slice(0, 3).map((jp) => (
            <Link href={`/journal/${jp.slug}`} key={jp.slug} className="jcard">
              {jp.image
                ? <Photo src={jp.image} alt="" arch tone="soft" sizes="(max-width:900px) 50vw, 30vw" />
                : <div className="jnone" aria-hidden="true" />}
              <div className="nm">{jp.title}</div>
              <div className="dt num">{new Date(jp.date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', year: 'numeric' })}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 9 · ELEVEN YEARS — archive demoted to a teaser ──────── */}
      <section className="dark" id="archive">
        <div className="k" style={{ color: '#8A8377' }}>
          {C.archiveNote.eyebrow}
        </div>
        <h2 style={{ marginTop: 20 }}>{C.archiveNote.heading}</h2>
        <p>{C.archiveNote.body}</p>
        {C.films.slice(1).map((f) => (
          <a key={f.youtubeId} className="more" target="_blank" rel="noreferrer"
            href={`https://www.youtube.com/watch?v=${f.youtubeId}`}>
            Watch: {f.label} ↗
          </a>
        ))}
        {/* Rows render only once sourced from the real records. docs/09 §5:
            one soft number inverts the institutional effect. */}
        {!C.ARCHIVE_IS_PLACEHOLDER && (
          <div className="mini">
            {C.archiveRows.map((r) => (
              <div className="row" key={r.numeral}>
                <span className="sh">{r.numeral}</span>
                <span>{r.season}</span>
                <span>{r.venue}</span>
                <span>{r.merchants} merchants</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 10 · EMAIL — the biggest revenue miss on the old page ── */}
      <section className="sub">
        <div>
          <h2>{C.newsletter.heading}</h2>
          <p>{C.newsletter.body}</p>
        </div>
        <SubscribeForm fine={C.newsletter.fine} />
      </section>

      {/* ── 11 · MERCHANTS — linked, because a directory is an asset ── */}
      {roster.length > 0 && (
        <section className="sec" id="directory">
          <div className="shead">
            <span className="k">05</span>
            <h2>{show.name} merchants</h2>
            <span className="more">{roster.length} confirmed</span>
          </div>
          <div className="dir">
            {roster.map((m) => (
              <a href="#" key={m.vendorCode}>
                {m.shopName}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── 12 · APPLY ─────────────────────────────────────────── */}
      <section className="apply">
        <div className="k">For makers</div>
        <h2 style={{ marginTop: 18 }}>
          {win === 'before'
            ? `Applications for ${show.name} open ${fmtDate(show.applicationsOpenAt, { year: undefined })}.`
            : win === 'open'
              ? `Applications for ${show.name} close ${fmtDate(show.applicationsCloseAt, { year: undefined })}.`
              : `Applications for ${show.name} are closed.`}
        </h2>
        <p>
          Indoor makers drop off their work and we sell it for them, for{' '}
          {show.commissionBps / 100}%. Outdoor makers run a tent and keep every dollar.
          The application is one form and it costs nothing.
        </p>
        <div className="cta">
          <Link href="/apply" className="btn">
            {win === 'closed' ? 'Join the waitlist' : 'Apply to sell'}
          </Link>
        </div>
        <div className="fine">Every application is read and answered either way</div>
      </section>

      <Footer show={show} />
    </>
  )
}
