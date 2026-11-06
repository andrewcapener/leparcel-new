/**
 * A maker's item list: what the register needs to know to sell their work.
 *
 * ── what a line actually is ──────────────────────────────────────────────
 * Not a SKU, and not stock. Hillary's instruction to makers has always been
 * a price list, and her own example is the specification:
 *
 *     MM15 Maggie's Maps:
 *     Maps: $5 or buy 2/$8
 *     Stickers/Maps/gift tags: $7
 *     Table cloths / Backpacks: $20 or buy 2/$36
 *
 * So one line is a KIND of goods at a PRICE, optionally with a multi-buy.
 * A maker with forty different stickers at $7 writes one line, not forty,
 * which is why this has always been short enough for somebody to type into
 * an email. Keeping that shape is the whole reason makers will fill it in.
 *
 * Everything here is pure, because what it decides is money that gets rung
 * up at a register against somebody else's goods, and a rounding error or a
 * silently dropped bundle price is a maker paid wrong in December.
 */

/* ────────────────────────────── money ────────────────────────────── */

/**
 * Cents from what somebody typed, or why it is not a price.
 *
 * Parsed out of TEXT and never through `Number(x) * 100`, for the reason
 * documented at length in money.test.ts: 4.10 * 100 is 409.99999999999994
 * and a maker's price would be a cent light at the till.
 */
export function priceFromDollars(raw: string): { cents: number } | { bad: string } {
  const t = (raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  if (t === '') return { bad: 'Put a price on it.' }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) {
    return { bad: 'Write the price as a number, like 7 or 7.50.' }
  }
  const [whole, frac = ''] = t.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return { bad: 'That is not a price.' }
  if (cents === 0) return { bad: 'A price has to be more than nothing.' }
  if (cents > 10_000_00) return { bad: 'Over $10,000. Tell us about that one directly.' }
  return { cents }
}

/**
 * Hillary's way of writing money, which drops the cents when there are none.
 *
 * `usd()` in lib/money renders $5.00 because an invoice should. A price tag
 * should not: her own example reads "$5 or buy 2/$8", and a list of forty
 * prices all carrying a pointless .00 is exactly the wall of numbers she
 * tells makers to avoid.
 */
export function tag(cents: number): string {
  const neg = cents < 0
  const n = Math.abs(cents)
  const whole = Math.floor(n / 100)
  const rest = n % 100
  const body = rest === 0
    ? `$${whole.toLocaleString('en-US')}`
    : `$${whole.toLocaleString('en-US')}.${String(rest).padStart(2, '0')}`
  return neg ? `-${body}` : body
}

/* ────────────────────────────── a line ────────────────────────────── */

/**
 * How many multi-buys one line may carry.
 *
 * Drew, 30 October: "I don't think people are gonna get past three to be
 * honest, that would be pretty rare, but maybe we build it to go up to three
 * or four." Three breaks plus the single price is four variants on a
 * product, which is what a register shows when you click into it.
 *
 * A form decision, not a database one: inventory_breaks holds as many as it
 * is given, so raising this is a change to the boxes on screen.
 */
export const MAX_BREAKS = 3

/** "2" and "15" means buy 2 for $15. Both blank is no break. */
export type BreakInput = { qty: string; price: string }

export type LineInput = {
  label: string
  price: string
  /** In the order the maker typed them. Blank pairs are ignored; a half
   *  filled pair is refused, because half a multi-buy is a price nobody can
   *  ring up. */
  breaks: BreakInput[]
}

/** One multi-buy: a quantity and what that lot costs. */
export type Break = { qty: number; cents: number }

export type Line = {
  label: string
  priceCents: number
  /** Cheapest per item last, which is the order a shelf card reads in.
   *  Empty when the line is simply a thing at a price. */
  breaks: Break[]
}

export const MAX_LABEL = 80

/**
 * One line, checked, or the sentence to show against it.
 *
 * Errors are written to the maker, not to us. "Write the price as a number"
 * tells somebody what to do; "invalid input" tells them they are stupid.
 */
export function readLine(input: LineInput): { line: Line } | { bad: string } {
  /* A name is optional.
     
     Drew, 6 November: "we actually don't need a title, we can just go off of
     their prices." At a central register the cashier picks the maker and then
     the amount, so the name is for the human and not for the till, and this
     list has always been one line per price rather than one line per item.
     Spurs & Saddles sent fifteen bare prices and was right to: naming them
     would have been work for us, not for the register.
     
     So an empty name is a line, and anything typed is still kept and still
     bounded. */
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ')
  if (label.length > MAX_LABEL) return { bad: `Keep it under ${MAX_LABEL} characters.` }

  const price = priceFromDollars(input.price)
  if ('bad' in price) return { bad: price.bad }

  const breaks: Break[] = []
  for (const raw of input.breaks ?? []) {
    const qRaw = (raw?.qty ?? '').trim()
    const bRaw = (raw?.price ?? '').trim()

    /* An untouched pair of boxes. Most lines are a thing and a price. */
    if (!qRaw && !bRaw) continue

    /* "Buy 1 for $12" is not a multi-buy, it is the price, and it is what
       anybody types who reads those boxes as "how many have you got". That
       was a dead end Drew hit three times running with lines he had every
       right to expect to save. A quantity below two carries no multi-buy, so
       it is dropped rather than thrown back. Checked before the half-a-break
       rules below, so a lone 0 or 1 is answered the same way whatever sits
       beside it. */
    if (/^\d+$/.test(qRaw) && Number(qRaw) < 2) continue

    /* Half a multi-buy is the likeliest mistake on this form, and silently
       dropping it would put the wrong price on the shelf. */
    if (!qRaw) return { bad: 'How many for that multi-buy price?' }
    if (!bRaw) return { bad: 'What does that multi-buy cost?' }
    if (!/^\d+$/.test(qRaw)) return { bad: 'A multi-buy quantity is a whole number, like 2.' }

    const qty = Number(qRaw)
    if (qty > 99) return { bad: 'That is a lot. Keep a multi-buy under 100.' }

    const lot = priceFromDollars(bRaw)
    if ('bad' in lot) return { bad: lot.bad }

    /* A multi-buy that costs more per item than buying them singly is a typo
       every time, and the kind nobody notices until a shopper does the sum at
       the counter. Compared by cross multiplication so there is no division
       and no float anywhere near a price. */
    if (lot.cents >= price.cents * qty) {
      return { bad: `At ${tag(price.cents)} each, ${qty} would be ${tag(price.cents * qty)}. A multi-buy has to cost less.` }
    }

    if (breaks.some((b) => b.qty === qty)) {
      return { bad: `There are two prices for buying ${qty}. Keep one.` }
    }
    breaks.push({ qty, cents: lot.cents })
  }

  if (breaks.length > MAX_BREAKS) {
    return { bad: `Up to ${MAX_BREAKS} multi-buys on one line.` }
  }

  /* Fewest first, which is how a shelf card reads and how the register will
     show the variants: the single price, then each better deal under it. */
  breaks.sort((a, b) => a.qty - b.qty)

  /* And each one has to actually be a better deal than the one above it.
     "2 for $15, 3 for $25" is $7.50 each then $8.33 each, which is a ladder
     that goes the wrong way: a shopper buying three is better off buying two
     and one, and nobody notices until she works it out at the counter.
     Cross multiplied again, so no division touches a price. */
  for (let i = 1; i < breaks.length; i++) {
    const lower = breaks[i - 1]!
    const higher = breaks[i]!
    if (higher.cents * lower.qty >= lower.cents * higher.qty) {
      return {
        bad: `${higher.qty} for ${tag(higher.cents)} is not a better deal than`
          + ` ${lower.qty} for ${tag(lower.cents)}. Each one has to work out cheaper each.`,
      }
    }
  }

  return { line: { label, priceCents: price.cents, breaks } }
}

/** One line the way Hillary writes it. `Maps: $5 or buy 2/$8` */
export function formatLine(line: Line): string {
  /* No name means the price IS the line. Never "": $45", which reads as a
     thing whose name we lost rather than one that never had one. */
  const base = line.label ? `${line.label}: ${tag(line.priceCents)}` : tag(line.priceCents)
  if (line.breaks.length === 0) return base
  /* "Maps: $5 or buy 2/$8 or 3/$10". The word "buy" once, because repeating
     it on every break reads as three separate offers rather than one price
     ladder on one product. */
  const [first, ...rest] = line.breaks
  const tail = rest.map((b) => ` or ${b.qty}/${tag(b.cents)}`).join('')
  return `${base} or buy ${first!.qty}/${tag(first!.cents)}${tail}`
}

/**
 * A maker's whole list, in the shape staff already read.
 *
 * The Mermade code leads, because at a central register the code is how a
 * sale finds its way back to the right maker.
 */
export function makerBlock(
  vendorCode: string | null, shopName: string, lines: Line[],
): string {
  const head = [vendorCode?.trim(), shopName.trim()].filter(Boolean).join(' ')
  return [`${head}:`, ...lines.map(formatLine)].join('\n')
}

/**
 * The nudge about odd cents, as a note rather than a refusal.
 *
 * Hillary: "Please do not include a .50 or .75 or .99 unless you've already
 * made your tags." That is a preference about how the day reads at a
 * register, not a rule, and a maker who has already printed tags at $7.50 is
 * right and we are wrong. So it is said once, quietly, and never blocks.
 */
export function oddCentsNote(lines: Line[]): string | null {
  const odd = lines.filter((l) => l.priceCents % 100 !== 0).length
  if (odd === 0) return null
  return odd === 1
    ? 'One of your prices has cents in it. If your tags are already made, leave it. If not, round numbers are quicker at the register.'
    : `${odd} of your prices have cents in them. If your tags are already made, leave them. If not, round numbers are quicker at the register.`
}

/* ──────────────────────────── the deadline ──────────────────────────── */

export type ListState =
  /** No date set yet, so nothing is being asked of anybody. */
  | 'not_open'
  /** Their turn, and they can still change it. */
  | 'open'
  /** The date has passed and they can still change it. Chased, not shut out. */
  | 'late'
  /** Shut. Nothing returns this today; kept for a real cutoff at load-in. */
  | 'locked'

/**
 * Whether a maker may still change their list.
 *
 * Drew, 27 October: "their inventory can change over time, people add items
 * and we should allow them to do that... there should be a due date on like,
 * here's your final inventory."
 *
 * That was built as open until the date and shut after it, and shut was the
 * wrong half. MM40, 3 November, the afternoon the date passed: "I've tried to
 * resubmit but the system online will not let me. If I may, I'm including the
 * breakdown of our pricelist." Twenty five lines, by hand, in an email, to be
 * keyed in by somebody else. That is the exact failure the list exists to
 * prevent, and the deadline caused it.
 *
 * A due date here is a request, not a gate. The register wants prices; a
 * maker typing hers in late is strictly better for everybody than her not
 * having any, and nothing downstream breaks because a line arrived on the
 * Tuesday. So the date now moves the list from open to LATE, which says the
 * same thing in the UI and refuses nothing.
 *
 * 'locked' is left in the type for a cutoff that is real, which is load-in,
 * when the register is built and paper is printed. Nothing returns it today.
 * When something does it should come off its own field on the Show record,
 * not off this one, because the two answer different questions.
 */
export function listState(dueAtIso: string | null | undefined, nowIso: string): ListState {
  const due = dueAtIso ? Date.parse(dueAtIso) : NaN
  if (!Number.isFinite(due)) return 'not_open'
  const now = Date.parse(nowIso)
  if (!Number.isFinite(now)) return 'open'
  return now > due ? 'late' : 'open'
}

/** What the maker is told about the state of their list. */
export function listNotice(state: ListState, count: number): string {
  if (state === 'not_open') {
    return 'We will open this before the show and write to you when it is ready.'
  }
  if (state === 'locked') {
    return count === 0
      ? 'The list is closed. Write to us and we will add your prices by hand.'
      : 'The list is closed and this is what the register has. Write to us if something needs changing.'
  }
  /* Late, and still open. Says the date has gone without suggesting the
     chance has: somebody reading this has already decided to do the thing. */
  if (state === 'late') {
    return count === 0
      ? 'This was due already. Add it now and it still reaches the register, so please do not send it to us another way.'
      : 'This was due already, and this is what the register has. You can still add, change or remove anything.'
  }
  return count === 0
    ? 'Add every kind of thing you are bringing, with its price. One line per price, not one line per item.'
    : 'Add, change or remove anything until the date above.'
}

/* ──────────────────────── "that is my list" ──────────────────────── */

export type SendState =
  /** Nothing on it yet, so there is nothing to send. */
  | 'empty'
  /** Lines on it, never sent. */
  | 'unsent'
  /** Sent, and untouched since. */
  | 'sent'
  /** Sent, and changed since. Worth saying, because the register reads the
   *  list and not the moment somebody pressed a button. */
  | 'changed'

/**
 * Where a maker's list stands.
 *
 * Drew, 29 October: a maker needs to be able to say "this is my final
 * inventory", and that is what should cross the row off their list.
 *
 * It used to tick itself the moment somebody typed one line, which is not the
 * same thing: a maker with one line out of forty read as finished, and nobody
 * could tell a list that was ready to key in from one somebody was halfway
 * through.
 *
 * `changed` needs no stored flag. An item carries the time it was written, so
 * anything newer than the moment it was sent answers it.
 */
export function sendState(
  count: number, submittedAtIso: string | null | undefined, newestChangeIso?: string | null,
): SendState {
  if (count === 0) return 'empty'
  const sent = submittedAtIso ? Date.parse(submittedAtIso) : NaN
  if (!Number.isFinite(sent)) return 'unsent'
  const touched = newestChangeIso ? Date.parse(newestChangeIso) : NaN
  return Number.isFinite(touched) && touched > sent ? 'changed' : 'sent'
}

/** What the button says, or null when there is nothing to press. */
export function sendLabel(state: SendState): string | null {
  if (state === 'empty') return null
  if (state === 'unsent') return 'This is my list'
  if (state === 'changed') return 'Send the updated list'
  return null
}

/** What the maker is told about having sent it. */
export function sendNotice(state: SendState, submittedAtIso?: string | null): string | null {
  if (state === 'unsent') {
    return 'Tell us when it is finished. You can still change it afterwards.'
  }
  if (state === 'sent') {
    return submittedAtIso
      ? `Sent to us. Anything you change from here is picked up automatically.`
      : 'Sent to us.'
  }
  if (state === 'changed') {
    return 'You have changed this since you sent it. Press the button so we know it is settled.'
  }
  return null
}

/**
 * Whether the list counts as done, for the checklist row.
 *
 * Sent, not merely started. A maker who adds three more lines in November has
 * not undone anything, which is why `changed` still counts.
 */
export const listDone = (state: SendState): boolean => state === 'sent' || state === 'changed'

/**
 * A list pasted in the shape Elise already asks for it.
 *
 * Drew, 29 October: "you saw elise's screenshot, thats how she usually asks
 * for it." She does, and makers already answer in it, which makes typing the
 * same list again field by field busywork we invented. Her own example, from
 * the instructions that ship with this table:
 *
 *     MM15 Maggie's Maps:
 *     Maps: $5 or buy 2/$8
 *     Stickers/Maps/gift tags: $7
 *     Table cloths / Backpacks: $20 or buy 2/$36
 *
 * So that is the input. One line per price, the same as the form, and
 * formatLine already prints this exact shape, which means a maker can paste
 * back what the card showed her last week and get the same list.
 *
 * Forgiving about everything that is not a number: bullets, dashes instead
 * of colons, "2 for $8" or "buy 2/$8" or "2/$8", a missing dollar sign. Not
 * forgiving about the numbers themselves, which go through the same
 * priceFromDollars and the same bundle rules as the form, so nothing reaches
 * the register from here that could not have been typed into the boxes.
 *
 * Whatever cannot be read comes back with its line and the reason, so the
 * maker fixes two lines rather than retyping forty.
 */
export type PastedList = {
  lines: Line[]
  bad: { raw: string; why: string }[]
}

/* The two long dashes, built rather than written: this file is checked for
   them as prose, and here they are punctuation somebody else typed. */
const LONG_DASHES = String.fromCharCode(0x2013) + String.fromCharCode(0x2014)
/* A trailing multi-buy: "or buy 2/$8", "buy 2/$8", "2 for $8", "2/$8". */
/* The multi-buy at the end of a line, however it was punctuated.
   
   Valentina, 30 October: "I submitted the list but only the duffle bag promo
   was saved for some reason." She had written three. The one that saved was
   the one she happened to write with a comma, which was the only separator
   this knew: a dash, a full stop, a slash or a pair of brackets left their
   punctuation behind on the line, the price then had something after it, and
   the whole line was thrown back as having no price at all. Seven of the
   nine ways a person actually writes a multi-buy failed, most of them losing
   the item too, and the maker had no way to tell which one we wanted. */
const BUNDLE_AT_END = new RegExp(
  `[-,;./(\\[${LONG_DASHES}]?\\s*(?:or\\s+)?(?:buy\\s+)?[(\\[]?\\s*`
  /* The amount, and never the full stop after it: [\d.,]+ happily swallowed
     the one ending "Buy 2 for $90." and handed "90." on to be read as money. */
  + '(\\d+)\\s*(?:/|\\s+for\\s+)\\s*\\$?\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*[)\\]]?\\s*\\.?\\s*$',
  'i',
)
/* Whatever the multi-buy left behind: "Jackets $155 - ", "Tote Bag $48 (". */
const DANGLING_SEP = new RegExp(`[\\s,;./(\\[${LONG_DASHES}-]+$`)
/* And a trailing full stop on the price itself: "Tote Bag: $48." */
const TRAILING_STOP = /\.\s*$/
/* The price: the last dollar amount left on the line. The sign is optional,
   because plenty of pasted lists read "Cards: 7". */
const PRICE_AT_END = /\$\s*([\d.,]+)\s*$/
const BARE_PRICE_AT_END = new RegExp(`(?:^|[\\s:${LONG_DASHES}-])([\\d.,]+)\\s*$`)
/* A heading like "MM15 Maggie's Maps:", which names the maker, not a price. */
const HEADING = /^[^$]*:\s*$/
const BULLET = new RegExp(`^[-*${String.fromCharCode(0x2022)}${LONG_DASHES}]+\\s*`)
const TRAILING_SEP = new RegExp(`[\\s:$${LONG_DASHES}-]+$`)

export function readPastedList(text: string): PastedList {
  const out: PastedList = { lines: [], bad: [] }
  /* What each saved line was read FROM, so a multi-buy written underneath it
     can be added and the line read again from the top. Kept beside out.lines
     and the same length, because a continuation edits the line it follows. */
  const priced: LineInput[] = []

  for (const rawLine of (text ?? '').split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw) continue
    /* Her first line names the maker. We know who they are. */
    if (HEADING.test(raw)) continue

    /* Bullets and dashes people paste out of Notes and Docs. */
    let rest = raw.replace(BULLET, '').trim()

    /* Every multi-buy on the line, taken off the end one at a time.
       "Maps: $5 or buy 2/$8 or 3/$10" strips "or 3/$10", then "or buy 2/$8",
       and what remains is the product and its single price. Collected back
       to front, so they are reversed before use. */
    const found: BreakInput[] = []
    for (let guard = 0; guard < MAX_BREAKS + 1; guard++) {
      const m = rest.match(BUNDLE_AT_END)
      if (!m) break
      found.push({ qty: m[1]!, price: m[2]! })
      rest = rest.slice(0, m.index).trim()
      /* What is left of "Maps: $5 or". */
      rest = rest.replace(/[,;]?\s*\b(?:or|and)\b\s*$/i, '').trim()
      /* And of "Jackets $155 -" or "Tote Bag $48 (". */
      rest = rest.replace(DANGLING_SEP, '').trim()
    }
    found.reverse()

    const price = rest.match(PRICE_AT_END) ?? rest.match(BARE_PRICE_AT_END)
    if (!price) {
      /* A multi-buy on a line of its own, under the thing it belongs to:
         
             Jackets $155
             Buy 2 for $296
         
         Which is how anybody writes a list by hand, and which used to be
         thrown back as a line with no price while the jacket above it saved
         at full price only. Nothing is left on the line but the multi-buy,
         and there is something above it to attach to, so attach it. Anything
         else without a price is still an error. */
      if (found.length > 0 && !rest && priced.length > 0) {
        const prev = priced[priced.length - 1]!
        const merged = { ...prev, breaks: [...prev.breaks, ...found] }
        const again = readLine(merged)
        if ('bad' in again) out.bad.push({ raw, why: again.bad })
        else {
          out.lines[out.lines.length - 1] = again.line
          priced[priced.length - 1] = merged
        }
        continue
      }
      out.bad.push({ raw, why: 'We could not find a price on that line.' })
      continue
    }
    const label = rest
      .slice(0, rest.lastIndexOf(price[1]!))
      .replace(TRAILING_SEP, '')
      .trim()

    const input: LineInput = { label, price: price[1]!, breaks: found }
    const read = readLine(input)
    if ('bad' in read) out.bad.push({ raw, why: read.bad })
    else {
      out.lines.push(read.line)
      priced.push(input)
    }
  }

  return out
}
