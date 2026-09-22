import type { Planned } from '@/server/modules/roster/import'

/**
 * The shape the import screen passes back and forth, and its empty value.
 *
 * Kept out of actions.ts because that file is `'use server'`, where every
 * export has to be an async function. A plain constant exported from there
 * does not survive: it arrives in the client as undefined, and the first read
 * of it throws before the page renders at all.
 */

export type ImportSummary = {
  willBook: number
  already: number
  problems: number
  totalCents: number
  overridden: number
}

export type ImportState = {
  /** Echoed back so a rejected paste is not lost. */
  text: string
  /** Something to say above the results, or ''. */
  message: string
  /** Rows that could not even be read: no email, a duplicate, no heading. */
  problems: { line: number; detail: string }[]
  plan: Planned[]
  summary: ImportSummary | null
  /** Fingerprint of the text this plan was made from. The Accept button
   *  carries it back, so an edited textarea cannot be run on an old review. */
  digest: string
  /** Filled in only after a real run. */
  done: { booked: number; skipped: number; failed: { shop: string; detail: string }[] } | null
}

export const emptyImport: ImportState = {
  text: '', message: '', problems: [], plan: [], summary: null, digest: '', done: null,
}
