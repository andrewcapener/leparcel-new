/**
 * Where the "Stay Hooked" window must never open.
 *
 * Its own file, and a pure function, because this list has now been wrong
 * twice and both times it was caught in a screenshot rather than by a test.
 * First over the maker's account, with the Pay button behind it. Then over
 * /pay/<token>, which did not exist when the rule was written: staff paste
 * that link into an acceptance email, so the first thing forty makers would
 * have seen on a booth fee with a 48 hour deadline was a newsletter signup.
 *
 * The rule, so the next door added does not repeat it: anywhere somebody is
 * part way through doing the thing we asked them to do. Marketing belongs in
 * front of a browser, never in front of a task.
 */
export const POPUP_FREE = [
  /** Staff, all of it. */
  '/admin',
  /** Part way through an application. */
  '/apply',
  /** A maker's own dashboard, invoice and payout setup. */
  '/account',
  /** A pasted payment link. The booth fee door with the hardest deadline. */
  '/pay',
] as const

/** True where the pop-up must stay shut. */
export function popupSuppressed(path: string): boolean {
  return POPUP_FREE.some((p) => path === p || path.startsWith(`${p}/`))
}
