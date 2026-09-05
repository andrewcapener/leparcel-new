import { redirect } from 'next/navigation'

/**
 * /admin itself had no page. The proxy let a signed-in request through and
 * Next then had nothing to render, so the front door of the admin answered
 * 404 — while every screen inside it worked. Jury is where the work starts.
 */
export default function AdminIndex() {
  redirect('/admin/jury')
}
