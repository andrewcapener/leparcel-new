import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, PageSection, PriceTable, FactTable } from '@/components/theme/Sections'
import { PARTS, agreementVars, fillClause, TERMS_VERSION, CONTACT_EMAIL } from '@/lib/agreement'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Vendor agreement',
  description:
    'The agreement every maker signs when they apply: terms for both tracks, the indoor consignment schedule, and the outdoor booth licence.',
}

/**
 * /agreement — the vendor agreement, in full, as a maker can actually read it.
 *
 * The text is src/lib/agreement.ts; every date, price, rate and window in it
 * is a token filled from the Show record (CLAUDE.md rule 6), and the fee
 * schedule at the bottom is the live space_types and add_ons rows rather than
 * a table typed into prose. Nothing on this page is a number somebody has to
 * remember to update.
 *
 * Structure is the whole job here. A contract nobody can navigate is a
 * contract nobody reads, so: a contents list that jumps to every section, one
 * heading per section, numbered clauses with their own anchors so a maker and
 * a member of staff can name the same clause on the phone, and a reading-width
 * measure the whole way down.
 */
export default async function Agreement() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const vars = agreementVars(show)

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = await activeAddOns(show.id)
  const indoor = spaces.filter((s) => s.track === 'indoor')
  const outdoor = spaces.filter((s) => s.track === 'outdoor')

  return (
    <SiteShell show={show} template="page template-suffix-agreement">
      <PageTitle title="Vendor agreement">
        <p>
          This is what you sign when you apply. Version {TERMS_VERSION}, for{' '}
          {show.name}, {fmtDate(show.startsOn)} to {fmtDate(show.endsOn)}.
        </p>
        <p>
          Part I applies to every maker. Schedule A applies inside, where we
          sell your work for you. Schedule B applies outside, where you sell it
          yourself. If anything here is unclear, ask us before you apply:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </PageTitle>

      <FactTable
        title="The parts that cost money"
        rows={[
          { label: 'Commission inside', value: <><strong>{show.commissionBps / 100}%</strong> of the pre-tax retail price. Nothing outside.</> },
          { label: 'Application fee', value: 'None.' },
          { label: 'Paying for your space', value: `Within ${show.paymentWindowHours} hours of your acceptance, or the offer lapses (2.3).` },
          { label: 'Cancelling', value: 'Non-refundable (3.2). An outdoor day can be carried forward once, if you ask (B6.4).' },
          { label: 'Getting paid inside', value: 'Statement and payment within a week of the last day (A6.2).' },
          { label: 'If an item goes missing', value: 'Credited at retail less commission (A8.4).' },
        ]}
      />

      <PageSection reading className="lg-legal">
        <nav className="lg-contents" aria-labelledby="contents-title">
          <h2 className="lg-contents__title" id="contents-title">Contents</h2>
          <ol className="lg-contents__parts">
            {PARTS.map((part) => (
              <li key={part.id}>
                <a href={`#${part.id}`}>{part.title}</a>
                <ol className="lg-contents__sections">
                  {part.sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`}>
                        <span className="lg-num">{s.n}</span> {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
            <li><a href="#fees">Fee schedule for {show.name}</a></li>
          </ol>
        </nav>
      </PageSection>

      {PARTS.map((part) => (
        <PageSection reading className="lg-legal" key={part.id}>
          <section aria-labelledby={`${part.id}-title`} id={part.id}>
            <h2 className="lg-part__title" id={`${part.id}-title`}>{part.title}</h2>
            {part.scope && <p className="lg-part__scope">{part.scope}</p>}

            {part.sections.map((section) => (
              <section aria-labelledby={`${section.id}-title`} className="lg-section" id={section.id} key={section.id}>
                <h3 className="lg-section__title" id={`${section.id}-title`}>
                  <span className="lg-num">{section.n}</span> {section.title}
                </h3>
                {section.clauses.map((raw) => {
                  const c = fillClause(raw, vars)
                  const body = c.text.filter(Boolean)
                  return (
                    <div className="lg-clause" id={`c-${c.n.replace('.', '-')}`} key={c.n}>
                      <p className="lg-clause__body">
                        <span className="lg-clause__n">{c.n}</span>
                        {c.lead && <strong>{c.lead} </strong>}
                        {body[0]}
                      </p>
                      {body.slice(1).map((p) => (
                        <p className="lg-clause__cont" key={p}>{p}</p>
                      ))}
                      {c.list && (
                        <ul className="lg-clause__list">
                          {c.list.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}

            <p className="lg-backtop"><a href="#contents-title">Back to contents</a></p>
          </section>
        </PageSection>
      ))}

      <PageSection reading className="lg-legal">
        <section aria-labelledby="fees-title" id="fees">
          <h2 className="lg-part__title" id="fees-title">Fee schedule for {show.name}</h2>
          <p className="lg-part__scope">
            These are this show’s prices. The price you pay is the one on your
            acceptance, and it does not change after you have paid it.
          </p>
          {indoor.length > 0 && (
            <PriceTable
              caption={`Inside spaces, ${show.commissionBps / 100}% commission`}
              spaces={indoor}
              extras={extras.filter((a) => a.track === null || a.track === 'indoor')}
            />
          )}
          {outdoor.length > 0 && (
            <PriceTable
              caption="Outside tents, priced per day, no commission"
              spaces={outdoor}
              extras={extras.filter((a) => a.track === 'outdoor')}
            />
          )}
          <p className="lg-backtop"><a href="#contents-title">Back to contents</a></p>
        </section>
      </PageSection>

      <PageSection reading className="lg-legal">
        <div className="rte">
          <h2 className="lg-part__title">Questions before you sign</h2>
          <p>
            Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If a
            clause reads badly to you it probably reads badly to the next maker
            too, and we would rather fix it than argue about it in November.
          </p>
          <p>
            How we handle what you send us is on the{' '}
            <Link href="/privacy">privacy page</Link>. The terms for this website
            are at <Link href="/terms">terms of use</Link>.
          </p>
          <p>
            <Link className="btn btn--primary" href="/apply">Apply to sell</Link>
          </p>
        </div>
      </PageSection>
    </SiteShell>
  )
}
