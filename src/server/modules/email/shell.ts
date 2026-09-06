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
 * Nothing is ever fetched. No web font, no remote image, no beacon. A client
 * that blocks external content shows the message whole, and a maker's details
 * never travel to a third party to render a header.
 */

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

      <tr><td style="padding:22px 24px;border-bottom:2px solid ${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${HEAD_FONT};font-size:15px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">Mermade Market</td>
          <td align="right"><span style="display:inline-block;background:${GOLD};color:#ffffff;font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding:6px 12px;">${esc(pill)}</span></td>
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
