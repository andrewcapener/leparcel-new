'use client'

import { useCallback, useEffect, useId, useRef, type Dispatch, type SetStateAction } from 'react'
import { MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_ACCEPT, mb } from '@/server/modules/uploads/photos'
import { fileProblem, uploadPhoto, type PhotoItem } from './photo-upload'

/**
 * A photograph of the work. Optional, one, and never in the way.
 *
 * Why optional: the application has to be as easy as it can be, and a maker
 * who stalls at an upload is an application nobody reads. Instagram and
 * Website are required fields three steps up, and they are how the jury has
 * always looked at a maker's work, so a skipped photograph is not a missing
 * signal. This is a shortcut for the jury, not a gate for the maker. One
 * line says why, once, and then it stops asking.
 *
 * How it works, and why:
 *
 *  - The list lives in ApplyForm's state, not here. A rejected submit
 *    remounts the <form> and everything under it (see the `key` on the form),
 *    so a field that held its own upload would lose it on the one attempt
 *    where losing it hurts most. Same reason the space and add-on checkboxes
 *    are held up there.
 *  - The bytes go straight from the browser to Supabase, through a signed URL
 *    minted by /api/uploads/application-photos. What the form posts is a
 *    hidden field of storage keys, and the server checks each one against the
 *    bucket, bytes and all, before it writes an application.
 *  - Two ways to add. The main control has no `capture`, which is what makes
 *    a phone offer the camera roll AND the camera; setting `capture` there
 *    would take the roll away, and most makers already have their shots. The
 *    second control is `capture="environment"` for the maker who would rather
 *    shoot the thing in front of them.
 *  - Nothing fails silently. A file that is refused says why, next to itself,
 *    with a way to try again.
 *
 * The cap is MAX_PHOTOS, currently one. The column is a JSON array and this
 * field is written for a list, so raising it is a constant and no migration.
 */

const uuid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null

export function PhotoField({
  enabled, items, setItems,
}: {
  /** False when this deployment has no Supabase Storage configured. */
  enabled: boolean
  items: PhotoItem[]
  setItems: Dispatch<SetStateAction<PhotoItem[]>>
}) {
  const uid = useId()
  const statusId = `${uid}-status`
  const hintId = `${uid}-hint`

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
    const taking = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - items.length))
    const fresh: PhotoItem[] = taking.map((file, n) => {
      const problem = fileProblem(file)
      return {
        id: `${Date.now()}-${n}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        file,
        // An object URL, so the thumbnail is there the instant they pick it
        // rather than after a round trip.
        preview: URL.createObjectURL(file),
        status: problem ? 'error' : 'uploading',
        pct: 0,
        error: problem ?? undefined,
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
  const one = MAX_PHOTOS === 1

  /* One sentence, announced politely. Counts only: a live region that read
     every percentage would talk over the rest of the form. Nothing here
     scolds anybody for having none, because none is a fine answer. */
  const announcement = !enabled ? ''
    : busy > 0 ? 'Uploading.'
      : failed > 0 && done === 0 ? 'That one did not go up. You can try again or carry on without it.'
        : done === 0 ? ''
          : one ? 'Photograph added.'
            : `${done} of ${MAX_PHOTOS} added. The first one is the lead image.`

  if (!enabled) {
    /* No Supabase on this deployment. Say so plainly and give the maker the
       path that does still work, rather than a control that cannot do
       anything. Nothing about the application changes. */
    return (
      <div className="column column--full">
        <fieldset className="ap-group ap-photos ap-photos--off" aria-describedby={hintId}>
          <legend className="ap-group__legend">A photograph (optional)</legend>
          <p className="note" id={hintId}>
            Uploads are not switched on here yet. If you want the jury to open
            on an image, email one to{' '}
            <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>{' '}
            (outside makers, to{' '}
            <a href="mailto:hillary@mermademarket.com">hillary@mermademarket.com</a>)
            with your shop name in the subject line. Your Instagram and website
            are on the application either way.
          </p>
        </fieldset>
      </div>
    )
  }

  return (
    <div className="column column--full">
      <fieldset
        className="ap-group ap-photos"
        aria-describedby={`${hintId} ${statusId}`}
      >
        <legend className="ap-group__legend">
          {one ? 'A photograph (optional)' : 'Photographs (optional)'}
        </legend>
        <p className="note" id={hintId}>
          It is the first thing the jury sees. Skip it if you would rather:
          they will open your Instagram instead.
        </p>

        {items.length > 0 && (
          <ul className="ap-photos__grid">
            {items.map((item, n) => (
              <li className="ap-photos__item" key={item.id} data-state={item.status}>
                <div className="ap-photos__frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="ap-photos__img" />
                  {!one && n === 0 && item.status !== 'error' && (
                    <span className="ap-photos__lead">Lead</span>
                  )}
                  <button
                    type="button" className="ap-photos__x"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.name}`}
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

                {!one && item.status === 'done' && n > 0 && (
                  <button
                    type="button" className="ap-photos__lead-btn"
                    onClick={() => lead(item)}
                  >
                    Make this the lead
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!full && (
          <div className="ap-photos__actions">
            {/* Visually hidden, not display:none: it stays in the tab order
                and the label carries a visible focus ring for it. */}
            <input
              id={`${uid}-pick`} className="ap-photos__input" type="file"
              accept={PHOTO_ACCEPT} multiple={!one}
              onChange={(ev) => { add(ev.target.files); ev.target.value = '' }}
            />
            <label htmlFor={`${uid}-pick`} className="ap-photos__btn">
              {one ? 'Choose a photo' : 'Choose photographs'}
            </label>

            <input
              id={`${uid}-shoot`} className="ap-photos__input" type="file"
              accept={PHOTO_ACCEPT} capture="environment"
              onChange={(ev) => { add(ev.target.files); ev.target.value = '' }}
            />
            <label htmlFor={`${uid}-shoot`} className="ap-photos__btn ap-photos__btn--alt">
              Take a photo
            </label>

            <span className="ap-photos__count">
              JPEG, PNG, WEBP or HEIC, up to {mb(MAX_PHOTO_BYTES)}
            </span>
          </div>
        )}

        <p className="note ap-photos__status" id={statusId} role="status">
          {announcement}
        </p>

        {/* What the server actually reads: the keys of the objects that made
            it into the bucket, in the order shown. An empty array is a fine
            answer and the action treats it as one. */}
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
