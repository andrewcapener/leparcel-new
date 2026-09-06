/**
 * The internal "a maker applied" email.
 *
 * Every field is here, on purpose. This message is one of the four places an
 * application lives (src/app/actions.ts), and a copy missing a field is not a
 * backup. It goes out alongside a plain-text part, which is what arrives when
 * a client refuses HTML and what the outbox stores: a searchable record beats
 * a pretty one.
 *
 * Being a backup is not an excuse for being a wall. The fields that decide
 * anything get the full width and are read first; the rest go two to a row
 * under named headings, so the whole record is a screen and a bit rather than
 * three, and nothing has been dropped to get there. A field this template does
 * not know about still appears, under "Everything else", because a backup that
 * silently omits a newly added answer is the failure this file exists to
 * prevent.
 *
 * The chrome and the escaping are in shell.ts.
 */
import {
  type Field, button, compactRows, fieldRows, photoStrip, rule, sectionHead, shell,
} from './shell'

/** The six that decide whether to read on, at full width and in bold. */
const LEAD = ['Shop', 'Contact', 'Email', 'Category', 'Track', 'Spaces requested']

/** The rest, in the order a person reads them, two to a row. */
const GROUPS: Array<{ head: string; labels: string[] }> = [
  {
    head: 'Reaching them',
    labels: ['Phone', 'Instagram', 'Website', 'City', 'State'],
  },
  {
    head: 'What they make',
    labels: ['Description', 'Price low', 'Price high', 'Made by them', 'AI artwork', 'MLM'],
  },
  {
    head: 'What they asked for',
    labels: ['Add-ons requested', 'Set-up times', 'Wants Zoom call', 'Seller permit'],
  },
  {
    head: 'For the record',
    labels: ['Submitted (PT)', 'Application ID'],
  },
]

/**
 * Every label these groups place, for the test to check against the canonical
 * SHEET_HEADERS. The first version of this file had "Wants zoom call" with a
 * small z, so the field dropped through into "Everything else": the net worked
 * and the record was intact, but it sat under the wrong heading and nothing
 * said so. The test now fails on any header that is not placed.
 */
export const PLACED_LABELS: string[] = [...LEAD, ...GROUPS.flatMap((g) => g.labels)]

export function staffNoticeHtml({
  heading, sub, fields, cta, photos = [],
}: {
  heading: string
  sub: string
  fields: Field[]
  cta?: { href: string; label: string }
  /** Public urls from our own bucket. The caller has already verified them
   *  (src/app/actions.ts checks the bytes at submit); nothing a maker typed
   *  reaches this. */
  photos?: string[]
}): string {
  const by = new Map(fields.map((f) => [f.label, f]))
  const taken = new Set<string>()

  const lead = LEAD.map((l) => by.get(l)).filter((f): f is Field => Boolean(f))
  lead.forEach((f) => taken.add(f.label))

  const blocks = GROUPS.map(({ head, labels }) => {
    const found = labels.map((l) => by.get(l)).filter((f): f is Field => Boolean(f))
    found.forEach((f) => taken.add(f.label))
    return found.length > 0 ? sectionHead(head) + compactRows(found) : ''
  }).join('')

  // Anything the groups above do not name. Empty today; the safety net for the
  // next answer somebody adds to the form and forgets to add here.
  const rest = fields.filter((f) => !taken.has(f.label))

  return shell({
    pill: 'New application',
    heading,
    sub,
    // The button sits above the record. A notification you have to scroll past
    // its own contents to act on is one you act on later.
    inner: (cta ? button(cta) : '') + rule()
      + fieldRows(lead.map((f) => ({ ...f, strong: true })))
      // The work, before the paperwork. It is what the jury is actually
      // deciding on, and it answers the question faster than any field does.
      + (photos.length > 0 ? sectionHead('The work') + photoStrip(photos) : '')
      + blocks
      + (rest.length > 0 ? sectionHead('Everything else') + compactRows(rest) : ''),
    footer: 'This message is also the backup copy. Every field is above.',
  })
}
