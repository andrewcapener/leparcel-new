import type { InventoryRow, MakerListRow } from './inventory-export'

/**
 * The inventory, as a document somebody signs.
 *
 * Drew, 11 November: "we need to print out the inventory list so Elise can
 * go over it with her vendors."
 *
 * inventory-export.ts already answers this for a spreadsheet, and a
 * spreadsheet is the wrong shape for the job. Elise is going to sit down with
 * one maker at a time and read that maker's list back to her, line by line,
 * and then both of them have to agree it is right. That is a page per maker
 * with the maker's name at the top and somewhere to sign at the bottom, not
 * one eight hundred row grid that has to be cut up with scissors.
 *
 * So this takes the export's rows and regroups them: one block per maker, in
 * the maker's own words, in the order the maker wrote them. No new query and
 * no second definition of who counts, because the export already settled
 * both, and two readers that disagree about the roster is how a maker ends up
 * missing from a printout nobody checks again.
 */

export type PrintLine = {
  /** Position in the maker's own list, so a line can be named out loud. */
  n: number
  item: string
  /** Display money: "$7", not "7.00". */
  price: string
  multiBuys: string
  note: string
}

export type PrintMaker = {
  code: string
  shop: string
  contact: string
  /** 'Filed', 'Started', or 'Nothing yet', from the export. */
  filed: string
  lines: PrintLine[]
  cheapest: string
  dearest: string
}

/**
 * Display money from the export's plain dollars.
 *
 * The export writes "7.00" because a spreadsheet has to sum the column. A
 * person reading a price list does not want the cents when there are none,
 * and nearly every price at this show is a whole dollar.
 */
export function money(dollars: string): string {
  const s = dollars.trim()
  if (!s) return ''
  return `$${s.endsWith('.00') ? s.slice(0, -3) : s}`
}

/**
 * Sort key for a Mermade number.
 *
 * The codes are a letter prefix and a number, and the database orders them as
 * text, which puts MM10 before MM2 and MM109 before MM11. On a screen that is
 * untidy. On a printout Elise works down while makers queue at a table, it is
 * somebody standing in the wrong place.
 */
export function codeOrder(code: string): [string, number] {
  const m = /^([A-Za-z]*)(\d+)/.exec(code.trim())
  if (!m) return [code.trim().toUpperCase(), 0]
  return [m[1].toUpperCase(), Number(m[2])]
}

export function byCode(a: string, b: string): number {
  const [pa, na] = codeOrder(a)
  const [pb, nb] = codeOrder(b)
  if (pa !== pb) return pa < pb ? -1 : 1
  if (na !== nb) return na - nb
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * One block per maker, every maker, in code order.
 *
 * Driven by the maker list and not by the item rows, because a maker who has
 * filed nothing has no item rows at all, and she is exactly who this printout
 * is for: her page says so in words, and Elise rings her.
 */
export function printMakers(items: InventoryRow[], makers: MakerListRow[]): PrintMaker[] {
  const linesOf = new Map<string, PrintLine[]>()
  for (const r of items) {
    const had = linesOf.get(r.code) ?? []
    had.push({
      n: had.length + 1,
      item: r.item,
      price: money(r.price),
      multiBuys: r.multiBuys,
      note: r.note,
    })
    linesOf.set(r.code, had)
  }

  return makers
    .slice()
    .sort((a, b) => byCode(a.code, b.code))
    .map((m) => ({
      code: m.code,
      shop: m.shop,
      contact: m.contact,
      filed: m.listStatus,
      lines: linesOf.get(m.code) ?? [],
      cheapest: money(m.cheapest),
      dearest: money(m.dearest),
    }))
}

/**
 * Ruled rows left empty under a maker's list, for the ones she names while
 * Elise is sitting with her.
 *
 * Numbered on from her last line rather than drawn as a loose box, because
 * what gets written there is more inventory and it has to come back here and
 * be entered.
 *
 * A maker who has filed nothing needs room for a whole list rather than a few
 * additions. Ten and not more: that is a block two of which still fit on one
 * sheet, and a maker with more than ten things to declare at a table is a
 * phone call rather than a form.
 */
export function blankRows(lineCount: number): number {
  return lineCount === 0 ? 10 : 4
}

/** What the cover page says, counted off the blocks it covers. */
export function sheetSummary(blocks: PrintMaker[]) {
  const listed = blocks.filter((b) => b.lines.length > 0)
  return {
    makers: blocks.length,
    /** Makers with at least one line. The rest are the chase list. */
    listed: listed.length,
    missing: blocks.length - listed.length,
    lines: blocks.reduce((n, b) => n + b.lines.length, 0),
    /** Ways to buy: a line with two multi-buys is three buttons at the till. */
    variants: blocks.reduce(
      (n, b) => n + b.lines.reduce(
        (k, l) => k + 1 + (l.multiBuys ? l.multiBuys.split('·').length : 0), 0,
      ), 0,
    ),
  }
}
