'use client'

import { useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

export type BoardCard = {
  id: string
  /** The application, because the square lives there, not on the booking. */
  applicationId: string
  name: string
  group: string
  photo: string | null
  shown: boolean
}

const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'indoor', label: 'Inside' },
  { key: 'junior', label: 'Junior makers' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

/**
 * The grid, as staff arrange it.
 *
 * Drag to reorder, untick to take a maker off the page. One Save for both,
 * because it is one decision: Elise is looking at the grid and deciding what
 * it should look like.
 *
 * Reordering happens WITHIN a group and never across one. A maker's group is
 * her booked space, so dragging a Friday card into Saturday would be claiming
 * to move her tent, and that is the roster's job, not this screen's.
 *
 * Keyboard moves too. Drag and drop with a mouse is the obvious gesture and
 * it is unusable without one, so every card also has two buttons, which is
 * what a keyboard and a screen reader get (WCAG 2.2 AA).
 */

/**
 * The Save button, which has to say that it is saving.
 *
 * Drew, 25 Sept: "when I press save the button doesn't appear that its saving
 * something - but it does". With eighty eight cards the write is real work
 * and the round trip is long enough to doubt, and a button that looks
 * unpressed is one a person presses again. Twice.
 *
 * useFormStatus only reports the form it is rendered inside, which is why
 * this is its own component rather than state in the board.
 */
function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button className="adm-btn" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Saving the lineup' : children}
    </button>
  )
}

/** Dims the board while the save is in flight, so it reads as busy rather
 *  than as ignoring the press. */
function BoardBusy({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return <div className={pending ? 'lb-body is-saving' : 'lb-body'} aria-busy={pending}>{children}</div>
}

/**
 * Replace one maker's square, in place.
 *
 * Elise, 26 Sept: swap images on the board itself. The bytes go straight from
 * this browser to Supabase, the same path a maker's own upload takes, so a
 * hundred replacements never pass through our server and never time out a
 * serverless function.
 *
 * Saved the moment it is picked rather than on the board's Save. The file
 * input carries no `name`, so a picked file is never submitted with the
 * board: a browser only sends named fields, and the two jobs stay separate.
 */
function SwapPicture(
  { applicationId, name, onDone }: {
    applicationId: string; name: string; onDone: (url: string) => void
  },
) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File) {
    setError(null); setBusy(true); setPct(0)
    try {
      const minted = await fetch('/api/admin/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      })
      if (!minted.ok) {
        const b = (await minted.json().catch(() => ({}))) as { error?: string }
        throw new Error(b.error ?? 'We could not start that upload.')
      }
      const { uploadUrl, publicUrl } = (await minted.json()) as {
        uploadUrl: string; publicUrl: string
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        /* A photograph off a phone takes long enough that a silent control
           gets clicked twice. */
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
          ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)))
        xhr.onerror = () => reject(new Error('The upload did not reach storage.'))
        xhr.send(file)
      })

      const saved = await fetch('/api/admin/thumbnail/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, url: publicUrl }),
      })
      if (!saved.ok) {
        const b = (await saved.json().catch(() => ({}))) as { error?: string }
        throw new Error(b.error ?? 'We could not save that picture.')
      }
      onDone(publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="lb-swap">
      {/* No name, so a picked file is never posted with the board's Save. */}
      <input
        ref={input} type="file" accept="image/*" hidden disabled={busy}
        aria-label={`Replace the picture for ${name}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }}
      />
      <button
        type="button" className="adm-btn-q" disabled={busy} aria-busy={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? `Uploading ${pct}%` : 'Change picture'}
      </button>
      {error && <span className="lb-err" role="alert">{error}</span>}
    </div>
  )
}

export function LineupBoard(
  { cards, action }: { cards: BoardCard[]; action: (fd: FormData) => Promise<void> },
) {
  const [order, setOrder] = useState(cards)
  const [shown, setShown] = useState<Record<string, boolean>>(
    () => Object.fromEntries(cards.map((c) => [c.id, c.shown])),
  )
  const [held, setHeld] = useState<string | null>(null)
  /* Squares swap on their own, so the board keeps its own copy rather than
     waiting for the page to be fetched again. */
  const [photos, setPhotos] = useState<Record<string, string | null>>(
    () => Object.fromEntries(cards.map((c) => [c.id, c.photo])),
  )

  /** Move `id` to sit where `overId` is, refusing a move across groups. */
  function place(id: string, overId: string) {
    if (id === overId) return
    setOrder((prev) => {
      const from = prev.findIndex((c) => c.id === id)
      const to = prev.findIndex((c) => c.id === overId)
      if (from < 0 || to < 0 || prev[from]!.group !== prev[to]!.group) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      return next
    })
  }

  /** One step within the group, for anyone not using a mouse. */
  function nudge(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.findIndex((c) => c.id === id)
      if (i < 0) return prev
      const group = prev[i]!.group
      let j = i + dir
      while (j >= 0 && j < prev.length && prev[j]!.group !== group) j += dir
      if (j < 0 || j >= prev.length || prev[j]!.group !== group) return prev
      const next = prev.slice()
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  const hiddenCount = order.filter((c) => !shown[c.id]).length

  return (
    <form action={action}>
      <input type="hidden" name="order" value={order.map((c) => c.id).join(',')} />
      {order.filter((c) => shown[c.id]).map((c) => (
        <input key={c.id} type="hidden" name="shown" value={c.id} />
      ))}

      <div className="lb-bar">
        <span>
          {order.length - hiddenCount} on the page
          {hiddenCount > 0 ? `, ${hiddenCount} held back` : ''}
        </span>
        <SaveButton>Save the lineup</SaveButton>
      </div>

      <BoardBusy>
      {GROUPS.map(({ key, label }) => {
        const inGroup = order.filter((c) => c.group === key)
        if (inGroup.length === 0) return null
        return (
          <section key={key} className="lb-sec">
            <div className="adm-sec"><h2>{label}</h2><span className="c">{inGroup.length}</span></div>
            <ul className="lb-grid">
              {inGroup.map((c, i) => (
                <li
                  key={c.id}
                  className={`lb-card${shown[c.id] ? '' : ' is-off'}${held === c.id ? ' is-held' : ''}`}
                  draggable
                  onDragStart={() => setHeld(c.id)}
                  onDragEnd={() => setHeld(null)}
                  onDragOver={(e) => { e.preventDefault(); if (held) place(held, c.id) }}
                >
                  <div className="lb-sq">
                    {photos[c.id]
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={photos[c.id]!} alt="" width={120} height={120} />
                      : <span className="lb-init" aria-hidden="true">
                        {c.name.trim().slice(0, 2).toUpperCase()}
                      </span>}
                  </div>
                  <span className="lb-name">{c.name}</span>
                  <label className="lb-show">
                    <input
                      type="checkbox"
                      checked={shown[c.id] ?? true}
                      onChange={(e) => setShown((p) => ({ ...p, [c.id]: e.target.checked }))}
                    />
                    <span>{shown[c.id] ? 'On the page' : 'Held back'}</span>
                  </label>
                  <SwapPicture
                    applicationId={c.applicationId}
                    name={c.name}
                    onDone={(url) => setPhotos((p) => ({ ...p, [c.id]: url }))}
                  />
                  <div className="lb-move">
                    <button type="button" className="adm-btn-q" onClick={() => nudge(c.id, -1)}
                      disabled={i === 0} aria-label={`Move ${c.name} earlier`}>↑</button>
                    <button type="button" className="adm-btn-q" onClick={() => nudge(c.id, 1)}
                      disabled={i === inGroup.length - 1} aria-label={`Move ${c.name} later`}>↓</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      </BoardBusy>

      <div className="lb-bar">
        <SaveButton>Save the lineup</SaveButton>
      </div>
    </form>
  )
}
