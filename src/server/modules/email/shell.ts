/**
 * The chrome every Mermade email shares, and the rules that make an email
 * arrive looking the way it left.
 *
 * Written by hand in tables and inline styles because email is not the web:
 * Gmail, Outlook and Apple Mail between them strip <style> blocks, ignore
 * flexbox and grid, drop external stylesheets, and Outlook renders through
 * Word. Tables and inline styles are not old-fashioned here, they are the only
 * thing that survives.
 *
 * One image only: the Mermade wordmark in the header. Everything else is text,
 * so a maker's details never travel anywhere to render, there is no web font,
 * and there is no tracking pixel. The mark is the one thing worth a request,
 * because set in a fallback face the name is just grey Helvetica and the email
 * arrives looking like nobody's. It carries real alt text, so a client that
 * blocks images still reads "Mermade Market" where the mark would be.
 */

import { siteUrl } from '@/lib/site-url'

export const GOLD = '#bc9658'
export const INK = '#171717'
export const BODY = '#5c5c5c'
export const MUTED = '#9a938a'
export const RULE = '#e7e4df'
export const PAPER = '#ffffff'
export const CREAM = '#faf8f5'

/** Oswald and Figtree are not installed on a phone, so both stacks end in
 *  something every device has. The look survives; the exact face need not. */
export const HEAD_FONT = "Oswald, 'Helvetica Neue', Helvetica, Arial, sans-serif"
export const BODY_FONT = "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** The header mark, drawn at 2x and served from our own origin. */
const MARK_W = 140
const MARK_H = 70

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A value that is a link becomes one; everything else stays text. */
export function linkify(value: string): string {
  const v = esc(value)
  if (/^https?:\/\//.test(value)) return `<a href="${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return `<a href="mailto:${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  return v
}

export type Field = { label: string; value: string; strong?: boolean }

export function fieldRows(fields: Field[]): string {
  return fields.map((f, i) => {
    const border = i === fields.length - 1 ? '' : `border-bottom:1px solid ${RULE};`
    return `
    <tr><td style="padding:11px 24px 3px;">
      <div style="font-family:${HEAD_FONT};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">${esc(f.label)}</div>
    </td></tr>
    <tr><td style="padding:0 24px 11px;${border}">
      <div style="font-family:${BODY_FONT};font-size:16px;line-height:1.45;font-weight:${f.strong ? '600' : '400'};color:${f.strong ? INK : BODY};">${linkify(f.value) || `<span style="color:#b5aea5;">not given</span>`}</div>
    </td></tr>`
  }).join('')
}

/**
 * A small gold label with a hairline, to break a long record into blocks.
 *
 * Twenty-three fields in one undifferentiated column is a scroll, not a
 * record. Three or four named groups is the same information and half the
 * reading, because you stop at the group you came for.
 */
export function sectionHead(label: string): string {
  return `<tr><td style="padding:20px 24px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="1" style="padding-right:9px;white-space:nowrap;font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};">${esc(label)}</td>
      <td><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td>
    </tr></table>
  </td></tr>`
}

/**
 * The long tail of a record, two fields to a row.
 *
 * `fieldRows` gives a field the full width, which is right for the six that
 * decide anything and wasteful for the seventeen that do not: at one per row
 * the internal notice ran past three screens. Two columns halves it without
 * dropping a single field, which matters because this message is a backup.
 *
 * A plain two-cell table rather than anything clever, because it has to
 * survive Outlook's Word renderer, which ignores inline-block on a cell. At
 * the shell's 560px it lands around 250px a column, which is comfortable on a
 * phone and does not need to stack.
 */
export function compactRows(fields: Field[]): string {
  const cell = (f: Field | undefined, side: 'l' | 'r', last: boolean) => {
    const pad = side === 'l' ? 'padding:9px 12px 9px 0;' : 'padding:9px 0 9px 12px;'
    const border = last ? '' : `border-bottom:1px solid ${RULE};`
    if (!f) return `<td width="50%" valign="top" style="${pad}${border}">&nbsp;</td>`
    return `<td width="50%" valign="top" style="${pad}${border}">
      <div style="font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};padding-bottom:3px;">${esc(f.label)}</div>
      <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.45;color:${BODY};word-break:break-word;">${linkify(f.value) || `<span style="color:#b5aea5;">not given</span>`}</div>
    </td>`
  }
  const rows: string[] = []
  for (let i = 0; i < fields.length; i += 2) {
    const last = i + 2 >= fields.length
    rows.push(`<tr>${cell(fields[i], 'l', last)}${cell(fields[i + 1], 'r', last)}</tr>`)
  }
  return `<tr><td style="padding:0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
  </td></tr>`
}

/**
 * The maker's own photographs, three across, each linking to the full size.
 *
 * The only remote content any of these emails loads, and it is deliberate:
 * this one goes to Mermade's own inbox, and the jury's actual question is
 * "what does the work look like". A row of thumbnails answers it before
 * anybody opens the admin.
 *
 * Two rules hold even so. The urls come from our own storage bucket and are
 * checked by the caller, never from anything a maker typed; and a client that
 * blocks remote images loses the pictures and nothing else, because every
 * field is still in the record below and in the plain-text part.
 *
 * Width as an attribute as well as a style, because Outlook's Word renderer
 * ignores CSS width on an image.
 */
export function photoStrip(urls: string[]): string {
  if (urls.length === 0) return ''
  const W = 160
  const cells = urls.slice(0, 6).map((u) => `
    <td width="${W}" valign="top" style="padding:0 8px 8px 0;">
      <a href="${esc(u)}" style="text-decoration:none;">
        <img src="${esc(u)}" width="${W}" alt="" style="display:block;width:${W}px;height:${W}px;object-fit:cover;border:1px solid ${RULE};" />
      </a>
    </td>`)
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 3) {
    rows.push(`<tr>${cells.slice(i, i + 3).join('')}</tr>`)
  }
  return `<tr><td style="padding:4px 24px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
  </td></tr>`
}

export function paragraphs(text: string[]): string {
  return text.map((t) => `
    <tr><td style="padding:0 24px 14px;">
      <div style="font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${BODY};">${t}</div>
    </td></tr>`).join('')
}

export function button(cta: { href: string; label: string }): string {
  return `<tr><td style="padding:18px 24px 4px;">
    <a href="${esc(cta.href)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${HEAD_FONT};font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 26px;">${esc(cta.label)}</a>
  </td></tr>`
}

export function rule(): string {
  return `<tr><td style="padding:18px 24px 0;"><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`
}

/**
 * @param pill    what happened, in the header chip
 * @param heading the thing the reader is looking for
 * @param sub     one line under it, and the preview line in the inbox list
 * @param inner   the body, built from the helpers above
 * @param footer  the small grey line at the end
 */
export function shell({
  pill, heading, sub, inner, footer,
}: {
  pill: string
  heading: string
  sub: string
  inner: string
  footer: string
}): string {
  const origin = siteUrl()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
<!-- The line a phone shows under the subject, then enough blanks that it does
     not go on to read the first row out loud. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(sub)}${'&#8203;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${PAPER};border:1px solid ${RULE};">

      <tr><td style="padding:20px 24px;border-bottom:2px solid ${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle"><img src="${esc(origin)}/email/wordmark.png" width="${MARK_W}" height="${MARK_H}" alt="Mermade Market" style="display:block;width:${MARK_W}px;height:${MARK_H}px;border:0;outline:none;text-decoration:none;"></td>
          <td valign="middle" align="right"><span style="display:inline-block;background:${GOLD};color:#ffffff;font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding:6px 12px;">${esc(pill)}</span></td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:26px 24px 4px;">
        <div style="font-family:${HEAD_FONT};font-size:30px;line-height:1.12;font-weight:600;text-transform:uppercase;color:${INK};">${esc(heading)}</div>
        <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${BODY};padding-top:8px;">${esc(sub)}</div>
      </td></tr>

      <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
      ${inner}

      <tr><td style="padding:16px 24px 22px;border-top:1px solid ${RULE};background:${CREAM};">
        <div style="font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:${MUTED};">${footer}</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}
