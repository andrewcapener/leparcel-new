/**
 * The chase screen's state, kept out of actions.ts.
 *
 * A 'use server' file may export async functions and nothing else, and the
 * failure when it does not is a button that silently 500s. See
 * src/app/admin/sheet/state.ts for the full story and
 * src/app/use-server-exports.test.ts for the thing that now catches it.
 */

export type ChaseState = {
  ok: boolean
  message: string
  /** Echoed so a rejected submit does not lose the time somebody chose. */
  at: string
}

export const emptyChase: ChaseState = { ok: false, message: '', at: '' }

export type StopState = { ok: boolean; message: string }

export const emptyStop: StopState = { ok: false, message: '' }
