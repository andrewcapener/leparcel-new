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

/**
 * The name to greet somebody by.
 *
 * Their first name, because this is the one warm message in the sequence and
 * a shop name in the greeting reads like an invoice. Everything else about
 * the application is filed under the shop, and the shop is named in the line
 * underneath and again in the record, so nothing is lost by not leading with
 * it.
 *
 * The first whitespace-separated word, with any trailing punctuation off.
 * Two people who share a shop often type "Sarah and Tom" and "Sarah" is the
 * right greeting for that. Anything that leaves nothing usable, an empty
 * field or a string of symbols, falls back to the shop name, which is never
 * empty because the form requires it.
 */
export function firstName(contactName: string, shopName: string): string {
  const first = contactName.trim().split(/\s+/)[0] ?? ''
  const clean = first.replace(/[^\p{L}\p{N}'-]+$/u, '')
  return clean.length > 0 ? clean : shopName
}

export function applicationReceivedHtml({
  shopName, contactName, showName, fields, rosterDate, contactEmail, siteUrl,
}: {
  shopName: string
  /** Their own name. The greeting uses the first word of it. */
  contactName: string
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
    // Their own first name. It was "You're in the pile", which the team read
    // as cold and which described our side of the desk at the moment somebody
    // is nervous about theirs; then it was the shop name, which is how an
    // invoice greets you. The shop is on the next line and in the record.
    eyebrow: `Application received · ${showName}`,
    heading: `Thank you, ${firstName(contactName, shopName)}`,
    sub: `${shopName} is in for ${showName}, and there is nothing else you need to do right now.`,
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
