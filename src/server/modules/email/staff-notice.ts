/**
 * The internal "a maker applied" email.
 *
 * Every field is here, on purpose. This message is one of the four places an
 * application lives (src/app/actions.ts), and a copy missing a field is not a
 * backup. It goes out alongside a plain-text part, which is what arrives when
 * a client refuses HTML and what the outbox stores: a searchable record beats
 * a pretty one.
 *
 * The chrome and the escaping are in shell.ts.
 */
import { type Field, button, fieldRows, rule, shell } from './shell'

/** Fields worth reading first in a list of twenty-three. */
const LEAD = ['Shop', 'Contact', 'Email', 'Category', 'Track', 'Spaces requested']

export function staffNoticeHtml({
  heading, sub, fields, cta,
}: {
  heading: string
  sub: string
  fields: Field[]
  cta?: { href: string; label: string }
}): string {
  return shell({
    pill: 'New application',
    heading,
    sub,
    // The button sits above the record rather than after it. Twenty-three
    // fields is a long scroll to reach an action, and a notification you have
    // to scroll past its own contents to act on is one you act on later.
    inner: (cta ? button(cta) : '') + rule()
      + fieldRows(fields.map((f) => ({ ...f, strong: LEAD.includes(f.label) }))),
    footer: 'This message is also the backup copy. Every field is above.',
  })
}
