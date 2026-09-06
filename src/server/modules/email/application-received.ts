/**
 * "We have your application", to the maker.
 *
 * Deliberately not the internal notice with different words. That one is a
 * record and carries every field; this one is a receipt, and a receipt that
 * reads back twenty-three answers is a form, not a reassurance. It says what
 * we have, what happens next, and when they will hear, which is the whole of
 * what somebody wants at the moment they press send.
 *
 * It also, now, shows them the room. The first version of this was correct
 * and read like a bank confirming a transfer: a heading, three grey rows and
 * a date. Somebody has just spent twenty minutes describing work they make
 * with their hands and asking to be let in, and the reply is the only thing
 * we send between now and the roster. So it opens with a photograph of the
 * thing they are asking to be part of, full bleed, before it gets to the
 * bookkeeping. The bookkeeping is still all there, underneath.
 *
 * No link to a portal, because there is not one yet. Nothing here asks them to
 * do anything: the next move is ours and the email says so.
 */
import {
  type Field, GOLD, INK, esc, fieldRows, paragraphs, plate, rule, sectionHead,
  shell, standfirst,
} from './shell'

/* One constant, because these get swapped as the photography does. Landscape,
   because a portrait plate at full bleed is most of a phone screen before a
   word of the message. */
const PLATE = { file: 'floor.jpg', alt: 'The room at Mermade Market, shelves and racks under the lights' }

export function applicationReceivedHtml({
  shopName, showName, fields, rosterDate, contactEmail, siteUrl,
}: {
  shopName: string
  showName: string
  /** What they asked for, short: category, track, spaces. */
  fields: Field[]
  /** Already formatted in Pacific time by the caller. */
  rosterDate: string
  contactEmail: string
  /** Absolute origin, for the photograph. */
  siteUrl: string
}): string {
  return shell({
    webFonts: true,
    // Their name, not a metaphor about a stack of paper. The team read
    // "You're in the pile" as cold, and they were right: it describes our
    // side of the desk at the moment somebody is nervous about theirs.
    eyebrow: `Application received · ${showName}`,
    heading: `Thank you, ${shopName}`,
    sub: 'It is in, and there is nothing else you need to do right now.',
    inner:
      plate(`${siteUrl}/photos/${PLATE.file}`, PLATE.alt)
      + `<tr><td style="height:30px;line-height:30px;font-size:0;">&nbsp;</td></tr>`
      + paragraphs([
        'We read every application ourselves, all the way through, and we answer either way.',
      ])
      + standfirst('You will hear from us on', rosterDate)
      + `<tr><td style="height:26px;line-height:26px;font-size:0;">&nbsp;</td></tr>`
      + sectionHead('What we have')
      + fieldRows(fields)
      + rule()
      + paragraphs([
        `If any of that looks wrong, reply to this email or write to <a href="mailto:${esc(contactEmail)}" style="color:${GOLD};text-decoration:underline;">${esc(contactEmail)}</a> and we will fix it.`,
      ]),
    footer: `<strong style="color:${INK};font-weight:600;">Mermade Market</strong><br>A juried market for independent makers · Dana Point, California`,
  })
}
