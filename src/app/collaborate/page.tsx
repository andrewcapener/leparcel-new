import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { MessageForm } from '@/components/MessageForm'
import { FOUNDED_YEAR, mission } from '@/lib/content'

export const dynamic = 'force-dynamic'

/**
 * /pages/collaborate on the live site, section for section: the intro, the
 * MERSTATS block, the four sponsorship tiers, the other collaborations, and
 * the "Let's Collab" form. The audience numbers and the tier contents are the
 * business's own published figures (retrieved Sept 2026) and the prose is
 * theirs. No rate card is published anywhere, so none is invented here: the
 * tiers say what is included and the price comes from a conversation.
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
      <section className="claim">
        <div className="k">Collaborate</div>
        <h1 className="lede">The locals only<br /><em>advantage.</em></h1>
        <p>{mission}</p>
        <p>Collaborating with us gives you the locals only advantage.</p>
      </section>

      <div className="shead" style={{ padding: '0 var(--pad)', marginBottom: 20 }}>
        <span className="k">Merstats</span>
      </div>
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
            Our customer base is loyal, sensible and affluent. They are decision
            makers who wear the pants and hold the wallet. They&rsquo;re keen on
            intention and balance. They&rsquo;re not easily sold, but faithful to
            a fault. They are lifers.
          </p>
          <p>
            Through the years we&rsquo;ve been meticulous about who and what we
            put in front of our people. This has given us a unique advantage in
            our local community, and gives you the opportunity to build trust.
          </p>
        </div>
      </section>

      <div className="plate">
        <Photo src="/photos/before.jpg" alt="The market on a show morning." />
        <div className="cp">
          <span>{show.name}</span>
          <span>Dana Point {show.venueName}</span>
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
          fontFamily: 'var(--font-j)', fontSize: 'var(--t-lbl)', color: 'var(--ink-3)',
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

      <section className="sec">
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <div className="shead"><span className="k">04</span><h2>Let&rsquo;s collab</h2></div>
          <p className="rules" style={{ marginBottom: 26 }}>
            In support of shopping small and thinking big, we&rsquo;re also open
            to hear your ideas on how we can collaborate.
          </p>
          <MessageForm topic="collaborate" />
        </div>
      </section>

      <section className="apply">
        <h2>
          Let&rsquo;s collaborate and change the world.{' '}
          <em>And by world we mean our community.</em>
        </h2>
      </section>
      <Footer show={show} />
    </>
  )
}
