/** What the three forms hand back to the screen. */
export type PushState = {
  error: string | null
  /** True when the press actually wrote, rather than showing a plan. */
  applied?: boolean
  /** The route's own answer, printed verbatim: it is the record of what
   *  happened and paraphrasing it would lose the refusals. */
  result?: unknown
  sent?: number
}

export const empty: PushState = { error: null }
