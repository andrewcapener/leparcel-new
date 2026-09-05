import { cookies } from 'next/headers'
import { applicationWindow, type WindowState } from '@/lib/dates'

export const PREVIEW_COOKIE = 'mm_preview_window'

/**
 * Launch preview: render the public site as it will read once applications
 * open, without opening them.
 *
 * The alternative is moving `applications_open_at` on the Show record to
 * today, and on a preview deploy that shares the production database that
 * does not simulate the launch, it *is* the launch: the form goes live, the
 * announcement bar tells the world, and anything submitted is a real
 * application in the real jury queue.
 *
 * So this is a cookie on one staff browser, set from the admin, and the
 * server action that accepts an application deliberately does NOT consult it
 * (see src/app/actions.ts). Preview changes what the site says, never what it
 * will accept.
 */
export async function previewingOpenWindow(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(PREVIEW_COOKIE)?.value === '1'
}

/**
 * The window state the public site should render. Never use this to decide
 * whether to accept a submission; use applicationWindow directly for that.
 */
export async function displayWindow(
  openAt: string,
  closeAt: string,
): Promise<WindowState> {
  if (await previewingOpenWindow()) return 'open'
  return applicationWindow(openAt, closeAt)
}
