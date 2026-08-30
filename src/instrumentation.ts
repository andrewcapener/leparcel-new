/**
 * Captures every server-side request error. Vercel keeps the console output in
 * the function logs, and the last error is stashed on globalThis so
 * /api/health can report it from the same instance (the demo has no Sentry;
 * production wires this to Sentry per docs/02-ARCHITECTURE.md).
 */

type ErrStash = { at: string; path: string; message: string; stack?: string }

export function register() {}

export async function onRequestError(
  err: unknown,
  request: { path: string },
) {
  const e = err instanceof Error ? err : new Error(String(err))
  const stash: ErrStash = {
    at: new Date().toISOString(),
    path: request.path,
    message: `${e.name}: ${e.message}`,
    stack: e.stack?.split('\n').slice(0, 6).join('\n'),
  }
  ;(globalThis as Record<string, unknown>).__lastRequestError = stash
  console.error('[onRequestError]', JSON.stringify(stash))
}
