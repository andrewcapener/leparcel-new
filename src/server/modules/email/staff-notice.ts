/**
 * The internal "a maker applied" email, as something you would enjoy opening.
 *
 * It is written by hand rather than with a component library because email is
 * not the web: Gmail, Outlook and Apple Mail between them strip <style> blocks,
 * ignore flexbox and grid, drop external stylesheets, and Outlook still renders
 * through Word. So this is tables and inline styles, which is not old-fashioned,
 * it is the only thing that arrives looking the way it left.
 *
 * Two rules it keeps from the plain-text version it replaces:
 *
 *  - every field is here. This message is one of the four places an
 *    application lives (src/app/actions.ts), and a copy missing a field is not
 *    a backup. It is sent alongside the text version, not instead of it: the
 *    text part is what survives a client that refuses HTML, and it is what the
 *    outbox stores, because a searchable record beats a pretty one.
 *  - nothing is fetched. No web font, no tracking pixel, no remote image. A
 *    mail client that blocks remote content shows this exactly as intended,
 *    and a maker's details never travel to a third party to render a header.
 */

const GOLD = '#bc9658'
const INK = '#171717'
const BODY = '#5c5c5c'
const RULE = '#e7e4df'
const PAPER = '#ffffff'
const CREAM = '#faf8f5'

/** Oswald and Figtree are not installed on a phone, so both stacks end in
 *  something every device has. The look survives; the exact face does not
 *  have to. */
const HEAD_FONT = "Oswald, 'Helvetica Neue', Helvetica, Arial, sans-serif"
const BODY_FONT = "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export type NoticeField = { label: string; value: string; strong?: boolean }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A value that is a link stays a link, and everything else is plain text. */
function cell(value: string): string {
  const v = esc(value)
  if (/^https?:\/\//.test(value)) {
    return `<a href="${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  }
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    return `<a href="mailto:${v}" style="color:${GOLD};text-decoration:underline;">${v}</a>`
  }
  return v
}

function row(f: NoticeField, last: boolean): string {
  const border = last ? '' : `border-bottom:1px solid ${RULE};`
  const weight = f.strong ? '600' : '400'
  const colour = f.strong ? INK : BODY
  return `
    <tr>
      <td style="padding:11px 24px 3px;">
        <div style="font-family:${HEAD_FONT};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#9a938a;">${esc(f.label)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 11px;${border}">
        <div style="font-family:${BODY_FONT};font-size:16px;line-height:1.45;font-weight:${weight};color:${colour};">${cell(f.value) || '<span style="color:#b5aea5;">not given</span>'}</div>
      </td>
    </tr>`
}

/**
 * @param title   what happened, in the pill: "NEW APPLICATION"
 * @param heading the shop, which is the thing the reader is looking for
 * @param sub     one line under it, e.g. the show and the track
 * @param fields  every field, in the order the Sheet uses
 * @param cta     the admin link
 */
export function staffNoticeHtml({
  title, heading, sub, fields, cta,
}: {
  title: string
  heading: string
  sub: string
  fields: NoticeField[]
  cta?: { href: string; label: string }
}): string {
  const rows = fields.map((f, i) => row(f, i === fields.length - 1)).join('')
  const button = cta
    ? `<tr><td style="padding:18px 24px 4px;">
         <a href="${esc(cta.href)}" style="display:inline-block;background:${INK};color:#ffffff;font-family:${HEAD_FONT};font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 26px;">${esc(cta.label)}</a>
       </td></tr>`
    : ''

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
<!-- The line a phone shows under the subject, and then enough blanks that it
     does not go on to read the first row of the table out loud. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(sub)}${'&#8203;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${PAPER};border:1px solid ${RULE};">

      <tr><td style="padding:22px 24px;border-bottom:2px solid ${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${HEAD_FONT};font-size:15px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${INK};">Mermade Market</td>
          <td align="right">
            <span style="display:inline-block;background:${GOLD};color:#ffffff;font-family:${HEAD_FONT};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding:6px 12px;">${esc(title)}</span>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:26px 24px 4px;">
        <div style="font-family:${HEAD_FONT};font-size:30px;line-height:1.12;font-weight:600;letter-spacing:0.01em;text-transform:uppercase;color:${INK};">${esc(heading)}</div>
        <div style="font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${BODY};padding-top:8px;">${esc(sub)}</div>
      </td></tr>

      ${button}

      <tr><td style="padding:18px 24px 0;"><div style="height:1px;background:${RULE};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

      ${rows}

      <tr><td style="padding:16px 24px 22px;border-top:1px solid ${RULE};background:${CREAM};">
        <div style="font-family:${BODY_FONT};font-size:12px;line-height:1.5;color:#9a938a;">
          This message is also the backup copy. Every field is above.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}
