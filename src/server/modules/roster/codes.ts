import { parseCsv } from './import'

/**
 * Re-cutting every maker's Mermade ID from the girls' own numbered list.
 *
 * Drew, 29 October: "we have new MM numbers for each vendor", followed by
 * forty two rows straight out of the sheet. The codes in the database were
 * minted in acceptance order by nextVendorCode; these were decided by a
 * person, by category and by where a maker stands in the room, and theirs is
 * the one the girls will write on a tent card and read off a Venmo note.
 *
 * Which is exactly why this is not a script. A Mermade ID is what a manual
 * payment is matched by, so moving one is moving the thing that identifies
 * somebody's money. Everything here is pure and returns a PLAN: what each
 * row would do and, for anything it cannot do safely, why. The screen shows
 * that plan before a single row is written.
 *
 * The codes are taken exactly as typed, upper-cased and no more. The sheet
 * carries MM1 rather than MM01, a B36 and an M42, and inventing a house
 * format on top of a list a person wrote by hand is how a maker ends up
 * being called something the tent card does not say.
 */

export type CodeRow = {
  line: number
  /** As typed, upper-cased. MM1, B36, M42. */
  code: string
  shop: string
  contact: string
  email: string
}

export type CodeParse = {
  rows: CodeRow[]
  problems: { line: number; detail: string }[]
}

/* A code is letters then digits: MM1, mm8, B36, M42. Anything else on the
   line is somebody's category or a price and is not ours. */
const CODE = /^[A-Za-z]{1,3}\d{1,3}$/
/* Which character separates the cells, decided over the WHOLE paste rather
   than its first line. The roster importer sniffs the header row, which is
   right for a file with headings and wrong here: Drew's sheet opens with a
   bare "MM" that has neither a tab nor a comma in it, and a first line that
   settles nothing read the entire roster as one cell per row. */
function separator(text: string): ',' | '\t' {
  const outside = text.replace(/"[^"]*"/g, '')
  const tabs = (outside.match(/\t/g) ?? []).length
  const commas = (outside.match(/,/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

const norm = (s: string) => (s ?? '').trim()
const normEmail = (s: string) => norm(s).toLowerCase()

/**
 * Pull the numbered rows out of a paste, and ignore everything else in it.
 *
 * The sheet Drew pasted carries the roster at the top and then several
 * hundred lines of other tables under it: last spring's spaces, a sales
 * report, a waitlist, notes about who was rejected. Those lines have codes in
 * them too. The thing that separates a roster row from all of it is an email
 * address, so that is what is required, and a row without one is not a row.
 */
export function parseCodeSheet(text: string): CodeParse {
  const out: CodeParse = { rows: [], problems: [] }
  const grid = parseCsv(text ?? '', separator(text ?? ''))
  const seen = new Map<string, number>()

  grid.forEach((cells, i) => {
    const line = i + 1
    const code = norm(cells[0] ?? '').toUpperCase()
    if (!CODE.test(code)) return

    const email = normEmail(cells.find((c) => norm(c).includes('@')) ?? '')
    if (!email) return

    /* The two cells between the code and the address, in the sheet's order.
       Only ever shown back to staff, so the row reads as a person. */
    const rest = cells.slice(1).map(norm).filter((c) => c && !c.includes('@'))

    const before = seen.get(code)
    if (before !== undefined) {
      out.problems.push({ line, detail: `${code} is on line ${before} as well.` })
      return
    }
    seen.set(code, line)
    out.rows.push({ line, code, shop: rest[0] ?? '', contact: rest[1] ?? '', email })
  })

  if (out.rows.length === 0) {
    out.problems.push({ line: 0, detail: 'No numbered rows with an email address in them.' })
  }
  return out
}

/** A maker holding a space at this show, as the database has them today. */
export type Holder = {
  bookingId: string
  vendorId: string
  email: string
  shopName: string
  /** What they are called today. */
  code: string
  /** A released space still has its row and still carries its number. It
   *  must not stand in the way of giving that number to somebody else. */
  status: string
}

export type CodePlan =
  | { kind: 'change'; row: CodeRow; holder: Holder; from: string }
  | { kind: 'same'; row: CodeRow; holder: Holder }
  /* Two rows, one address. Drew's own sheet has this: MM18 and MM19 are two
     different people, Eléna and Sofia, sharing sam.chanell@gmail.com. An
     address cannot tell them apart, and guessing which sister is which is
     how one of them gets the other's money. */
  | { kind: 'shared'; row: CodeRow; holders: Holder[] }
  | { kind: 'nomaker'; row: CodeRow }
  /* The code is wanted here and currently belongs to somebody else who is
     not moving. Applying it would hand two makers the same reference. */
  | { kind: 'taken'; row: CodeRow; holder: Holder; by: Holder }

/* A space that was given up. The booking row stays, because nothing is ever
   deleted (rule 3), and it keeps the number it was using. That number is
   free, and treating it as taken would hold back a maker for the sake of
   somebody who is not coming. */
const GONE = new Set(['cancelled', 'forfeited'])

export function planCodes(rows: CodeRow[], holders: Holder[]): CodePlan[] {
  const byEmail = new Map<string, Holder[]>()
  for (const h of holders) {
    const k = normEmail(h.email)
    byEmail.set(k, [...(byEmail.get(k) ?? []), h])
  }

  /* Every address this paste mentions. A code leaving a maker who is in the
     paste is not a clash: the two simply swap, which is most of a
     renumbering. Only a code sitting on somebody the paste never mentions
     can actually collide. */
  const moving = new Set(rows.map((r) => r.email))

  /* How many ROWS want each address. Two rows on one address is ambiguous
     whichever way the database happens to fall: if the address has two
     bookings we cannot tell which sister is which, and if it has one, the
     second row quietly overwrites the first and one of them ends up with
     the other's number. Counted here so both directions are caught. */
  const rowsPerEmail = new Map<string, number>()
  for (const r of rows) rowsPerEmail.set(r.email, (rowsPerEmail.get(r.email) ?? 0) + 1)

  return rows.map((row): CodePlan => {
    const found = byEmail.get(row.email) ?? []
    if (found.length === 0) return { kind: 'nomaker', row }
    if (found.length > 1 || (rowsPerEmail.get(row.email) ?? 0) > 1) {
      return { kind: 'shared', row, holders: found }
    }

    const holder = found[0]!
    if (holder.code.toUpperCase() === row.code) return { kind: 'same', row, holder }

    const sitting = holders.find(
      (h) => h.code.toUpperCase() === row.code
        && h.bookingId !== holder.bookingId
        && !GONE.has(h.status),
    )
    if (sitting && !moving.has(normEmail(sitting.email))) {
      return { kind: 'taken', row, holder, by: sitting }
    }
    return { kind: 'change', row, holder, from: holder.code }
  })
}

export function summariseCodes(plan: CodePlan[]) {
  const n = (k: CodePlan['kind']) => plan.filter((p) => p.kind === k).length
  return {
    change: n('change'), same: n('same'), shared: n('shared'),
    nomaker: n('nomaker'), taken: n('taken'),
    total: plan.length,
  }
}

/** One sentence for the top of the screen. */
export function codeNotice(s: ReturnType<typeof summariseCodes>): string {
  if (s.total === 0) return 'Nothing to read in that.'
  const bits = [`${s.change} to change`]
  if (s.same > 0) bits.push(`${s.same} already right`)
  const stuck = s.shared + s.nomaker + s.taken
  if (stuck > 0) bits.push(`${stuck} needing a person`)
  return `${bits.join(', ')}.`
}

/** The codes a plan would actually write, for the confirm step. */
export const appliable = (plan: CodePlan[]) =>
  plan.filter((p): p is Extract<CodePlan, { kind: 'change' }> => p.kind === 'change')
