/**
 * Whether a contact-form submission was typed by a person.
 *
 * Drew, 9 November: "we're getting a bunch of these shits in our contact
 * form." The shape is always the same and it is in the screenshot he sent:
 *
 *     Name:    FgTkXBuVVsDqoIXwXtYi
 *     Email:   louise.bell@ifm.com
 *     Message: jRMZRghinyotErLr
 *
 * A real-looking address with random characters either side of it. The
 * address is the point: whoever runs this is checking which addresses a form
 * will relay mail to, and every one that lands proves hello@ will forward a
 * stranger's text to a human inbox. The form is being used as a tester.
 *
 * Three signals, cheapest first, and NONE of them is a puzzle the visitor has
 * to solve. A maker with a question at eleven at night is the person this
 * form exists for and she is not doing a reCAPTCHA to ask it.
 *
 *   1. A field no human can see. A browser does not fill it and a person
 *      cannot reach it; a script that walks the DOM filling inputs does.
 *   2. How long the form was open. Nobody types a name, an address and a
 *      sentence in two seconds.
 *   3. What was actually typed. Both the name AND the message have to read as
 *      random characters, because a real person sometimes has a name that
 *      looks odd to a machine and almost never also writes a message that
 *      does.
 *
 * Pure and tested, because the cost of being wrong is asymmetric: a false
 * positive is a maker who thinks nobody at Mermade reads their email, which
 * is far worse than a spam message reaching an inbox that already has a
 * delete key (CLAUDE.md rule 10).
 */

export type Verdict =
  /** Send it. */
  | { spam: false }
  /** Drop it. `why` is for the log, never for the visitor. */
  | { spam: true; why: string }

export type Submission = {
  name: string
  email: string
  message: string
  /** The field no human can see. Anything in it at all is a machine. */
  honeypot?: string
  /** Milliseconds the form was open, measured in the browser. */
  elapsedMs?: number
}

/**
 * The floor, in milliseconds.
 *
 * Two seconds is already impossible for three fields, so this is not a close
 * call that a fast typist could lose. It is deliberately not a rate limit: a
 * person who writes twice in a minute because she forgot something is not
 * spamming anybody.
 */
export const MIN_FILL_MS = 2_000

const VOWELS = /[aeiouAEIOU]/
/** Only Latin letters. The vowel test means nothing in any other script. */
const LATIN = /^[A-Za-z]+$/

/**
 * Does this read as keyboard noise?
 *
 * Two independent tells, either of which is enough:
 *
 *   - Too few vowels. English runs near 38 per cent and even the consonant
 *     heavy names run above 26. "FgTkXBuVVsDqoIXwXtYi" is 20.
 *   - Case that flips back and forth. "McDonald" and "O'Brien" flip once.
 *     Four or more flips in one unbroken word is a random generator.
 *
 * Guarded at both ends. Anything under ten letters is left alone, because
 * short names are legitimately strange and there is not enough signal in
 * them. Anything with a space in it is left alone, because this is looking
 * for one machine-made token and not judging a sentence. Anything outside
 * the Latin alphabet is left alone, because the vowel ratio of a name
 * written in Greek, Cyrillic or Chinese says nothing at all, and a filter
 * that cannot read a script must not get a vote on it.
 */
export function readsAsNoise(value: string): boolean {
  const text = value.trim()
  if (/\s/.test(text)) return false
  // Apostrophes and hyphens are part of plenty of real names.
  const letters = text.replace(/['’-]/g, '')
  if (letters.length < 10) return false
  if (!LATIN.test(letters)) return false

  let vowels = 0
  for (const ch of letters) if (VOWELS.test(ch)) vowels += 1
  if (vowels / letters.length < 0.26) return true

  let flips = 0
  for (let i = 1; i < letters.length; i += 1) {
    const a = letters[i - 1]!
    const b = letters[i]!
    if ((a === a.toUpperCase()) !== (b === b.toUpperCase())) flips += 1
  }
  return flips >= 4
}

/** The whole judgement, in the order the signals cost anything. */
export function readSubmission(s: Submission): Verdict {
  if ((s.honeypot ?? '').trim() !== '') return { spam: true, why: 'hidden field was filled in' }

  /* Only when the browser actually reported a number. A missing value is not
     held against anybody: the form needs JavaScript to submit at all, so a
     blank here is a bug on our side or a browser doing something unusual,
     and neither is the visitor's fault. */
  if (typeof s.elapsedMs === 'number' && Number.isFinite(s.elapsedMs)
      && s.elapsedMs >= 0 && s.elapsedMs < MIN_FILL_MS) {
    return { spam: true, why: `submitted in ${s.elapsedMs}ms` }
  }

  /* Both, never either. A person called Krzysztof who writes a real sentence
     gets through, and so does anybody whose message is one odd word. */
  if (readsAsNoise(s.name) && readsAsNoise(s.message)) {
    return { spam: true, why: 'name and message both read as random characters' }
  }

  return { spam: false }
}
