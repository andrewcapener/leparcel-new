import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { FOUNDED_YEAR } from '@/lib/content'

export const dynamic = 'force-dynamic'

/**
 * Ported from the old site's collaborate + sponsorships pages. The audience
 * numbers and the four tiers are the business's own published figures
 * (mermademarket.com/pages/collaborate, retrieved Sept 2026). No rate card
 * is published anywhere, so none is invented here: the tiers say what is
 * included and the price comes from a conversation.
 */
export default async function Collaborate() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const stats: Array<[string, string]> = [
    ['Repeat attendees', '6,000'],
    ['Instagram followers', '17K'],
    ['On the email list', '10,000'],
    ['Merchants a show', '100+'],
    ['Shows held', '22'],
    ['Since', String(FOUNDED_YEAR)],
  ]

  const tiers: Array<{ name: string; note: string; gets: string[] }> = [
    {
      name: 'Title',
      note: 'One a show',
      gets: [
        'The show carries your name',
        'Logo on every event asset',
        'Premium outdoor booth',
        'Flyer in every bag',
        'Dedicated journal post',
        'Social post and email',
      ],
    },
    {
      name: 'Official',
      note: 'A few a show',
      gets: [
        'Logo on every event asset',
        'Premium outdoor booth',
        'Flyer in every bag',
        'Dedicated journal post',
        'Social post and email',
      ],
    },
    {
      name: 'Supporting',
      note: '',
      gets: [
        'Outdoor booth',
        'Flyer in every bag',
        'Dedicated journal post',
        'Social post and email',
      ],
    },
    {
      name: 'Sponsor',
      note: '',
      gets: [
        'Flyer in every bag',
        'Dedicated journal post',
        'Social post and email',
      ],
    },
  ]

  const creative = [
    'Put your name on the stage',
    'Take the beer garden',
    'Sponsor the e-bike parking',
    'Feed the makers on load-in night',
    'Feed the makers during the show',
    'Keep the hydration stations running',
  ]

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">Sponsorships &amp; collaborations</div>
        <h1 className="lede" style={{ maxWidth: '22ch' }}>Partner with <em>the market.</em></h1>
        <p>
          Twice a year we fill a room in Dana Point with people who came on purpose.
          A partnership here borrows the trust we spent eleven years building, which is
          exactly why we say no to most of them.
        </p>
      </section>

      <div className="facts">
        {stats.map(([k, v]) => (
          <div key={k}>
            <div className="k">{k}</div>
            <div className="v num">{v}</div>
          </div>
        ))}
      </div>

      <section className="sec">
        <div className="shead"><span className="k">01</span><h2>Who is in the room</h2></div>
        <div className="rules">
          <p>
            Our shoppers are local, loyal, and careful. They plan the weekend around the
            show, they bring friends, and they come back in the spring. They are also hard
            to sell to, which is the point: they trust what we put in front of them because
            we have been careful with it since {FOUNDED_YEAR}.
          </p>
          <p>
            That is the whole offer. Not impressions, not a booth in a field. A few thousand
            people who already decided to spend a Saturday with things made by hand, and a
            brand standing next to those things with our name on it.
          </p>
        </div>
      </section>

      <div className="plate">
        <Photo src="/photos/before.jpg" alt="The market on a show morning." />
        <div className="cp">
          <span>{show.name}</span>
          <span>{show.venueName}, Dana Point</span>
        </div>
      </div>

      <section className="sec">
        <div className="shead"><span className="k">02</span><h2>What a partner gets</h2></div>
        <div className="tiers">
          {tiers.map((t) => (
            <div className="tier" key={t.name}>
              <div className="nm">{t.name}</div>
              {t.note && <div className="nt">{t.note}</div>}
              <ul>
                {t.gets.map((g) => <li key={g}>{g}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p style={{
          fontFamily: 'var(--font-j)', fontSize: 13.5, color: 'var(--ink-3)',
          marginTop: 22, maxWidth: '60ch', lineHeight: 1.55,
        }}>
          Rates depend on the show and how early you come to us. Write and we will send the
          current one.
        </p>
      </section>

      <section className="sec" style={{ background: 'var(--paper-2)', paddingTop: 0 }}>
        <div className="shead" style={{ paddingTop: 'clamp(56px,8.5vw,112px)' }}>
          <span className="k">03</span><h2>Or something odder</h2>
        </div>
        <div className="rules">
          <p style={{ marginBottom: 24 }}>
            Some of the best ones were not on a list. These are open every show:
          </p>
        </div>
        <div className="check">
          {creative.map((c) => (
            <div key={c}><span className="bx" aria-hidden="true" />{c}</div>
          ))}
        </div>
      </section>

      <section className="apply">
        <div className="k">Interested</div>
        <h2 style={{ marginTop: 18 }}>Tell us what you <em>have in mind.</em></h2>
        <p>
          Write to{' '}
          <a href="mailto:hello@mermademarket.com?subject=Sponsorship" style={{ textDecoration: 'underline' }}>
            hello@mermademarket.com
          </a>{' '}
          with the word sponsorship, and we&rsquo;ll take it from there.
        </p>
      </section>
      <Footer show={show} />
    </>
  )
}
