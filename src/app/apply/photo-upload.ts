'use client'

import {
  MAX_PHOTO_BYTES, PHOTO_TYPES, isPhotoType, mb, type PhotoType,
} from '@/server/modules/uploads/photos'

/**
 * One photograph, from the moment it is chosen to the moment its key is on
 * the form. Lives in ApplyForm's state, not in the field's, because a
 * rejected submit remounts the <form> and everything under it, exactly the
 * way the space and add-on checkboxes are held.
 */
export type PhotoItem = {
  /** Local only. Never sent anywhere. */
  id: string
  /** The maker's own filename. Used for the remove button's accessible name,
   *  shown to them and to nobody else, and never sent to the server. */
  name: string
  /** The chosen file, kept so a failed upload can be retried without asking
   *  the maker to find it again. The object URL below already pins the same
   *  bytes in memory, so holding it costs nothing extra. */
  file: File
  /** An object URL, so the thumbnail appears the instant a file is picked
   *  rather than after a round trip. */
  preview: string
  status: 'uploading' | 'done' | 'error'
  /** 0-100. Real bytes-on-the-wire, from the upload's progress events. */
  pct: number
  /** The storage key, once it is really there. This is what the form posts. */
  key?: string
  /** The folder this photograph went into, so a remount keeps the session's
   *  uploads together under one prefix. */
  batchId?: string
  /** Set on the first of a batch that ran past the limit, so the field can
   *  say how many files were left out instead of dropping them in silence. */
  overflow?: number
  error?: string
}

/** What a browser calls this file, with an extension fallback: Android
 *  pickers hand back an empty type often enough to matter, and an iPhone's
 *  HEIC is the commonest thing it happens to. */
export function declaredType(file: File): string {
  const t = file.type.split(';')[0]!.trim().toLowerCase()
  if (t) return t
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, PhotoType> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  }
  return byExt[ext] ?? ''
}

/** The first thing wrong with this file, in words a maker can act on. */
export function fileProblem(file: File): string | null {
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_PHOTO_BYTES) {
    return `${mb(file.size)} is over the ${mb(MAX_PHOTO_BYTES)} limit. Try a smaller export.`
  }
  if (!isPhotoType(declaredType(file))) {
    return `We can take ${PHOTO_TYPES.map((t) => t.replace('image/', '').toUpperCase()).join(', ')}.`
  }
  return null
}

type Minted = { key: string; uploadUrl: string; batchId: string }

/**
 * Ask the server for a signed upload URL. The server names the key; we only
 * say how big the file is and what the browser thinks it is, and it treats
 * both as claims.
 */
async function mint(file: File, batchId: string | null): Promise<Minted> {
  const res = await fetch('/api/uploads/application-photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: declaredType(file), size: file.size, batchId,
    }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'We could not start that upload.')
  }
  return (await res.json()) as Minted
}

/**
 * PUT the bytes straight to Supabase.
 *
 * XMLHttpRequest, not fetch, for one reason: upload progress. fetch reports
 * nothing until the response arrives, and a maker on a phone watching a
 * five-megabyte photograph go up over a cell connection needs to see it
 * moving or they will hit the button again.
 */
function put(
  url: string, file: File, contentType: string,
  onProgress: (pct: number) => void, signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', contentType)
    // Never overwrite: every key is minted once and used once.
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); return }
      reject(new Error(`Upload failed (${xhr.status}). Try that one again.`))
    }
    xhr.onerror = () => reject(new Error('The upload dropped. Check your connection and try again.'))
    xhr.ontimeout = () => reject(new Error('That upload timed out. Try it again.'))
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

/**
 * Chosen file in, storage key out. Every failure arrives as a message the
 * field can print next to the thumbnail: nothing here fails silently, and
 * nothing here takes the rest of the form down with it.
 */
export async function uploadPhoto(
  file: File,
  opts: {
    batchId: string | null
    onProgress: (pct: number) => void
    signal: AbortSignal
  },
): Promise<{ key: string; batchId: string }> {
  const minted = await mint(file, opts.batchId)
  await put(minted.uploadUrl, file, declaredType(file), opts.onProgress, opts.signal)
  return { key: minted.key, batchId: minted.batchId }
}
