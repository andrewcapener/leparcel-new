/**
 * No en dashes, em dashes, or their neighbours, in anything a visitor reads.
 *
 * docs/12-VOICE.md rules them out of prose, and Drew asked for zero of them
 * anywhere on the site. Most of the copy is ours and can simply be written
 * without them. The exception is the Show record: venue, hours, load-in and
 * take-down are free text typed at /admin/show, usually on a phone, and a
 * phone turns a typed hyphen into an en dash by itself. Nobody is going to
 * notice that happening, so the fix belongs here rather than in a habit.
 *
 * The substitution follows what each dash actually means. An en dash (and the
 * figure dash, the minus sign, and the non-ASCII hyphens a phone produces) is
 * a range, so it becomes "to": "9am - 6pm", "5,000-6,000", "Friday - Sunday".
 * An em dash is punctuation, so it becomes a comma, which is what
 * docs/12-VOICE.md asks for. A plain hyphen is left alone, because "take-down"
 * and "3x4" are not what this is about.
 *
 * The one thing it gets wrong is a British-style en dash used as punctuation,
 * which comes out as "to". That reads oddly, and it is the rarer case by far
 * in copy that is mostly dates, times and prices.
 */

/** Ranges: en dash, figure dash, minus, and the hyphens that are not ASCII. */
const RANGE = /[\u2010\u2011\u2012\u2013\u2212]/g
/** Punctuation: em dash and horizontal bar. */
const BREAK = /[\u2014\u2015]/g
/** Any dash that is not a plain hyphen-minus. */
const FANCY = /[\u2010-\u2015\u2212]/

export function plainDashes(text: string): string {
  return text
    .replace(RANGE, (_m, ...a) => '\u0000RANGE\u0000')
    .replace(BREAK, '\u0000BREAK\u0000')
    // A range joins the two things either side of it, however it was spaced.
    .replace(/\s*\u0000RANGE\u0000\s*/g, ' to ')
    // A break ends a clause, so the space before it goes and a comma takes its
    // place: "supportive — from" becomes "supportive, from".
    .replace(/\s*\u0000BREAK\u0000\s*/g, ', ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
}

/** True when `text` still contains a dash a visitor should never see. */
export function hasFancyDash(text: string): boolean {
  return FANCY.test(text)
}
