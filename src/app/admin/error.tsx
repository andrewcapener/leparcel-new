'use client'

/**
 * What the admin shows when something on it throws.
 *
 * Until this file existed there was no error boundary anywhere in the app, so
 * a server error under /admin rendered NOTHING: Drew pressed a button and got
 * a white page, with no message, no digest, and no way back except the back
 * button. A blank screen is the worst possible answer during a live
 * application window, because it does not even tell you whether the thing you
 * pressed happened.
 *
 * So this says three things, in this order: it broke, here is the reference
 * that finds it in the logs, and here is the way back. "Try again" first,
 * because most of what throws here is transient — a pooled connection that
 * timed out between the click and the query.
 *
 * The message itself is deliberately not rendered. In production Next replaces
 * it with a generic string anyway, and in development printing it here would
 * mean putting whatever a query complained about on screen, which is how a
 * connection string ends up in a screenshot. The digest is the safe handle:
 * it is a hash, it is in the server log next to the real stack, and it is what
 * somebody should send us.
 */
export default function AdminError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="adm-oops" role="alert">
      <p className="k">Something went wrong</p>
      <h1>This screen did not load.</h1>
      <p className="adm-note">
        Whatever you pressed may or may not have gone through, so check before you press
        it again. If it keeps happening, send us the reference below and we can find it
        in the log.
      </p>
      {error.digest && <p className="adm-oops__ref mono">Reference {error.digest}</p>}
      <div className="adm-oops__acts">
        <button className="adm-btn" type="button" onClick={reset}>Try again</button>
        <a className="adm-lk" href="/admin">Back to the dashboard <span aria-hidden="true">→</span></a>
      </div>
    </div>
  )
}
