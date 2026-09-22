/**
 * What to call the MM code, per track.
 *
 * One code, two audiences, and they do not read it the same way.
 *
 * Indoor is consignment. The maker is not in the room, we sell for them at
 * the register, and the code is genuinely their identity here: it goes on
 * every price tag and on the statement at the end. "Your Mermade ID" is the
 * right words and has been since the Shopify site.
 *
 * Outdoor is a booth licence. Those makers are given a booth number by the
 * team that lays out the field, and it has nothing to do with this code. So
 * an outdoor maker reading "Your Mermade ID: MM91" reads a space number,
 * turns up looking for booth 91, and writes in to ask where it is. For them
 * the code is one thing only: the reference that lets a person match a Venmo
 * or Zelle payment to a booking, so that is what it is called.
 *
 * The code itself never changes and is never hidden. `payNote()` and the
 * Stripe metadata carry it on both tracks (see manual.ts), because matching
 * money to a maker is what it is for.
 *
 * Pure, and in one place, so the account page, the pasted pay link and the
 * admin preview cannot drift into saying three different things.
 */

export type VendorCodeWords = {
  /** The label beside the code in a list of facts. */
  label: string
  /** A short prefix in the header band, where there is no label column.
   *  Null when the code stands on its own without being misread. */
  headerLabel: string | null
  /** Why the code matters, while there is still money owed. */
  note: string
  /** What the code is NOT. Null on the track where nobody misreads it, and
   *  true whether or not the fee is paid, which is why it is separate. */
  clarify: string | null
}

const INDOOR: VendorCodeWords = {
  label: 'Your Mermade ID',
  headerLabel: null,
  note: 'Put it in the note when you pay, so we can match it to you.',
  clarify: null,
}

const OUTDOOR: VendorCodeWords = {
  label: 'Your payment reference',
  headerLabel: 'Payment reference',
  note: 'Put it in the note when you pay, so we can match it to you.',
  clarify: 'It is not your booth number. Those are assigned separately.',
}

/**
 * The words for one booking's track.
 *
 * Anything that is not plainly outdoor gets the indoor words. An application
 * can say `both`, and a track can be missing on old rows, and in either case
 * the indoor wording is the safe one: it is what every maker has been told
 * until now, and it is the reading that never sends somebody looking for a
 * booth that does not exist.
 */
export function vendorCodeWords(track: string | null | undefined): VendorCodeWords {
  return (track ?? '').trim().toLowerCase() === 'outdoor' ? OUTDOOR : INDOOR
}

/**
 * The one quiet line under the code, or nothing.
 *
 * `stillOwing` drops the payment half once the fee is settled, forfeited or
 * in flight: telling somebody who has already paid to put a reference in the
 * note is the kind of stale instruction that gets a page read as boilerplate.
 * What the code is not survives the payment, because the misreading does.
 */
export function vendorCodeLine(
  words: VendorCodeWords, stillOwing: boolean,
): string | null {
  const bits = [stillOwing ? words.note : null, words.clarify].filter(Boolean)
  return bits.length > 0 ? bits.join(' ') : null
}
