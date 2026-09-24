/**
 * Where to send a person back to, carrying the outcome.
 *
 * The return path already has a query string on it, because it remembers
 * which list she was looking at. Appending with a second `?` makes
 * `?show=all?thumb=set`, which is one parameter named `show` whose value is
 * `all?thumb=set`. The notice then never renders and the press looks exactly
 * like a press that did nothing, which is the failure this admin has already
 * produced twice on other screens.
 *
 * Only our own paths: `back` comes from a form field, and a redirect that
 * will follow anything a form says is an open redirect.
 */
export function backTo(back: string, outcome: string): string {
  const safe = back.startsWith('/admin/') && !back.startsWith('//')
    ? back
    : '/admin/thumbnails'
  return `${safe}${safe.includes('?') ? '&' : '?'}thumb=${encodeURIComponent(outcome)}`
}
