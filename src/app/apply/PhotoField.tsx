'use client'

import { useCallback, useEffect, useId, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  ASK_PHOTOS, MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_ACCEPT, mb,
} from '@/server/modules/uploads/photos'
import { fileProblem, uploadPhoto, type PhotoItem } from './photo-upload'

/**
 * The photographs. The one input the jury actually decides on, and until now
 * the only one the form never asked for: /admin/jury is a contact sheet built
 * around `photos[0]`, and the application had no way to put anything there.
 *
 * How it works, and why:
 *
 *  - The list lives in ApplyForm's state, not here. A rejected submit remounts
 *    the <form> and everything under it (see the `key` on the form), so a
 *    field that held its own uploads would lose them on the one attempt where
 *    losing them hurts most. Same reason the space and add-on checkboxes are
 *    held up there.
 *  - The bytes go straight from the browser to Supabase, through a signed URL
 *    minted by /api/uploads/application-photos. What the form posts is a
 *    hidden field of storage keys, and the server checks every one of them
 *    against the bucket before it writes an application.
 *  - Two ways to add. The main control has no `capture`, which is what makes
 *    a phone offer the camera roll AND the camera; setting `capture` there
 *    would take the roll away, and most makers already have their shots. The
 *    second control is `capture="environment"` for the maker who wants to
 *    shoot the thing in front of them.
 *  - The first photograph is the lead image. It is labelled, and every other
 *    one has a button to become it, because "reorder by dragging" is not a
 *    thing that works with a thumb or a keyboard.
 *  - Nothing fails silently. Every file that is refused says why, next to
 *    itself, with a way to try again.
 */

const uuid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null

export function PhotoField({
  enabled, items, setItems, error,
}: {
  /** False when this deployment has no Supabase Storage configured. */
  enabled: boolean
  items: PhotoItem[]
  setItems: Dispatch<SetStateAction<PhotoItem[]>>
  error?: string
}) {
  const uid = useId()
  const statusId = `${uid}-status`
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`

  // One folder per form session. Seeded from whatever is already uploaded, so
  // a remount after a rejected submit keeps writing to the same prefix.
  const batchRef = useRef<string | null>(null)
  if (batchRef.current === null) {
    batchRef.current = items.find((i) => i.batchId)?.batchId ?? uuid()
  }

  // In-flight uploads, so removing a photograph mid-upload actually stops it.
  const flight = useRef(new Map<string, AbortController>())
  useEffect(() => {
    const inFlight = flight.current
    return () => { for (const c of inFlight.values()) c.abort() }
  }, [])

  const patch = useCallback((id: string, next: Partial<PhotoItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...next } : i)))
  }, [setItems])

  const start = useCallback(async (item: PhotoItem) => {
    const controller = new AbortController()
    flight.current.set(item.id, controller)
    patch(item.id, { status: 'uploading', pct: 0, error: undefined })
    try {
      const res = await uploadPhoto(item.file, {
        batchId: batchRef.current,
        onProgress: (pct) => patch(item.id, { pct }),
        signal: controller.signal,
      })
      batchRef.current = res.batchId
      patch(item.id, { status: 'done', pct: 100, key: res.key, batchId: res.batchId })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      patch(item.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'That one did not go up.',
      })
    } finally {
      flight.current.delete(item.id)
    }
  }, [patch])

  const add = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = MAX_PHOTOS - items.length
    const taking = Array.from(files).slice(0, Math.max(0, room))
    const overflow = files.length - taking.length

    const fresh: PhotoItem[] = taking.map((file, n) => {
      const problem = fileProblem(file)
      return {
        id: `${Date.now()}-${n}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        file,
        preview: URL.createObjectURL(file),
        status: problem ? 'error' : 'uploading',
        pct: 0,
        error: problem ?? undefined,
        overflow: n === 0 && overflow > 0 ? overflow : undefined,
      }
    })
    setItems((list) => [...list, ...fresh])
    for (const item of fresh) if (item.status === 'uploading') void start(item)
  }, [items.length, setItems, start])

  const remove = useCallback((item: PhotoItem) => {
    flight.current.get(item.id)?.abort()
    flight.current.delete(item.id)
    URL.revokeObjectURL(item.preview)
    setItems((list) => list.filter((i) => i.id !== item.id))
  }, [setItems])

  const lead = useCallback((item: PhotoItem) => {
    setItems((list) => [item, ...list.filter((i) => i.id !== item.id)])
  }, [setItems])

  const done = items.filter((i) => i.status === 'done').length
  const busy = items.filter((i) => i.status === 'uploading').length
  const failed = items.filter((i) => i.status === 'error').length
  const full = items.length >= MAX_PHOTOS

  /* One sentence, announced politely. Counts only: a live region that read
     every percentage would talk over the rest of the form. */
  const announcement = !enabled ? ''
    : busy > 0 ? `Uploading ${busy} of ${items.length}. ${done} ready.`
      : failed > 0 ? `${done} of ${MAX_PHOTOS} added. ${failed} did not go up.`
        : done === 0 ? 'No photographs yet.'
          : `${done} of ${MAX_PHOTOS} added. The first one is the lead image.`

  if (!enabled) {
    /* No Supabase on this deployment. Say so plainly and give the maker the
       path that does still work, rather than a control that cannot do
       anything. The application itself is unaffected. */
    return (
      <div className="column column--full">
        <fieldset className="ap-group ap-photos ap-photos--off" aria-describedby={hintId}>
          <legend className="ap-group__legend">Photographs of your work</legend>
          <p className="note" id={hintId}>
            Uploads are not switched on here yet. Email {ASK_PHOTOS} to {MAX_PHOTOS}{' '}
            photographs to{' '}
            <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>{' '}
            (outside makers, to{' '}
            <a href="mailto:hillary@mermademarket.com">hillary@mermademarket.com</a>)
            with your shop name in the subject line. We will put them with your
            application before it reaches the jury.
          </p>
        </fieldset>
      </div>
    )
  }

  return (
    <div className="column column--full">
      <fieldset
        className="ap-group ap-photos" id="photos" tabIndex={-1}
        aria-describedby={`${hintId} ${statusId}${error ? ` ${errorId}` : ''}`}
      >
        <legend className="ap-group__legend">Photographs of your work</legend>
        <p className="note" id={hintId}>
          {ASK_PHOTOS} to {MAX_PHOTOS} photographs. The jury looks at these
          before they read a word, so lead with your best one.
          JPEG, PNG, WEBP or HEIC, up to {mb(MAX_PHOTO_BYTES)} each.
        </p>

        {items.length > 0 && (
          <ul className="ap-photos__grid">
            {items.map((item, n) => (
              <li className="ap-photos__item" key={item.id} data-state={item.status}>
                <div className="ap-photos__frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="ap-photos__img" />
                  {n === 0 && item.status !== 'error' && (
                    <span className="ap-photos__lead">Lead</span>
                  )}
                  <button
                    type="button" className="ap-photos__x"
                    onClick={() => remove(item)}
                    aria-label={`Remove photograph ${n + 1}, ${item.name}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                {item.status === 'uploading' && (
                  <progress
                    className="ap-photos__bar" max={100} value={item.pct}
                    aria-label={`Uploading ${item.name}`}
                  >
                    {item.pct}%
                  </progress>
                )}

                {item.status === 'error' && (
                  <p className="ap-photos__err">
                    {item.error}{' '}
                    {item.file.size <= MAX_PHOTO_BYTES && (
                      <button
                        type="button" className="ap-errors__link"
                        onClick={() => void start(item)}
                      >
                        Try again
                      </button>
                    )}
                  </p>
                )}

                {item.status === 'done' && n > 0 && (
                  <button
                    type="button" className="ap-photos__lead-btn"
                    onClick={() => lead(item)}
                  >
                    Make this the lead
                  </button>
                )}

                {item.overflow !== undefined && (
                  <p className="ap-photos__err">
                    {MAX_PHOTOS} is the limit, so {item.overflow}{' '}
                    {item.overflow === 1 ? 'file was' : 'files were'} left out.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="ap-photos__actions">
          {/* Visually hidden, not display:none: it stays in the tab order and
              the label carries a visible focus ring for it. */}
          <input
            id={`${uid}-pick`} className="ap-photos__input" type="file"
            accept={PHOTO_ACCEPT} multiple disabled={full}
            onChange={(ev) => { add(ev.target.files); ev.target.value = '' }}
          />
          <label htmlFor={`${uid}-pick`} className="ap-photos__btn" data-disabled={full || undefined}>
            {items.length === 0 ? 'Choose photographs' : 'Add more'}
          </label>

          <input
            id={`${uid}-shoot`} className="ap-photos__input" type="file"
            accept={PHOTO_ACCEPT} capture="environment" disabled={full}
            onChange={(ev) => { add(ev.target.files); ev.target.value = '' }}
          />
          <label
            htmlFor={`${uid}-shoot`}
            className="ap-photos__btn ap-photos__btn--alt"
            data-disabled={full || undefined}
          >
            Take a photo
          </label>

          <span className="ap-photos__count" aria-hidden="true">
            {done} of {MAX_PHOTOS}
          </span>
        </div>

        <p className="note ap-photos__status" id={statusId} role="status">
          {announcement}
        </p>

        {error && <small className="form-error" id={errorId}>{error}</small>}

        {/* What the server actually reads: the keys of the objects that made
            it into the bucket, in the order shown, first one leading. */}
        <input
          type="hidden" name="photos"
          value={JSON.stringify(
            items.filter((i) => i.status === 'done' && i.key).map((i) => i.key),
          )}
        />
      </fieldset>
    </div>
  )
}
