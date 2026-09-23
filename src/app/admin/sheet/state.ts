/**
 * The form's state, kept out of actions.ts.
 *
 * A file marked 'use server' may export async functions and NOTHING else.
 * `emptyPush` used to live next to the action, which is where it reads best
 * and is the one place it cannot be: Next compiles that module into a set of
 * callable endpoints, finds an object among them, and throws "a use server
 * file can only export async functions" the moment the action is invoked.
 *
 * Nothing about that failure points at the cause. The page renders, the
 * button presses, the request 500s, and the screen falls into an error
 * boundary. Drew pressed Send and told me nothing happened, which is exactly
 * what it looks like. This is the second time the same mistake has cost a
 * night, /admin/import being the first, so there is now a test that fails
 * instead: src/app/use-server-exports.test.ts.
 */

export type PushState = {
  /** Echoed back so a rejected paste is not lost. */
  link: string
  ok: boolean
  message: string
}

export const emptyPush: PushState = { link: '', ok: false, message: '' }
