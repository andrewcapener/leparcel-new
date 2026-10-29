import { readLine, type LineInput } from './lines'

/**
 * What the item list says back to a maker, from a fixed table.
 *
 * The complaint used to travel in the query string as its own sentence, and
 * the page rendered whatever arrived into a styled notice. React escapes it,
 * so there was no script to run, but any text at all could be made to appear
 * as an official Mermade message on the real domain, two cards above the
 * paragraph promising we never ask for bank details by email. A link is
 * enough:  /account?inv=Payouts+are+delayed,+send+your+bank+details+to...
 *
 * So the wire now carries a CODE, and the words live here.
 *
 * Validation complaints are the exception, because they are genuinely about
 * what the maker typed. Those are not carried either: the typed values come
 * back (they already did, so nothing is retyped) and the sentence is
 * regenerated from them by the same pure function that refused them. Same
 * words, derived rather than echoed.
 */
export const INV_CODES = {
  saved: null,
  removed: null,
  sent: null,
  expired: 'Your sign-in has run out. Ask for a new link and try again.',
  nomaker: 'We could not find your maker record. Write to us and we will sort it out.',
  nospace: 'You do not have a space at this show yet, so there is nowhere to put a list.',
  noshow: 'There is no show open right now.',
  gone: 'That line is no longer on your list.',
  empty: 'There is nothing on your list yet.',
  shut: 'The list is closed. Write to us and we will make the change.',
  dberr: 'We could not save that just then. Try again, and if it keeps happening write to us.',
} as const

export type InvCode = keyof typeof INV_CODES

export const isInvCode = (v: unknown): v is InvCode =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(INV_CODES, v)

/**
 * The sentence for what came back, or null when there is nothing to say.
 *
 * Anything unrecognised is nothing to say, which is the point: a code that is
 * not in the table cannot put words on the page.
 */
export function invMessage(
  raw: string | undefined, typed?: Partial<LineInput>,
): string | null {
  if (raw === 'bad') {
    const read = readLine({
      label: typed?.label ?? '', price: typed?.price ?? '',
      bundleQty: typed?.bundleQty ?? '', bundlePrice: typed?.bundlePrice ?? '',
    })
    /* Led by what happened, because the complaint on its own does not read
       as one. Drew typed a price, pressed Add, and got "A bundle is two or
       more." in the same grey as the two paragraphs of help above it. He
       read it as instructions, tried again, and reported three times that
       nothing saved. It was refusing him every time and never said so. */
    return 'bad' in read ? `That line was not added. ${read.bad}` : null
  }
  if (!isInvCode(raw)) return null
  return INV_CODES[raw]
}
