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

export type LineInput = {
  label: string
  price: string
  /** Both blank, or both filled. "2" and "8" means buy 2 for $8. */
  bundleQty: string
  bundlePrice: string
}

export type Line = {
  label: string
  priceCents: number
  bundleQty: number | null
  bundleCents: number | null
}

export const MAX_LABEL = 80

/**
 * One line, checked, or the sentence to show against it.
 *
 * Errors are written to the maker, not to us. "Write the price as a number"
 * tells somebody what to do; "invalid input" tells them they are stupid.
 */
export function readLine(input: LineInput): { line: Line } | { bad: string } {
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ')
  if (!label) return { bad: 'Say what it is.' }
  if (label.length > MAX_LABEL) return { bad: `Keep it under ${MAX_LABEL} characters.` }

  const price = priceFromDollars(input.price)
  if ('bad' in price) return { bad: price.bad }

  const qRaw = (input.bundleQty ?? '').trim()
  const bRaw = (input.bundlePrice ?? '').trim()

  if (!qRaw && !bRaw) {
    return { line: { label, priceCents: price.cents, bundleQty: null, bundleCents: null } }
  }
  /* Half a bundle is the most likely mistake on this form, and silently
     dropping it would put the wrong price on the shelf. */
  if (!qRaw) return { bad: 'How many for that bundle price?' }
  if (!bRaw) return { bad: 'What does the bundle cost?' }

  if (!/^\d+$/.test(qRaw)) return { bad: 'The bundle quantity is a whole number, like 2.' }
  const bundleQty = Number(qRaw)
  if (bundleQty < 2) return { bad: 'A bundle is two or more.' }
  if (bundleQty > 99) return { bad: 'That is a lot. Keep bundles under 100.' }

  const bundle = priceFromDollars(bRaw)
  if ('bad' in bundle) return { bad: bundle.bad }

  /* A "bundle" that costs more per item than buying them singly is a typo
     every time, and it is the kind that nobody notices until a shopper does
     the sum at the counter. Compared by cross multiplication so there is no
     division and no float anywhere near a price. */
  if (bundle.cents >= price.cents * bundleQty) {
    return { bad: `At ${tag(price.cents)} each, ${bundleQty} would be ${tag(price.cents * bundleQty)}. The bundle should cost less.` }
  }

  return {
    line: { label, priceCents: price.cents, bundleQty, bundleCents: bundle.cents },
  }
}

/** One line the way Hillary writes it. `Maps: $5 or buy 2/$8` */
export function formatLine(line: Line): string {
  const base = `${line.label}: ${tag(line.priceCents)}`
  return line.bundleQty && line.bundleCents
    ? `${base} or buy ${line.bundleQty}/${tag(line.bundleCents)}`
    : base
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
  /** The date has passed. Staff can still edit, the maker asks us. */
  | 'locked'

/**
 * Whether a maker may still change their list.
 *
 * Drew, 27 October: "their inventory can change over time, people add items
 * and we should allow them to do that... there should be a due date on like,
 * here's your final inventory."
 *
 * So it is open right up to the date and shut after it, and the date is the
 * Show's, not a per maker invention. Staff are never locked out: somebody
 * will always turn up on the Thursday with one more thing, and the answer to
 * that is a person deciding, not a form refusing.
 */
export function listState(dueAtIso: string | null | undefined, nowIso: string): ListState {
  const due = dueAtIso ? Date.parse(dueAtIso) : NaN
  if (!Number.isFinite(due)) return 'not_open'
  const now = Date.parse(nowIso)
  if (!Number.isFinite(now)) return 'open'
  return now > due ? 'locked' : 'open'
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
  return count === 0
    ? 'Add every kind of thing you are bringing, with its price. One line per price, not one line per item.'
    : 'Add, change or remove anything until the date above.'
}

/** Whether the list counts as done, for the checklist row. */
export const listDone = (count: number): boolean => count > 0
