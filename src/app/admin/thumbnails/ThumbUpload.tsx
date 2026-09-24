'use client'

import { useRef, useState, useTransition } from 'react'

/**
 * Replace one maker's square.
 *
 * The bytes go straight from this browser to Supabase, the same path a maker's
 * own upload takes: ask the server for a signed URL, PUT to it, then hand the
 * resulting public URL back to a server action. The file never passes through
 * our server, which is what keeps a hundred replacements from timing out a
 * serverless function.
 */
export function ThumbUpload({
  applicationId, shopName, action,
}: {
  applicationId: string
  shopName: string
  /** The server action that stores the URL. */
  action: (fd: FormData) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  async function pick(file: File) {
    setError(null)
    setBusy(true)
    setPct(0)
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
        /* Progress, because a photograph off a phone over a cell connection
           takes long enough that a silent button gets pressed twice. */
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status}).`)))
        xhr.onerror = () => reject(new Error('The upload did not reach storage.'))
        xhr.send(file)
      })

      const fd = new FormData()
      fd.set('applicationId', applicationId)
      fd.set('url', publicUrl)
      start(() => { void action(fd) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      setBusy(false)
      setPct(0)
    }
  }

  return (
    <div className="thumb-up">
      <input
        ref={input}
        id={`f-${applicationId}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="adm-sr"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pick(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="adm-btn-q"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? `Uploading ${pct}%` : 'Replace'}
        <span className="adm-sr"> the photo for {shopName}</span>
      </button>
      {error && <p className="thumb-err" role="alert">{error}</p>}
    </div>
  )
}
