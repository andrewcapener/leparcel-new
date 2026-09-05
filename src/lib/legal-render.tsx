/**
 * The two pieces of markup /terms and /privacy share: a contents list, and
 * the body.
 *
 * It lives in src/lib rather than src/components/theme because it is not a
 * theme section: it renders the content in src/lib/site-terms.ts and nothing
 * else, and it belongs next to it.
 *
 * The markup is the site's own `.rte` prose style, so a legal page reads like
 * the rest of the site instead of like a PDF someone pasted in. Everything
 * else is in the `lg-` block at the end of public/theme/local.css.
 */
import type { LegalSection } from './site-terms'

export function LegalContents({
  sections, label, id = 'contents',
}: {
  sections: LegalSection[]
  label: string
  id?: string
}) {
  return (
    <nav className="lg-contents" aria-labelledby={`${id}-title`}>
      <h2 className="lg-contents__title" id={`${id}-title`}>{label}</h2>
      <ol className="lg-contents__sections lg-contents__sections--flat">
        {sections.map((s) => (
          <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
        ))}
      </ol>
    </nav>
  )
}

export function LegalBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="rte lg-prose">
      {sections.map((s) => (
        <section aria-labelledby={`${s.id}-title`} className="lg-section" id={s.id} key={s.id}>
          <h2 className="lg-section__title" id={`${s.id}-title`}>{s.title}</h2>
          {s.body.map((b, i) =>
            Array.isArray(b)
              ? (
                <ul className="lg-clause__list" key={`${s.id}-${i}`}>
                  {b.map((item) => <li key={item}>{item}</li>)}
                </ul>
                )
              : <p key={`${s.id}-${i}`}>{b}</p>)}
        </section>
      ))}
    </div>
  )
}
