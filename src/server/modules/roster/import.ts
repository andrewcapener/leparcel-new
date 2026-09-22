/**
 * Accepting a whole roster from the girls' own sheet, in one reviewed pass.
 *
 * Seventy eight makers, fifteen of whom owe something other than the list
 * price. Done by hand that is seventy eight trips through the jury screen,
 * each one a chance to pick the wrong space or mistype a fee, late at night,
 * against a deadline. Done from the sheet the fees were already agreed in, it
 * is one paste and one read of what will happen.
 *
 * This file is the part that decides, and it is pure so it can be wrong in a
 * test rather than in production: parsing, matching and pricing. Nothing here
 * touches the database or Stripe.
 *
 * The fee in the sheet is the WHOLE fee. It already accounts for add-ons,
 * credits, second-day discounts and Hillary's giveaway, so the importer books
 * the space at exactly that number and never adds anything on top. That is the
 * opposite of what accepting one maker at a time does, which is what produced
 * the fourteen overcharges in the first place.
 */

/** One row as the sheet writes it, before anything is resolved. */
export type SheetRow = {
  line: number
  email: string
  spaceLabel: string
  /** Whole dollars and cents, as typed. */
  amount: string
  shop: string
}

export type ParseResult = {
  rows: SheetRow[]
  /** Anything that could not be read, with the line it came from. */
  problems: { line: number; detail: string }[]
}

/* A tiny CSV reader rather than a dependency. It has to handle exactly what
   Google Sheets exports: quoted fields, doubled quotes inside them, commas
   inside quotes. Shop names here include "Brighton Awad (Melissa, mom)". */
export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === sep) { row.push(cell); cell = ''; continue }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
      continue
    }
    cell += c
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

/* Copying rows straight out of Google Sheets puts tabs on the clipboard, not
   commas, and that is how the girls will get the sheet in here. Sniffed from
   the heading row rather than asked about, because a wrong answer would parse
   the whole paste as one column and report seventy eight rows with no email. */
export function sniffSeparator(text: string): ',' | '\t' {
  const head = text.split(/\r?\n/, 1)[0] ?? ''
  const outside = head.replace(/"[^"]*"/g, '')
  const tabs = (outside.match(/\t/g) ?? []).length
  const commas = (outside.match(/,/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

const want = (headers: string[], ...names: string[]) => {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const n of names) {
    const i = lower.indexOf(n.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

/**
 * Read the sheet.
 *
 * Column names are matched by heading rather than by position, so a column
 * moving does not silently shift every fee by one.
 */
export function parseAcceptSheet(text: string): ParseResult {
  const table = parseCsv(text, sniffSeparator(text))
  if (table.length === 0) return { rows: [], problems: [{ line: 0, detail: 'Nothing pasted.' }] }

  const head = table[0]!
  const iEmail = want(head, 'Sign-in email', 'email')
  const iSpace = want(head, 'Book this space', 'space')
  const iAmount = want(head, 'CHARGE', 'charge', 'fee')
  const iShop = want(head, 'Shop', 'shop name')

  const problems: { line: number; detail: string }[] = []
  for (const [name, i] of [['Sign-in email', iEmail], ['Book this space', iSpace], ['CHARGE', iAmount]] as const) {
    if (i < 0) problems.push({ line: 1, detail: `No "${name}" column. Paste the FINAL fees sheet with its heading row.` })
  }
  if (problems.length) return { rows: [], problems }

  const rows: SheetRow[] = []
  const seen = new Set<string>()
  table.slice(1).forEach((r, n) => {
    const line = n + 2
    const email = (r[iEmail] ?? '').trim().toLowerCase()
    const spaceLabel = (r[iSpace] ?? '').trim()
    const amount = (r[iAmount] ?? '').trim()
    const shop = iShop >= 0 ? (r[iShop] ?? '').trim() : ''
    if (!email && !spaceLabel && !amount) return
    if (!email) { problems.push({ line, detail: `${shop || 'This row'} has no email.` }); return }
    if (seen.has(email)) { problems.push({ line, detail: `${email} appears twice.` }); return }
    seen.add(email)
    if (!spaceLabel) { problems.push({ line, detail: `${shop || email} has no space.` }); return }
    rows.push({ line, email, spaceLabel, amount, shop })
  })
  return { rows, problems }
}

/**
 * Dollars as typed, to integer cents (rule 1).
 *
 * Parsed through a rounding step rather than a float multiply, because
 * 3.4 * 100 is 339.99999999999994 in this language and a booth fee is not
 * where anybody should discover that. Blank is not zero: a maker who owes
 * nothing is written 0, and an empty cell is a mistake worth reporting.
 */
export function centsFrom(amount: string): number | null {
  const t = amount.replace(/[$,\s]/g, '')
  if (t === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n > 100_000) return null
  return Math.round(n * 100)
}

/** Space labels differ in case and spacing between the sheet and the show. */
export const sameLabel = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')

/* ───────────────────────── resolving against the show ───────────────────── */

/** What one sheet row turns into once matched against real records. */
export type Planned =
  | { kind: 'book'; line: number; shop: string; email: string
      applicationId: string; vendorId: string; vendorCode: string | null
      spaceTypeId: string; spaceLabel: string; priceCents: number
      /** What accepting normally would have charged, for the review screen. */
      defaultCents: number }
  | { kind: 'already'; line: number; shop: string; email: string; detail: string }
  | { kind: 'problem'; line: number; shop: string; email: string; detail: string }

export type Lookups = {
  /** email (lowercase) -> the maker's application for this show */
  applications: Map<string, { id: string; vendorId: string; status: string }>
  /** email (lowercase) -> they already have a booking */
  booked: Set<string>
  spaces: { id: string; label: string; priceCents: number }[]
  vendorCodes: Map<string, string | null>
}

/**
 * Decide what each row would do, without doing any of it.
 *
 * Every row resolves to exactly one of three outcomes and nothing is silently
 * dropped: booked, already done, or a problem named in words. A row that
 * cannot be resolved never becomes a guess.
 */
export function planImport(rows: SheetRow[], look: Lookups): Planned[] {
  return rows.map((r): Planned => {
    const shop = r.shop || r.email
    const app = look.applications.get(r.email)
    if (!app) {
      return { kind: 'problem', line: r.line, shop, email: r.email,
        detail: 'No application for this show under that email.' }
    }
    if (look.booked.has(r.email)) {
      return { kind: 'already', line: r.line, shop, email: r.email,
        detail: 'Already has a booking. Left exactly as it is.' }
    }
    const space = look.spaces.find((s) => sameLabel(s.label, r.spaceLabel))
    if (!space) {
      return { kind: 'problem', line: r.line, shop, email: r.email,
        detail: `No space called "${r.spaceLabel}". Use the label exactly as /admin/show writes it.` }
    }
    const cents = centsFrom(r.amount)
    if (cents === null) {
      return { kind: 'problem', line: r.line, shop, email: r.email,
        detail: `"${r.amount}" is not an amount.` }
    }
    return { kind: 'book', line: r.line, shop, email: r.email,
      applicationId: app.id, vendorId: app.vendorId,
      vendorCode: look.vendorCodes.get(app.vendorId) ?? null,
      spaceTypeId: space.id, spaceLabel: space.label,
      priceCents: cents, defaultCents: space.priceCents }
  })
}

/** The one-line summary the review screen leads with. */
export function summarise(plan: Planned[]) {
  const book = plan.filter((p) => p.kind === 'book') as Extract<Planned, { kind: 'book' }>[]
  return {
    willBook: book.length,
    already: plan.filter((p) => p.kind === 'already').length,
    problems: plan.filter((p) => p.kind === 'problem').length,
    totalCents: book.reduce((s, p) => s + p.priceCents, 0),
    /* How many are being charged something other than the space's list price.
       Staff should recognise this number: it is the count the girls signed
       off on, and if it has moved, the sheet has. */
    overridden: book.filter((p) => p.priceCents !== p.defaultCents).length,
  }
}
