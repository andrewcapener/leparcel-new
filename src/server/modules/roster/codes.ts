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
  /** Indoor or outdoor. Shown rather than acted on: the makers who turn out
   *  to be standing on an indoor number are the outdoor ones, and seeing
   *  that on the screen is what tells staff the bump is the right answer. */
  track: string
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
  /* Somebody not in the sheet is standing on the number this row wants.
     Drew, 29 October: "those outside vendors that currently have the number
     we are replacing will simply get assigned the next available number."
     They are outdoor makers, the sheet is the indoor room, and the indoor
     number is the one that has to be right. So the row takes it and the
     maker holding it moves up, which is carried here rather than refused. */
  | { kind: 'bumped'; row: CodeRow; holder: Holder; from: string; moves: Bump }

/* A space that was given up. The booking row stays, because nothing is ever
   deleted (rule 3), and it KEEPS THE NUMBER IT WAS USING.
   
   That last part is the whole of it. bookings carries a unique index on
   (show_id, vendor_code), and an index does not read a status column: a
   cancelled booking sitting on MM10 owns MM10 as far as Postgres is
   concerned. Treating those numbers as free is what put "duplicate key
   value violates unique constraint" on Drew's screen, because his sheet
   asks for MM1 to MM42 and his roster has given-up spaces across that
   range from a season of changes.
   
   So a released space does not get to keep a maker waiting, and it does
   not get to be ignored either: it is moved aside like any other holder,
   and the number it was using is genuinely freed. */
const GONE = new Set(['cancelled', 'forfeited'])

/* What one row resolves to before the bumped makers have been given their
   new numbers, which needs every row read first. */
type Draft =
  | Exclude<CodePlan, { kind: 'bumped' }>
  | { kind: 'blocked'; row: CodeRow; holder: Holder; by: Holder }

/** A maker moved off a number so an indoor row can have it. */
export type Bump = { holder: Holder; from: string; to: string }

/** The digits in MM41, B36, M42. Zero when there are none. */
const numberIn = (code: string): number => Number(code.match(/(\d+)$/)?.[1] ?? 0)

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

  const draft = rows.map((row): Draft => {
    const found = byEmail.get(row.email) ?? []
    if (found.length === 0) return { kind: 'nomaker', row }
    if (found.length > 1 || (rowsPerEmail.get(row.email) ?? 0) > 1) {
      return { kind: 'shared', row, holders: found }
    }

    const holder = found[0]!
    if (holder.code.toUpperCase() === row.code) return { kind: 'same', row, holder }

    const sitting = holders.find(
      (h) => h.code.toUpperCase() === row.code
        && h.bookingId !== holder.bookingId,
    )
    if (sitting && !moving.has(normEmail(sitting.email))) {
      return { kind: 'blocked', row, holder, by: sitting }
    }
    return { kind: 'change', row, holder, from: holder.code }
  })

  /* Where the bumped makers go.
     
     Every number the sheet is about to own, plus every number held by
     somebody who is neither in the sheet nor moving. A bumped maker must
     land outside all of it, and outside the numbers given to the other
     bumped makers, which is why they are added as they are handed out.
     A released space is in the way exactly like a live one, because the
     unique index does not read a status column (see GONE). */
  const bumpers = new Set(
    draft.filter((d) => d.kind === 'blocked').map((d) => d.by.bookingId),
  )
  const occupied = new Set(rows.map((r) => r.code))
  for (const h of holders) {
    /* No GONE check here, deliberately. The index counts a released
       booking's number as used, so anything we hand out has to avoid it
       unless that booking is one of the ones being moved. */
    if (moving.has(normEmail(h.email))) continue
    if (bumpers.has(h.bookingId)) continue
    occupied.add(h.code.toUpperCase())
  }

  /* Carrying on from the highest number the sheet uses, so the room keeps
     its order and the makers who moved sit after it rather than in the gaps
     between indoor makers. */
  /* Compared as NUMBERS rather than as strings. MM44 and MM044 are two
     different values to a unique index and the same number to a person
     reading a tent card, and the roster carries both spellings. */
  const usedNumbers = new Set([...occupied].map(numberIn))

  let n = Math.max(0, ...rows.map((r) => numberIn(r.code))) + 1
  const nextFree = (): string => {
    while (usedNumbers.has(n)) n++
    const code = `MM${n}`
    occupied.add(code)
    usedNumbers.add(n)
    n++
    return code
  }

  return draft.map((d): CodePlan => {
    if (d.kind !== 'blocked') return d
    return {
      kind: 'bumped',
      row: d.row,
      holder: d.holder,
      from: d.holder.code,
      moves: { holder: d.by, from: d.by.code, to: nextFree() },
    }
  })
}

export function summariseCodes(plan: CodePlan[]) {
  const n = (k: CodePlan['kind']) => plan.filter((p) => p.kind === k).length
  return {
    change: n('change'), same: n('same'), shared: n('shared'),
    nomaker: n('nomaker'), bumped: n('bumped'),
    total: plan.length,
  }
}

/** One sentence for the top of the screen. */
export function codeNotice(s: ReturnType<typeof summariseCodes>): string {
  if (s.total === 0) return 'Nothing to read in that.'
  const bits = [`${s.change + s.bumped} to change`]
  if (s.bumped > 0) bits.push(`${s.bumped} moving a maker up to make room`)
  if (s.same > 0) bits.push(`${s.same} already right`)
  const stuck = s.shared + s.nomaker
  if (stuck > 0) bits.push(`${stuck} needing a person`)
  return `${bits.join(', ')}.`
}

/** The codes a plan would actually write, for the confirm step. */
export const appliable = (plan: CodePlan[]) =>
  plan.filter((p): p is Extract<CodePlan, { kind: 'change' | 'bumped' }> =>
    p.kind === 'change' || p.kind === 'bumped')

/** The makers moved up to make room, in the order they were handed numbers. */
export const bumps = (plan: CodePlan[]): Bump[] =>
  plan.flatMap((p) => (p.kind === 'bumped' ? [p.moves] : []))
