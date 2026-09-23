/**
 * Narrowing the roster to the rows one person is responsible for.
 *
 * Hillary runs outdoor and Elise runs indoor, and on payment week the
 * question each of them asks is "who on MY list has not paid". Eighty one
 * rows in one table makes that a scrolling exercise, and scrolling is how a
 * maker gets missed.
 *
 * Pure, because these two functions decide what a person believes the state
 * of the show is. A filter that quietly drops a row is worse than no filter:
 * the maker it drops is the one nobody chases.
 */

export type TrackFilter = 'all' | 'indoor' | 'outdoor'
export type FeeFilter = 'all' | 'unpaid' | 'clearing' | 'paid' | 'released'

export const TRACK_FILTERS: TrackFilter[] = ['all', 'indoor', 'outdoor']
export const FEE_FILTERS: FeeFilter[] = ['all', 'unpaid', 'clearing', 'paid', 'released']

/** The words the roster and the CSV already use, so the strip reads the same
 *  as the column it filters. */
export const FEE_LABEL: Record<FeeFilter, string> = {
  all: 'All',
  unpaid: 'Not paid',
  clearing: 'Clearing',
  paid: 'Paid',
  released: 'Released',
}

export const TRACK_LABEL: Record<TrackFilter, string> = {
  all: 'Everyone',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
}

/**
 * Which fee bucket a booking status falls in.
 *
 * Every status lands somewhere. `forfeited` and `cancelled` are one bucket
 * because the difference between them is how the space was lost, which is a
 * question for the audit log rather than for a filter strip.
 */
export function feeBucket(status: string): Exclude<FeeFilter, 'all'> {
  if (status === 'confirmed') return 'paid'
  if (status === 'payment_processing') return 'clearing'
  if (status === 'forfeited' || status === 'cancelled') return 'released'
  return 'unpaid'
}

export const matchesFee = (status: string, f: FeeFilter): boolean =>
  f === 'all' || feeBucket(status) === f

/* A space is indoor or outdoor and never both: the track lives on the space
   the booking was made against, not on what the maker applied for, because a
   maker who applied for both is sitting in exactly one of them. */
export const matchesTrack = (track: string, f: TrackFilter): boolean =>
  f === 'all' || track === f

/** Read a query string value, falling back to 'all' on anything unexpected.
 *  A typo in the url must show everything, never nothing. */
export const asTrack = (v: string | undefined): TrackFilter =>
  (TRACK_FILTERS as string[]).includes(v ?? '') ? (v as TrackFilter) : 'all'

export const asFee = (v: string | undefined): FeeFilter =>
  (FEE_FILTERS as string[]).includes(v ?? '') ? (v as FeeFilter) : 'all'

/** Is anything narrowed right now. */
export const isFiltered = (t: TrackFilter, f: FeeFilter): boolean =>
  t !== 'all' || f !== 'all'

/** What the page is showing, for the subtitle. */
export function filterWords(t: TrackFilter, f: FeeFilter): string {
  if (!isFiltered(t, f)) return ''
  const bits = [
    t === 'all' ? '' : TRACK_LABEL[t].toLowerCase(),
    f === 'all' ? '' : FEE_LABEL[f].toLowerCase(),
  ].filter(Boolean)
  return bits.join(', ')
}
