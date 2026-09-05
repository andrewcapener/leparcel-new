import { redirect } from 'next/navigation'

/**
 * Anything typed under /apply/… lands here rather than on a 404.
 *
 * The preview switch is a query string, `/apply?preview=1`, and a query
 * string is exactly the thing people write as a path: /apply/preview-1,
 * /apply/preview1, /apply/preview=1. A single alias for one spelling only
 * moved the 404 to the next spelling, which is what happened.
 *
 * So: if the path mentions preview at all, send them to the preview. If it
 * does not, send them to the form. Neither case can be a dead end, and
 * nothing here renders, so there is no second copy of the page to keep in
 * step with the real one.
 */
export default async function ApplyCatchAll({
  params,
}: {
  params: Promise<{ rest?: string[] }>
}) {
  const { rest } = await params
  const path = (rest ?? []).join('/').toLowerCase()
  redirect(/preview/.test(path) ? '/apply?preview=1' : '/apply')
}
