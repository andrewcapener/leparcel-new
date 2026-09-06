/**
 * "We have your application", to the maker.
 *
 * Deliberately not the internal notice with different words. That one is a
 * record and carries every field; this one is a receipt, and a receipt that
 * reads back twenty-three answers is a form, not a reassurance. It says what
 * we have, what happens next, and when they will hear, which is the whole of
 * what somebody wants at the moment they press send.
 *
 * No link to a portal, because there is not one yet. Nothing here asks them to
 * do anything: the next move is ours and the email says so.
 */
import { type Field, esc, fieldRows, paragraphs, rule, shell } from './shell'

export function applicationReceivedHtml({
  shopName, showName, fields, rosterDate, contactEmail,
}: {
  shopName: string
  showName: string
  /** What they asked for, short: category, track, spaces. */
  fields: Field[]
  /** Already formatted in Pacific time by the caller. */
  rosterDate: string
  contactEmail: string
}): string {
  return shell({
    pill: 'Application received',
    heading: "You're in the pile",
    sub: `${shopName} · ${showName}`,
    inner:
      paragraphs([
        'Thank you. Your application is in and nothing else is needed from you right now.',
        `We read every one of them, and we answer either way. The roster goes out on <strong style="color:#171717;">${esc(rosterDate)}</strong>.`,
      ])
      + rule()
      + fieldRows(fields)
      + paragraphs([
        `If something in this looks wrong, reply to this email or write to <a href="mailto:${esc(contactEmail)}" style="color:#bc9658;text-decoration:underline;">${esc(contactEmail)}</a> and we will fix it.`,
      ]),
    footer: 'Mermade Market · Dana Point, California',
  })
}
