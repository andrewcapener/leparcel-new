import { redirect } from 'next/navigation'

/**
 * /apply/preview — a forgiving alias for /apply?preview=1.
 *
 * The real switch is a query string, and a query string is the thing people
 * mistype as a path. Anyone reaching for the form preview by URL rather than
 * by the link in /admin lands here instead of a 404.
 */
export default function ApplyPreviewAlias() {
  redirect('/apply?preview=1')
}
